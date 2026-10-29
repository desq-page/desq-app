export const LOCAL_MODELS = Object.freeze([
  { key: 'qwen-4b', label: 'Qwen3.5 4B · HTML', id: 'onnx-community/Qwen3.5-4B-ONNX-OPT', dtype: 'auto-q4', maxInputTokens: 8192, maxOutputTokens: 4096 },
  { key: 'qwen-0.8b', label: 'Qwen3.5 0.8B · HTML', id: 'onnx-community/Qwen3.5-0.8B-ONNX-OPT', dtype: 'auto-q4', maxInputTokens: 8192, maxOutputTokens: 4096 },
  { key: 'qwen-2b', label: 'Qwen3.5 2B · HTML', id: 'onnx-community/Qwen3.5-2B-ONNX-OPT', dtype: 'auto-q4', maxInputTokens: 8192, maxOutputTokens: 4096 },
  ...['E4B'].map(size => ({
    key:`gemma-4-${size.toLowerCase()}`,label:`Gemma 4 ${size} · HTML`,runtime:'mediapipe',dtype:'litert-task',
    id:`huggingworld/gemma-4-${size}-it-litert-lm`,
    url:`https://huggingface.co/huggingworld/gemma-4-${size}-it-litert-lm/resolve/main/gemma-4-${size}-it-web.task`,
    maxInputTokens:8192,maxOutputTokens:4096,
  })),
  {key:'phi-4-mini-instruct',label:'Phi-4 mini instruct · ONNX',
    id:'webgpu/Phi-4-mini-instruct-ONNX-OPT',dtype:'q4f16',requiresShaderF16:true,
    maxInputTokens:8192,maxOutputTokens:4096},
]);

export const SELECTABLE_LOCAL_MODELS = Object.freeze(
  LOCAL_MODELS.filter(model => ['qwen-4b', 'gemma-4-e4b'].includes(model.key)),
);

export function getLocalModel(key) {
  const model = LOCAL_MODELS.find(model => model.key === key);
  if (!model) throw new Error('Choose a supported local model.');
  return model;
}
