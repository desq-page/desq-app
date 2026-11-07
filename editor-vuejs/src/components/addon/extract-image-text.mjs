import { getShapeImage } from 'shared-vuejs/api/downloadShape';
import { deleteShape } from 'shared-vuejs/api/shape';
import { addShapeRaw } from 'shared-vuejs/api/draw';
import { processImage } from 'shared-vuejs/api/upload';
import { saveDexie } from 'shared-vuejs/api/dbutils';
import { getFileInfo, getShapeDeep, getSlideInfo, getSlidesSlideId, updateShape } from 'shared-vuejs/editor';

const ocrModule = 'https://esm.sh/ppu-paddle-ocr@6.6.1/web';
const inpaintModel = 'https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx';
const aotModelBase = 'https://huggingface.co/Unhead/aotgan/resolve/main/';
const aotWeights = 'aotgan-dynamic.onnx.data';
const inpaintSessions = new Map();

async function downloadModel(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not download the image cleanup model.');
  return response.arrayBuffer();
}

async function loadInpaint(ort, engine) {
  const options = { executionProviders: ['wasm'] };
  if (engine === 'aot') {
    const [model, data] = await Promise.all([
      downloadModel(aotModelBase + 'aotgan.onnx'),
      downloadModel(aotModelBase + aotWeights),
    ]);
    return ort.InferenceSession.create(model, { ...options, externalData: [{ path: aotWeights, data }] });
  }
  return ort.InferenceSession.create(await downloadModel(inpaintModel), options);
}

async function eraseText(context, boxes, contextBoxes, engine) {
  const ort = await import('onnxruntime-web/wasm');
  ort.env.wasm.numThreads = 1;
  if (!inpaintSessions.has(engine)) {
    inpaintSessions.set(engine, loadInpaint(ort, engine).catch(error => {
      inpaintSessions.delete(engine);
      throw error;
    }));
  }
  const session = await inpaintSessions.get(engine);
  const aot = engine === 'aot';
  const { width, height } = context.canvas;
  const pixels = context.getImageData(0, 0, width, height);
  const repaired = new ImageData(new Uint8ClampedArray(pixels.data), width, height);
  const bounds = ({ x, y, width: w, height: h }, padding = 0) => ({
    left: Math.max(0, Math.floor(x - padding)), top: Math.max(0, Math.floor(y - padding)),
    right: Math.min(width, Math.ceil(x + w + padding)), bottom: Math.min(height, Math.ceil(y + h + padding)),
  });
  const holes = boxes.map(box => bounds(box));
  const known = new Uint8Array(width * height).fill(255);
  for (const hole of [...holes, ...contextBoxes.map(box => bounds(box, 2))]) {
    if (hole.right <= hole.left) continue;
    for (let y = hole.top; y < hole.bottom; y++)
      known.fill(0, y * width + hole.left, y * width + hole.right);
  }
  // Give each hole nearby context. Exclude neighboring text from that context
  // and composite only the target area back into the original picture.
  for (const hole of holes) {
    const padding = aot ? 24 : Math.max(24, Math.ceil((hole.bottom - hole.top) * 2));
    let left = Math.max(0, hole.left - padding), top = Math.max(0, hole.top - padding);
    let w = Math.min(width, hole.right + padding) - left;
    let h = Math.min(height, hole.bottom + padding) - top;
    // Kites' AOT model uses 64-pixel buckets and needs at least 128 per axis.
    if (aot) {
      w = Math.max(128, Math.ceil(w / 64) * 64);
      h = Math.max(128, Math.ceil(h / 64) * 64);
      left = Math.min(left, Math.max(0, width - w));
      top = Math.min(top, Math.max(0, height - h));
    }
    const size = w * h;
    const ArrayType = aot ? Float32Array : Uint8Array;
    const rgb = new ArrayType(size * 3);
    const mask = new ArrayType(size);
    let hasBackground = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const source = Math.min(height - 1, top + y) * width + Math.min(width - 1, left + x);
      const i = y * w + x;
      const keep = known[source] === 255;
      hasBackground ||= keep;
      mask[i] = aot ? Number(!keep) : known[source];
      for (let c = 0; c < 3; c++) {
        const pixel = pixels.data[source * 4 + c];
        rgb[i + c * size] = aot ? (keep ? pixel / 127.5 - 1 : 0) : pixel;
      }
    }
    if (!hasBackground) throw new Error('No nearby background is available for inpainting.');
    const dtype = aot ? 'float32' : 'uint8';
    const image = new ort.Tensor(dtype, rgb, [1, 3, h, w]);
    const region = new ort.Tensor(dtype, mask, [1, 1, h, w]);
    let outputs;
    try {
      outputs = await session.run({ [session.inputNames[0]]: image, [session.inputNames[1]]: region });
      const clean = outputs[session.outputNames[0]].data;
      if (clean.length !== rgb.length) throw new Error('The cleanup model returned an unexpected image size.');
      for (let y = hole.top; y < hole.bottom; y++) for (let x = hole.left; x < hole.right; x++) {
        const i = (y - top) * w + x - left;
        const target = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) repaired.data[target + c] = aot ? (clean[i + c * size] + 1) * 127.5 : clean[i + c * size];
      }
    } finally {
      image.dispose();
      region.dispose();
      for (const tensor of Object.values(outputs || {})) tensor.dispose();
    }
  }
  context.putImageData(repaired, 0, 0);
  return new Promise((resolve, reject) => context.canvas.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('Could not encode the cleaned image.')), 'image/png'));
}

// Compare the source with the repaired background to isolate likely ink pixels.
function estimateInkColor(before, after, region) {
  const buckets = new Map();
  for (let y = Math.floor(region.y); y < Math.ceil(region.y + region.height); y++) {
    for (let x = Math.floor(region.x); x < Math.ceil(region.x + region.width); x++) {
      const offset = (y * before.width + x) * 4;
      if (before.data[offset + 3] < 128) continue;
      const r = before.data[offset], g = before.data[offset + 1], b = before.data[offset + 2];
      const difference = Math.hypot(r - after.data[offset], g - after.data[offset + 1], b - after.data[offset + 2]);
      if (difference < 35) continue;
      const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
      const bucket = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += difference;
      bucket.r += r * difference;
      bucket.g += g * difference;
      bucket.b += b * difference;
      buckets.set(key, bucket);
    }
  }
  let ink;
  for (const bucket of buckets.values()) if (!ink || bucket.weight > ink.weight) ink = bucket;
  return ink && [ink.r, ink.g, ink.b].map(value =>
    Math.round(value / ink.weight).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function textLanguage(text) {
  if (/[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu.test(text)) return 'vi-VN';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja-JP';
  if (/\p{Script=Hangul}/u.test(text)) return 'ko-KR';
  if (/\p{Script=Hebrew}/u.test(text)) return 'he';
  return undefined;
}

const imageSource = picture => picture?.blipFill?.blip?.$_target || picture?.blipFill?.blip?.dataUrl;
const cropKey = picture => JSON.stringify(['l', 't', 'r', 'b'].map(side =>
  Number(picture?.blipFill?.srcRect?.['$_' + side]) || 0));

function openPicture(id) {
  const fileId = getFileInfo()?.id;
  const slideId = getSlidesSlideId();
  const picture = getShapeDeep(id);
  const source = imageSource(picture);
  const crop = cropKey(picture);
  if (!fileId || !slideId || !source || picture.locked) throw new Error('Select an editable picture.');
  const current = () => {
    const shape = getShapeDeep(id);
    if (getFileInfo()?.id !== fileId || getSlidesSlideId() !== slideId ||
        !shape || shape.locked || imageSource(shape) !== source || cropKey(shape) !== crop)
      throw new Error('The slide or picture changed during OCR.');
    return shape;
  };
  return { fileId, picture, source, crop, current };
}

async function pictureCanvas(picture) {
  const blip = picture.blipFill.blip;
  const target = blip.$_target || '';
  let input = blip.dataUrl || (/^(?:https?:|data:|blob:|\/)/i.test(target) ? target : await getShapeImage(picture));
  if (!input) throw new Error('Could not read the selected picture.');
  if (!(input instanceof Blob)) {
    const response = await fetch(input);
    if (!response.ok) throw new Error('Could not read the selected picture.');
    input = await response.blob();
  }
  const bitmap = await createImageBitmap(input);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return context;
  } finally {
    bitmap.close();
  }
}

async function withOcr(language, callback) {
  const { PaddleOcrService, V5_LATIN_MOBILE_MODEL } = await import(/* @vite-ignore */ ocrModule);
  if (language === 'vi-VN' && !V5_LATIN_MOBILE_MODEL)
    throw new Error('The Vietnamese OCR model is unavailable.');
  const service = language === 'vi-VN'
    ? new PaddleOcrService({ model: V5_LATIN_MOBILE_MODEL })
    : new PaddleOcrService();
  try {
    await service.initialize();
    return await callback(service);
  } finally {
    await service.destroy();
  }
}

function regionGeometry(picture, box) {
  const [left, top, right, bottom] = JSON.parse(cropKey(picture)).map(value => value / 100000);
  const sx = picture.w / (1 - left - right);
  const sy = picture.h / (1 - top - bottom);
  const w = box.width * sx, h = box.height * sy;
  const angle = (picture.rot || 0) * Math.PI / 180;
  const dx = ((box.x - left) * sx + w / 2 - picture.w / 2) * (picture.flipH ? -1 : 1);
  const dy = ((box.y - top) * sy + h / 2 - picture.h / 2) * (picture.flipV ? -1 : 1);
  return {
    x: picture.x + picture.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - w / 2,
    y: picture.y + picture.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - h / 2,
    w, h, rot: picture.rot,
  };
}

const pictureMarkers = id => (getSlideInfo()?.shapes || []).filter(shape => shape.ocrRegion?.pictureId === id);
const blue = { uniClr: { $_otag: 'srgbClr', $_val: '2563EB' } };

export async function detectImageTextRegions(shape, progress) {
  const job = openPicture(shape.id);
  progress('Loading OCR model…');
  const context = await pictureCanvas(job.picture);
  const { width, height } = context.canvas;
  const { boxes } = await withOcr(undefined, service => {
    progress('Detecting text regions…');
    return service.detect(context.canvas);
  });
  const picture = job.current();
  const [l, t, r, b] = JSON.parse(job.crop).map(value => value / 100000);
  const regions = boxes.flatMap(box => {
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) return [];
    const x = Math.max(0, l, box.x / width), y = Math.max(0, t, box.y / height);
    const w = Math.min(1, 1 - r, (box.x + box.width) / width) - x;
    const h = Math.min(1, 1 - b, (box.y + box.height) / height) - y;
    return w > 0 && h > 0 ? [{ x, y, width: w, height: h }] : [];
  });
  if (!regions.length) return false;
  const existing = pictureMarkers(picture.id);
  for (const box of regions) {
    if (existing.some(({ ocrRegion }) => ocrRegion.source === job.source && ocrRegion.crop === job.crop &&
        (ocrRegion.parts || [ocrRegion.box]).some(part =>
          Object.keys(box).every(key => Math.abs(part[key] - box[key]) < 0.001)))) continue;
    addShapeRaw({
      name: 'OCR region', type: 'rect', $_otag: 'sp', ...regionGeometry(picture, box),
      solidFill: { uniClr: { ...blue.uniClr, alpha: { $_val: 9000 } } },
      ln: { solidFill: blue, $_w: 12700 },
      ocrRegion: { pictureId: picture.id, source: job.source, crop: job.crop, box },
    });
  }
  await saveDexie();
  return true;
}

export async function mergeImageTextRegions(shapes) {
  const markers = shapes.map(shape => getShapeDeep(shape.id));
  const first = markers[0]?.ocrRegion;
  if (markers.length < 2 || !first || markers.some(marker => !marker?.ocrRegion || marker.locked ||
      marker.ocrRegion.pictureId !== first.pictureId || marker.ocrRegion.source !== first.source ||
      marker.ocrRegion.crop !== first.crop))
    throw new Error('Select at least two OCR boxes from the same picture.');
  const job = openPicture(first.pictureId);
  if (job.source !== first.source || job.crop !== first.crop)
    throw new Error('The picture changed. Detect its text regions again.');
  const parts = markers.flatMap(({ ocrRegion }) => ocrRegion.parts || [ocrRegion.box]);
  const x = Math.min(...parts.map(box => box.x));
  const y = Math.min(...parts.map(box => box.y));
  const width = Math.max(...parts.map(box => box.x + box.width)) - x;
  const height = Math.max(...parts.map(box => box.y + box.height)) - y;
  const box = { x, y, width, height };
  const geometry = regionGeometry(job.picture, box);
  updateShape({ id: markers[0].id, ...geometry, d: `R0,0,${geometry.w},${geometry.h}`,
    ocrRegion: { ...first, box, parts } });
  for (const marker of markers.slice(1)) deleteShape({ delshp: marker.id, evt: null });
  await saveDexie();
}

export async function extractImageText(shape, progress, language, engine = 'migan') {
  const marker = getShapeDeep(shape.id);
  const selection = marker?.ocrRegion;
  if (!selection || marker.locked) throw new Error('Select a detected text region.');
  const job = openPicture(selection.pictureId);
  if (selection.source !== job.source || selection.crop !== job.crop)
    throw new Error('The picture changed. Detect its text regions again.');
  const currentImage = () => {
    const picture = job.current();
    const currentMarker = getShapeDeep(marker.id);
    if (!currentMarker || currentMarker.locked ||
        JSON.stringify(currentMarker.ocrRegion) !== JSON.stringify(selection))
      throw new Error('The selected region changed during extraction.');
    return picture;
  };
  const context = await pictureCanvas(job.picture);
  const canvas = context.canvas;
  const toPixels = box => ({ x: box.x * canvas.width, y: box.y * canvas.height,
    width: box.width * canvas.width, height: box.height * canvas.height });
  const region = toPixels(selection.box);
  const holes = (selection.parts || [selection.box]).map(toPixels);
  const left = Math.max(0, Math.floor(region.x)), top = Math.max(0, Math.floor(region.y));
  const crop = document.createElement('canvas');
  crop.width = Math.min(canvas.width, Math.ceil(region.x + region.width)) - left;
  crop.height = Math.min(canvas.height, Math.ceil(region.y + region.height)) - top;
  const cropContext = crop.getContext('2d');
  cropContext.fillStyle = '#fff';
  cropContext.fillRect(0, 0, crop.width, crop.height);
  for (const hole of holes) {
    const x = Math.floor(hole.x), y = Math.floor(hole.y);
    const w = Math.ceil(hole.x + hole.width) - x, h = Math.ceil(hole.y + hole.height) - y;
    cropContext.drawImage(canvas, x, y, w, h, x - left, y - top, w, h);
  }
  progress('Reading selected region…');
  region.text = await withOcr(language, async service => (await service.recognize(crop)).text.trim().normalize('NFC'));
  if (!region.text) return false;
  currentImage();
  const neighbors = pictureMarkers(job.picture.id)
    .filter(shape => shape.ocrRegion.source === job.source && shape.ocrRegion.crop === job.crop)
    .flatMap(shape => (shape.ocrRegion.parts || [shape.ocrRegion.box]).map(toPixels));

  progress('Cleaning the image…');
  const before = context.getImageData(0, 0, canvas.width, canvas.height);
  const cleaned = await eraseText(context, holes, neighbors, engine);
  const after = context.getImageData(0, 0, canvas.width, canvas.height);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = '100px Arial';
  currentImage();
  const media = await processImage(cleaned, { fileId: job.fileId });
  if (!media?.name) throw new Error('Could not store the cleaned picture.');
  const current = currentImage();
  const { dataUrl, ...blip } = current.blipFill.blip;
  updateShape({ id: current.id, blipFill: { ...current.blipFill, blip: {
    ...blip, $_target: media.name, $_w: media.w, $_h: media.h,
  } } });
  for (const sibling of pictureMarkers(current.id)) {
    if (sibling.id !== marker.id && sibling.ocrRegion.source === job.source && sibling.ocrRegion.crop === job.crop)
      updateShape({ id: sibling.id, ocrRegion: { ...sibling.ocrRegion, source: media.name } });
  }
  const geometry = regionGeometry(current, selection.box);
  const { w, h } = geometry;
  const ink = estimateInkColor(before, after, region);
  const lang = language || textLanguage(region.text);
  const lines = region.text.split(/\r?\n/).filter(line => line.trim());
  const measuredWidth = Math.max(...lines.map(line => measure.measureText(line).width));
  const lineHeight = h / lines.length;
  const size = Math.min(lineHeight * 0.8, measuredWidth > 0 ? w * 100 / measuredWidth : lineHeight);
  updateShape({
    id: marker.id, ocrRegion: null, solidFill: null, hideSpinHandle: true,
    name: 'Extracted text', type: 'text', $_otag: 'sp',
    ...geometry, d: `R0,0,${w},${h}`, noFill: true, ln: { noFill: true },
    txBody: {
      bodyPr: { $_wrap: 'none', $_anchor: 'ctr', $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 },
      p: lines.map(line => ({ ...(lang === 'he' ? { pPr: { $_rtl: 1 } } : {}), r: [{ t: line, rPr: {
        $_sz: Math.max(100, Math.round(size * 75)),
        latin: { $_typeface: 'Arial' },
        ...(lang ? { $_lang: lang } : {}),
        ...(ink ? { solidFill: { uniClr: { $_otag: 'srgbClr', $_val: ink } } } : {}),
      } }] })),
    },
  });
  await saveDexie();
  return true;
}
