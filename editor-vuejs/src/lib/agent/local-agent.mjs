import {NATIVE_REPHRASE_INSTRUCTIONS} from './native-template-text.mjs';
import { localSourceBrief } from './source-bundle.mjs';
import { IMAGE_KEYWORD_INSTRUCTIONS, imageKeywords } from './image-keywords.mjs';
import { planTemplateFill } from './local-template-fill.mjs';
import { planLocalHTML } from './local-html.mjs';
import { planLocalMarkdown } from './local-markdown.mjs';
import { getLocalModel } from './local-models.mjs';
import { planLocalDeck } from './local-deck.mjs';
export { bindPlanContext, compactModelContext, parseToolPlan } from './agent-plan.mjs';

export function createLocalAgent(onProgress = () => {}, model = 'qwen-4b') {
  const worker = new Worker(new URL('./local-agent.worker.mjs', import.meta.url), { type: 'module' });
  let sequence = 0;
  let pending;
  let stopped = false;
  function rejectPending(message) {
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(message)); pending = undefined; }
  }
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') { onProgress(data); return; }
    if (pending?.id !== data.id) return;
    const request = pending;
    pending = undefined;
    clearTimeout(request.timer);
    if (data.type === 'error') {
      if (data.fatal) { stopped = true; worker.terminate(); }
      request.reject(new Error(data.error));
    }
    else request.resolve(data.type === 'ready' ? data.runtime : { text: data.text, metrics: data.metrics });
  };
  worker.onerror = event => { stopped = true; worker.terminate(); rejectPending(event.message || 'Local model worker failed.'); };
  function request(type, messages, options = {}) {
    if (stopped) return Promise.reject(new Error('Local model stopped. Load it again to continue.'));
    if (pending) return Promise.reject(new Error('The local model is busy.'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { stopped = true; rejectPending('Local model timed out. Restart it and try again.'); worker.terminate(); }, 10 * 60 * 1000);
      pending = { id, resolve, reject, timer };
      worker.postMessage({ type, id, messages, model, ...options });
    });
  }
  return {
    get stopped() { return stopped; },
    load: () => request('load'),
    async rewriteText(field,{signal}={}){
      signal?.throwIfAborted();
      const response=await request('generate',[{role:'system',content:NATIVE_REPHRASE_INSTRUCTIONS},{role:'user',content:JSON.stringify(field)}],{maxNewTokens:2048});
      signal?.throwIfAborted();return response.text;
    },
    async imageKeywords(image, { signal } = {}) {
      signal?.throwIfAborted();
      const result = await request('generate', [
        { role: 'system', content: IMAGE_KEYWORD_INSTRUCTIONS },
        { role: 'user', content: JSON.stringify({ description: image.query, alt: image.alt }) },
      ], { maxNewTokens: 128 });
      signal?.throwIfAborted();
      return imageKeywords(result.text);
    },
    async plan(command, tools, context, callbacks = {}) {
      if (context.slideTask?.mode !== 'edit' && context.slideTask?.count === 'auto') {
        callbacks.onProgress?.('Choosing the number of slides…');
        const result = await request('generate', [
          { role: 'system', content: 'Choose the appropriate slide count from 1 to 10 for this presentation. Honor an explicit requested count within this range. Use enough slides to explain the content without padding. Return ONLY one integer.' },
          { role: 'user', content: command },
        ], { maxNewTokens: 32 });
        const text = result.text?.trim();
        if (!/^(?:[1-9]|10)$/.test(text || '')) throw Error('The local model did not return a valid Auto slide count. Choose a number or try again.');
        context = { ...context, slideTask: { ...context.slideTask, count: Number(text) } };
      }
      const planner=context.localDesignMode === 'template-fill' ? planTemplateFill : context.slideAuthoring === 'svg' ? planLocalDeck : context.slideAuthoring === 'markdown' ? planLocalMarkdown : planLocalHTML;
      const plan = await planner({ command, tools, modelLabel:getLocalModel(model).label, context: { ...context, slideAuthoring: context.slideAuthoring || 'html' }, ...callbacks, generate: (messages, options) => { const brief = [context.sourceBundles?.length ? localSourceBrief(context.sourceBundles,messages) : ''].filter(Boolean).join('\n');return request('generate',brief?[messages[0],{role:'user',content:brief},...messages.slice(1)]:messages,options); }, isStopped: () => stopped });
      return plan;
    },
    dispose() { stopped = true; rejectPending('Local model stopped.'); worker.terminate(); },
  };
}
