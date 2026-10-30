import {normalizeTemplateImageField} from './native-template-fields.mjs';
import {parsedPresentonTemplate} from './presenton-pptx-cache.mjs';
import {sourceContext} from './source-bundle.mjs';
import { validateArguments } from './editor-tools.mjs';
import { parseQwenToolCall } from './qwen-tool-calls.mjs';

export function bindPlanContext(plan, context) {
  for (const call of plan.calls) {
    if (
      call.name.startsWith('desq_') &&
      !['desq_get_document', 'desq_get_page'].includes(call.name)
    ) {
      if (
        call.name === 'desq_insert_text' &&
        context.document.selectedTextTarget?.ambiguous &&
        !call.arguments.shapeId
      )
        throw new Error('Select one text shape or table cell to add text.');
      if (
        [
          'desq_move_shape_by',
          'desq_format_text',
          'desq_insert_text',
        ].includes(call.name) &&
        !call.arguments.shapeId
      ) {
        const selected =
          call.name === 'desq_insert_text' &&
          context.document.selectedTextTarget?.shapeId
            ? [context.document.selectedTextTarget.shapeId]
            : context.document.selectedShapeIds || [];
        if (selected.length !== 1)
          throw new Error('Select exactly one shape, or name a target shape.');
        call.arguments.shapeId = selected[0];
      }
      if (call.name === 'desq_insert_text_at_cursor')
        call.arguments.cursorId ??= context.document.textCursor?.cursorId;
      if (['desq_create_slide', 'desq_create_deck'].includes(call.name))
        call.arguments.pageId ??= context.page.pageId;
      call.arguments.fileId ??= context.document.fileId;
      if (
        [
          'desq_add_text',
          'desq_add_autoshape',
          'desq_set_shape_text',
          'desq_insert_text',
          'desq_insert_text_at_cursor',
          'desq_move_shape',
          'desq_move_shape_by',
          'desq_format_text',
          'desq_delete_shape',
        ].includes(call.name)
      )
        call.arguments.pageId ??= context.page.pageId;
    }
  }
  return plan;
}

export function compactModelContext(context) {
  const document = structuredClone(context.document);
  document.pages = (document.pages || []).slice(0, 12);
  const selected = new Set(document.selectedShapeIds || []);
  const source = context.page.shapes || [];
  const prioritized = [
    ...source.filter((shape) => selected.has(shape.id)),
    ...source.filter((shape) => !selected.has(shape.id)),
  ];
  const conversation = Array.isArray(context.conversation)
    ? context.conversation
        .filter(
          (turn) =>
            turn &&
            ['user', 'assistant'].includes(turn.role) &&
            typeof turn.text === 'string',
        )
        .slice(-12)
        .map((turn) => ({ role: turn.role, text: turn.text.slice(0, 2000) }))
    : [];
  return {
    document,
    ...(context.sourceBundles?.length ? {sourceContext:sourceContext(context.sourceBundles)} : context.sourceContext ? {sourceContext:context.sourceContext}:{}),
    ...(['svg', 'html', 'markdown'].includes(context.slideAuthoring) ? { slideAuthoring: context.slideAuthoring } : {}),
    ...(context.htmlTemplate ? { htmlTemplate: context.htmlTemplate } : {}),
    ...(context.pptxTemplateContext ? { pptxTemplateContext: context.pptxTemplateContext } : {}),
    ...(['quick', 'detailed'].includes(context.authoringEffort) ? { authoringEffort: context.authoringEffort } : {}),
    ...(conversation.length ? { conversation } : {}),
    page: {
      ...context.page,
      shapes: prioritized
        .slice(0, 12)
        .map((shape) => ({
          ...shape,
          text: (shape.text || '').slice(0, 240),
          textTruncated: shape.textTruncated || (shape.text || '').length > 240,
        })),
      omittedShapeCount: Math.max(
        0,
        context.page.shapeCount - Math.min(prioritized.length, 12),
      ),
    },
  };
}

export function parseToolPlan(text, tools, context) {
  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let plan;
  try {
    const nativeCalls = clean.startsWith('<tool_call>')
      ? [...clean.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g)]
      : [];
    plan = nativeCalls.length
      ? {
          message: '',
          calls: nativeCalls.map((match) => parseQwenToolCall(match[1], tools)),
        }
      : JSON.parse(clean);
  } catch (error) {
    const position = /(?:position |column )(\d+)/i.exec(error.message)?.[1];
    throw new Error(
      `The model returned malformed command JSON${position ? ` near character ${position}` : ''}. Return a complete JSON plan and escape quotes, backslashes and line breaks inside SVG strings. No edits applied.`,
    );
  }
  // Some instruction models emit a single OpenAI-style call without tags, or
  // a calls array without a prose message. Both still undergo full validation.
  if (plan && typeof plan.name === 'string' && plan.arguments && !plan.calls)
    plan = { message: '', calls: [plan] };
  if (plan && Array.isArray(plan.calls) && plan.message === undefined)
    plan.message = '';
  if (
    !plan ||
    typeof plan !== 'object' ||
    Array.isArray(plan) ||
    typeof plan.message !== 'string' ||
    plan.message.length > 2000 ||
    !Array.isArray(plan.calls) ||
    plan.calls.length > 8
  )
    throw new Error('Invalid command plan. Try a simpler request.');
  if (!plan.calls.length && !plan.message.trim())
    plan.message =
      'The model could not determine an edit. Specify the target and desired change.';
  if (
    plan.calls.some((call) =>
      ['desq_create_slide', 'desq_create_deck'].includes(call?.name),
    ) &&
    plan.calls.length !== 1
  )
    throw new Error(
      'Create a complete slide or deck with one creation call, without additional editing calls.',
    );
  if (context) {
    for (const call of plan.calls)
      if (
        !call?.arguments ||
        typeof call.arguments !== 'object' ||
        Array.isArray(call.arguments)
      )
        throw new Error('Tool arguments must be an object.');
    bindPlanContext(plan, context);
  }
  for (const call of plan.calls) {
    const tool = tools.find((tool) => tool.name === call?.name);
    if (!tool)
      throw new Error(`The model requested an unknown tool: ${call?.name}`);
    // Models sometimes flatten strategy metadata despite the nested schema.
    // Preserve it in its canonical location; never discard conflicting values.
    if (call.name === 'desq_create_deck' && call.arguments &&
        typeof call.arguments === 'object' && !Array.isArray(call.arguments)) {
      const args = call.arguments;
      const normalizeTitle = (value,label) => {
        if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'name'))return;
        if(Object.hasOwn(value,'title')&&value.title!==value.name)throw Error(`${tool.name}: Conflicting ${label} name and title values.`);
        value.title=value.name;delete value.name;
      };
      normalizeTitle(args,'deck');
      if(Array.isArray(args.slides))for(const slide of args.slides){
        normalizeTitle(slide,'slide');
        if(slide&&Object.hasOwn(slide,'image')){
          const request=normalizeTemplateImageField({image:slide.image});
          if(request.query||request.alt){
            if(slide.layout==='pptx'){
              const reference=parsedPresentonTemplate(slide.templateSelection?.family)?.layouts.find(layout=>layout.id===slide.templateSelection?.layout);
              const images=reference?.slots.filter(slot=>slot.kind==='image');
              const id=slide.image?.id??slide.image?.name??(images?.length===1?images[0].placeholderId:undefined);
              if(id===undefined)throw Error(`${tool.name}: Image needs an exact template placeholder ID for this layout.`);
              slide.templateFields??=[];slide.templateFields.push({id,...request});
            }else if(slide.images?.length)throw Error(`${tool.name}: Use images or image, not both.`);
            else slide.images=[request];
          }
          delete slide.image;
        }
        if(slide&&Array.isArray(slide.templateFields))slide.templateFields=slide.templateFields.map(raw=>{
          const field=normalizeTemplateImageField(raw);
          if(!field||typeof field!=='object'||!Object.hasOwn(field,'name'))return field;
          const {name,...content}=field;
          return {...content,id:field.id??name};
        });
      }
      for (const key of ['thesis', 'narrative', 'visualStyle']) {
        if (!Object.hasOwn(args, key)) continue;
        args.strategy ??= {};
        if (typeof args.strategy !== 'object' || Array.isArray(args.strategy))
          throw new Error(`${tool.name}: strategy must be an object.`);
        if (Object.hasOwn(args.strategy, key) && args.strategy[key] !== args[key])
          throw new Error(`${tool.name}: Conflicting strategy.${key} values.`);
        args.strategy[key] = args[key];
        delete args[key];
      }
    }
    try { validateArguments(tool.inputSchema, call.arguments); }
    catch (error) { throw new Error(`${tool.name}: ${error.message}`); }
  }
  return plan;
}
