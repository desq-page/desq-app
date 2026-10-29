import {planCloudPptxTemplate} from './cloud-pptx-plan.mjs';
import { requestImageRelevance } from './image-relevance.mjs';
import { requestImageKeywords } from './image-keywords.mjs';
import { createGeminiBrowserClient } from './gemini-browser.mjs';
import { compactModelContext, parseToolPlan } from './agent-plan.mjs';
import { checkedCloudPlan } from './deck-preflight.mjs';
import { generateAgentImage } from './generated-image-client.mjs';

export const GEMINI_AGENT_PATH = '/api/agent/gemini';

export const geminiRequest = createGeminiBrowserClient();

export function createGeminiAgent(model, request = geminiRequest) {
  const controller = new AbortController();
  return {
    async rewriteText(field,{signal,onProgress}={}){
      const combined=AbortSignal.any([controller.signal,AbortSignal.timeout(60000),...(signal?[signal]:[])]);
      const response=await request('rewrite',{signal:combined,onProgress,body:{model:typeof model === 'function' ? model() : model,...field}});
      combined.throwIfAborted();return response.text;
    },
    imageMatches(image, options) { return requestImageRelevance(request, controller.signal, typeof model === 'function' ? model() : model, image, options); },
    get stopped() { return controller.signal.aborted; },
    imageKeywords(image, options) { return requestImageKeywords(request, controller.signal, typeof model === 'function' ? model() : model, image, options); },
    generateImage(image, options) { return generateAgentImage(request, controller.signal, '', image, options); },
    async plan(command, tools, context, { onProgress, onPreview } = {}) {
      if (!command.trim() || command.length > 4000) throw new Error('Enter a command of up to 4000 characters.');
      if(context.pptxTemplateContext?.role==='native-template-base'&&context.slideTask?.mode!=='edit')return planCloudPptxTemplate({request,model:typeof model === 'function' ? model() : model,command,tools,context,signal:context.signal?AbortSignal.any([controller.signal,context.signal]):controller.signal,onProgress,modelLabel:typeof model === 'function' ? model() : model});
      const { plan, response } = await checkedCloudPlan({ request: (path, options) => request(path, { ...options, onProgress }), signal: controller.signal, tools, context, parse: parseToolPlan, onProgress, onPreview,
        body: { model: typeof model === 'function' ? model() : model, command, context: compactModelContext(context) } });
      return { ...plan, metrics: { source: 'gemini', ...(response.workflow ? { workflow: response.workflow } : {}), inferenceMs: response.inferenceMs, inputTokens: response.inputTokens, ...(response.repaired ? { repaired: true } : {}), ...(response.reviewed ? { reviewed: true, designFindings: response.designFindings } : {}) } };
    },
    dispose() { controller.abort(); },
  };
}
