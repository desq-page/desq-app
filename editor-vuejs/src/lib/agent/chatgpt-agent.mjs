import {planCloudPptxTemplate} from './cloud-pptx-plan.mjs';
import { requestImageRelevance } from './image-relevance.mjs';
import { requestImageKeywords } from './image-keywords.mjs';
import { cloudProviderRequest } from './cloud-provider.mjs';
import { compactModelContext, parseToolPlan } from './agent-plan.mjs';
import { editorPlanInstructions } from './plan-instructions.mjs';
export { editorPlanInstructions } from './plan-instructions.mjs';
import { checkedCloudPlan } from './deck-preflight.mjs';
import { generateAgentImage } from './generated-image-client.mjs';

export const CHATGPT_AGENT_PATH = '/api/agent/chatgpt';

export const chatgptRequest = (path, options) => cloudProviderRequest('chatgpt', path, options);

export function createChatGPTAgent(model, request = chatgptRequest) {
  const controller = new AbortController();
  return {
    async rewriteText(field,{signal,onProgress}={}){
      const combined=AbortSignal.any([controller.signal,AbortSignal.timeout(60000),...(signal?[signal]:[])]);
      const response=await request('rewrite',{signal:combined,onProgress,body:{model:model,...field}});
      combined.throwIfAborted();return response.text;
    },
    imageMatches(image, options) { return requestImageRelevance(request, controller.signal, model, image, options); },
    get stopped() { return controller.signal.aborted; },
    imageKeywords(image, options) { return requestImageKeywords(request, controller.signal, model, image, options); },
    generateImage(image, options) { return generateAgentImage(request, controller.signal, model, image, options); },
    async plan(command, tools, context, { onProgress, onPreview } = {}) {
      if (!command.trim() || command.length > 4000) throw new Error('Enter a command of up to 4000 characters.');
      if(context.pptxTemplateContext?.role==='native-template-base'&&context.slideTask?.mode!=='edit')return planCloudPptxTemplate({request,model:model,command,tools,context,signal:context.signal?AbortSignal.any([controller.signal,context.signal]):controller.signal,onProgress,modelLabel:model});
      const { plan, response } = await checkedCloudPlan({ request: (path, options) => request(path, { ...options, onProgress }), signal: controller.signal, tools, context, parse: parseToolPlan, onProgress, onPreview,
        body: { model, command, context: compactModelContext(context) } });
      return { ...plan, metrics: { source: 'chatgpt', ...(response.workflow ? { workflow: response.workflow } : {}), inferenceMs: response.inferenceMs, inputTokens: response.inputTokens, ...(response.repaired ? { repaired: true } : {}), ...(response.reviewed ? { reviewed: true, designFindings: response.designFindings } : {}) } };
    },
    dispose() { controller.abort(); },
  };
}

export const chatgptPlanInstructions = editorPlanInstructions;
