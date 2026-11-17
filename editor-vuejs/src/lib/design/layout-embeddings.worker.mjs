import { AutoConfig, AutoModel, AutoTokenizer } from '@huggingface/transformers';

const modelId = 'onnx-community/embeddinggemma-2-ONNX';
let encoder;
const catalogVectors = new Map();
async function loadEncoder() {
  const config = await AutoConfig.from_pretrained(modelId);
  config.vision_config = config.audio_config = null;
  const [model, tokenizer] = await Promise.all([
    AutoModel.from_pretrained(modelId, { config, device: 'webgpu', dtype: 'q4' }),
    AutoTokenizer.from_pretrained(modelId),
  ]);
  return async texts => {
    const inputs = tokenizer(texts, { padding: true, truncation: true, max_length: 512 });
    const { sentence_embedding } = await model(inputs);
    return sentence_embedding.tolist();
  };
}

function similarity(query, vector) {
  return vector.reduce((sum, value, i) => sum + value * query[i], 0);
}

async function embedDocuments(embed, descriptions) {
  const documents = [];
  for (let offset = 0; offset < descriptions.length; offset += 8) {
    documents.push(...await embed(descriptions.slice(offset, offset + 8).map(text => `title: none | text: ${text}`)));
  }
  return documents;
}

self.onmessage = async ({ data: { variants, slides } }) => {
  try {
    if (!self.navigator.gpu) throw new Error('Design Ideas requires a browser with WebGPU.');
    encoder ||= loadEncoder();
    const embed = await encoder;
    const labels = variants.map(variant => `${variant.label}. ${variant.description}`);
    const documents = [...new Set([...variants.map(variant => variant.description), ...labels])]
      .filter(text => !catalogVectors.has(text));
    if (documents.length) {
      self.postMessage({ indexing: true });
      const vectors = await embedDocuments(embed, documents);
      documents.forEach((text, index) => catalogVectors.set(text, vectors[index]));
    }
    const scores = [];
    for (const slide of slides) {
      const [query] = await embed([`task: search result | query: ${slide}`]);
      scores.push(variants.map((variant, index) =>
        similarity(query, catalogVectors.get(variant.description)) * .75 +
        similarity(query, catalogVectors.get(labels[index])) * .25));
      self.postMessage({ done: scores.length });
    }
    self.postMessage({ scores });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
