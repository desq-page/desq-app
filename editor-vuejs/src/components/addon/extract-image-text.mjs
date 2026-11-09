import { getShapeImage } from 'shared-vuejs/api/downloadShape';
import { deleteShape } from 'shared-vuejs/api/shape';
import { addShapeRaw } from 'shared-vuejs/api/draw';
import { processImage } from 'shared-vuejs/api/upload';
import { saveDexie } from 'shared-vuejs/api/dbutils';
import { getFileInfo, getShapeDeep, getSlideInfo, getSlidesSlideId, updateShape } from 'shared-vuejs/editor';
import { genId } from 'shared-vuejs/api/utility';
import { editTextMediaName } from '@/lib/main/editTextMedia.mjs';

const ocrModule = 'https://esm.sh/ppu-paddle-ocr@6.6.1/web';
const inpaintModel = 'https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx';
const aotModelBase = 'https://huggingface.co/Unhead/aotgan/resolve/main/';
const aotWeights = 'aotgan-dynamic.onnx.data';
const inpaintSessions = new Map();
let slideLanguageScan;

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

const glyphMargin = 3;

// OCR line boxes can clip descenders and detached diacritics. Search past
// their edges before rejecting components that run into surrounding artwork.
const glyphSearchPadding = box => Math.max(3, Math.min(24, Math.ceil(box.height * .15)));

function pixelBounds({ x, y, width: w, height: h }, width, height, padding) {
  return {
    left: Math.max(0, Math.floor(x - padding)), top: Math.max(0, Math.floor(y - padding)),
    right: Math.min(width, Math.ceil(x + w + padding)), bottom: Math.min(height, Math.ceil(y + h + padding)),
  };
}

function makeGlyphMask(context, boxes) {
  const { width, height } = context.canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (const box of boxes) {
    const { left, top, right, bottom } = pixelBounds(box, width, height, glyphSearchPadding(box));
    const original = pixelBounds(box, width, height, 0);
    const w = right - left, h = bottom - top;
    if (w < 2 || h < 2) continue;
    const gray = new Uint8Array(w * h), histogram = new Uint32Array(256);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const offset = ((top + y) * width + left + x) * 4;
      const value = Math.round(.299 * pixels[offset] + .587 * pixels[offset + 1] + .114 * pixels[offset + 2]);
      gray[y * w + x] = value;
      histogram[value]++;
    }
    // Otsu separates lettering from the local paper/bubble tone without
    // treating the OCR rectangle itself as the removal mask.
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let backgroundWeight = 0, backgroundSum = 0, bestVariance = -1, threshold = 127;
    for (let i = 0; i < 256; i++) {
      backgroundWeight += histogram[i];
      if (!backgroundWeight) continue;
      const foregroundWeight = total - backgroundWeight;
      if (!foregroundWeight) break;
      backgroundSum += i * histogram[i];
      const meanBackground = backgroundSum / backgroundWeight;
      const meanForeground = (sum - backgroundSum) / foregroundWeight;
      const variance = backgroundWeight * foregroundWeight * (meanBackground - meanForeground) ** 2;
      if (variance > bestVariance) { bestVariance = variance; threshold = i; }
    }
    // OCR boxes usually surround dark lettering. When the selected pixels are
    // mostly dark (reverse lettering), invert the threshold polarity.
    let dark = 0, light = 0;
    for (const value of gray) value <= threshold ? dark++ : light++;
    const inkIsDark = dark <= light;
    let inkCount = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const value = gray[y * w + x];
      if (inkIsDark ? value <= threshold : value > threshold) inkCount++;
    }
    // If contrast is ambiguous, leave the source untouched instead of falling
    // back to painting the whole OCR rectangle over nearby bubble artwork.
    if (!bestVariance || inkCount < total * .002 || inkCount > total * .55) continue;
    const candidate = new Uint8Array(total);
    for (let i = 0; i < total; i++) candidate[i] = inkIsDark ? gray[i] <= threshold : gray[i] > threshold ? 1 : 0;
    const visited = new Uint8Array(total), queue = new Int32Array(total);
    for (let start = 0; start < total; start++) {
      if (!candidate[start] || visited[start]) continue;
      let head = 0, tail = 0, minX = w, minY = h, maxX = -1, maxY = -1, touchesEdge = false;
      let inside = 0;
      queue[tail++] = start;
      visited[start] = 1;
      while (head < tail) {
        const index = queue[head++], x = index % w, y = Math.floor(index / w);
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        if (left + x >= original.left && left + x < original.right &&
            top + y >= original.top && top + y < original.bottom) inside++;
        touchesEdge ||= x === 0 || y === 0 || x === w - 1 || y === h - 1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const next = ny * w + nx;
          if (candidate[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
        }
      }
      const componentWidth = maxX - minX + 1, componentHeight = maxY - minY + 1;
      const longRule = componentWidth > w * .8 && componentHeight < Math.max(3, h * .08) ||
        componentHeight > h * .8 && componentWidth < Math.max(3, w * .08);
      // OCR boxes have padding around letters. Edge-connected and rule-like
      // components are likely bubble borders or artwork crossing the box.
      // Padding recovers clipped descenders and small detached accents.
      // Artwork mostly outside the OCR box must not enter the repair mask.
      const detachedAccent = componentWidth <= box.height * .35 && componentHeight <= box.height * .35 &&
        left + minX >= original.left && left + maxX < original.right;
      if (touchesEdge || longRule || (inside < tail * .5 && !detachedAccent)) continue;
      for (let i = 0; i < tail; i++) {
        const index = queue[i];
        mask[(top + Math.floor(index / w)) * width + left + index % w] = 1;
      }
    }
  }
  return mask;
}

function expandGlyphMask(mask, width, height) {
  // Cover antialiased edges and light compression fringes around the detected ink.
  const expanded = new Uint8Array(mask);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (mask[index]) continue;
    for (let dy = -glyphMargin; dy <= glyphMargin && !expanded[index]; dy++) for (let dx = -glyphMargin; dx <= glyphMargin; dx++) {
      if (dx * dx + dy * dy > glyphMargin * glyphMargin) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        expanded[index] = 1;
        break;
      }
    }
  }
  return expanded;
}

// Find large textured or solid graphics on the flattened slide. Measure
// midtone variation so black lettering on a flat background contributes
// less than the mix of tones in a photograph.
function embeddedGraphicBounds(context) {
  const { width, height } = context.canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const step = Math.max(12, Math.round(Math.min(width, height) / 45));
  const columns = Math.ceil(width / step), rows = Math.ceil(height / step);
  const textured = new Uint8Array(columns * rows);
  const tones = new Uint16Array(16);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    tones.fill(0);
    let count = 0;
    for (let y = row * step; y < Math.min(height, (row + 1) * step); y += 2)
      for (let x = column * step; x < Math.min(width, (column + 1) * step); x += 2) {
        const i = (y * width + x) * 4;
        tones[Math.floor((.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2]) / 16)]++;
        count++;
      }
    const populated = tones.filter(tone => tone >= count * .035).length;
    const darkCoverage = tones.subarray(0, 9).reduce((sum, tone) => sum + tone, 0) / count;
    textured[row * columns + column] = Number(populated >= 6 || darkCoverage >= .8);
  }
  const pictures = [];
  for (let start = 0; start < textured.length; start++) {
    if (!textured[start]) continue;
    const queue = [start];
    textured[start] = 0;
    let left = columns, right = 0, top = rows, bottom = 0;
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head], x = index % columns, y = Math.floor(index / columns);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        const next = ny * columns + nx;
        if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || !textured[next]) continue;
        textured[next] = 0;
        queue.push(next);
      }
    }
    const w = right - left, h = bottom - top;
    if (w < 5 || h < 5 || queue.length < w * h * .14) continue;
    pictures.push({ left: left * step, top: top * step, right: right * step, bottom: bottom * step });
  }
  return pictures;
}

function isInsidePicture(box, pictures) {
  return pictures.some(({ left, top, right, bottom }) => {
    const width = Math.max(0, Math.min(right, box.x + box.width) - Math.max(left, box.x));
    const height = Math.max(0, Math.min(bottom, box.y + box.height) - Math.max(top, box.y));
    return width * height >= box.width * box.height * .6;
  });
}

// A long diagram connector spans both axes but leaves most of its ink
// bounds empty. Require substantial horizontal and vertical extent so thin
// upright glyphs such as 1 and I remain eligible.
function isSparseConnector(crop) {
  const { width, height } = crop;
  const { data } = crop.getContext('2d').getImageData(0, 0, width, height);
  const gray = new Uint8Array(width * height);
  let min = 255, max = 0;
  for (let i = 0; i < gray.length; i++) {
    const pixel = i * 4;
    const value = Math.round(.299 * data[pixel] + .587 * data[pixel + 1] + .114 * data[pixel + 2]);
    gray[i] = value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (max - min < 48) return false;
  const threshold = (min + max) / 2;
  let dark = 0;
  for (const value of gray) if (value < threshold) dark++;
  const inkIsDark = dark <= gray.length / 2;
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if ((gray[y * width + x] < threshold) !== inkIsDark) continue;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const inkWidth = right - left + 1, inkHeight = bottom - top + 1;
  const inkCount = inkIsDark ? dark : gray.length - dark;
  return inkWidth >= 20 && inkHeight >= 20 &&
    inkWidth >= inkHeight * .45 && inkWidth <= inkHeight * 2.2 &&
    inkCount < inkWidth * inkHeight * .12;
}

const fontCandidates = ['Arial', 'Calibri', 'Aptos', 'Helvetica Neue', 'Verdana',
  'Tahoma', 'Times New Roman', 'Georgia', 'Cambria', 'Courier New'];

function glyphSignature(bounds, inkAt) {
  let left = bounds.right, right = bounds.left - 1, top = bounds.bottom, bottom = bounds.top - 1;
  for (let y = bounds.top; y < bounds.bottom; y++) for (let x = bounds.left; x < bounds.right; x++) {
    if (inkAt(x, y) < .5) continue;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) return;
  const width = right - left + 1, height = bottom - top + 1;
  const rows = 24, columns = 96;
  const samples = new Float32Array(rows * columns);
  for (let y = 0; y < rows * 2; y++) for (let x = 0; x < columns * 2; x++) {
    samples[Math.floor(y / 2) * columns + Math.floor(x / 2)] +=
      inkAt(left + Math.floor((x + .5) * width / (columns * 2)),
        top + Math.floor((y + .5) * height / (rows * 2))) / 4;
  }
  return { samples, aspect: width / height };
}

function matchExtractedFont(text, box, context, mask, glyphs) {
  if ((text.match(/[\p{Script=Latin}\p{N}]/gu)?.length ?? 0) < 5 || text.length > 140) return;
  const { width, height } = context.canvas;
  const source = glyphSignature(pixelBounds(box, width, height, 0), (x, y) => mask[y * width + x]);
  if (!source) return;
  const probe = 'mwMWil1Q0';
  const fallbackWidths = ['monospace', 'serif'].map(fallback => {
    glyphs.font = `48px ${fallback}`;
    return glyphs.measureText(probe).width;
  });
  const scores = [];
  for (const family of fontCandidates) {
    const available = ['monospace', 'serif'].some((fallback, index) => {
      glyphs.font = `48px "${family}", ${fallback}`;
      return Math.abs(glyphs.measureText(probe).width - fallbackWidths[index]) > .1;
    });
    if (!available) continue;
    for (const bold of [false, true]) {
      const font = `${bold ? 'bold ' : ''}48px "${family}"`;
      glyphs.font = font;
      const metrics = glyphs.measureText(text);
      glyphs.canvas.width = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) + 4;
      glyphs.canvas.height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 4;
      glyphs.font = font;
      glyphs.fillText(text, metrics.actualBoundingBoxLeft + 2, metrics.actualBoundingBoxAscent + 2);
      const { width, height } = glyphs.canvas;
      const { data } = glyphs.getImageData(0, 0, width, height);
      const rendered = glyphSignature({ left: 0, top: 0, right: width, bottom: height },
        (x, y) => data[(y * width + x) * 4 + 3] / 255);
      if (!rendered) continue;
      let difference = 0, union = 0;
      for (let i = 0; i < source.samples.length; i++) {
        difference += Math.abs(source.samples[i] - rendered.samples[i]);
        union += Math.max(source.samples[i], rendered.samples[i]);
      }
      const score = difference / union + .25 * Math.abs(Math.log(source.aspect / rendered.aspect));
      scores.push({ family, bold, score });
    }
  }
  scores.sort((a, b) => a.score - b.score);
  const [best, runnerUp] = scores;
  if (best && runnerUp && best.score < .40 && runnerUp.score - best.score >= .025) return best;
}

async function eraseText(context, boxes, contextBoxes, engine, glyphMask) {
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
  const holes = boxes.map(box => pixelBounds(box, width, height, glyphSearchPadding(box) + glyphMargin));
  const neighborMask = contextBoxes.length
    ? expandGlyphMask(makeGlyphMask(context, contextBoxes), width, height)
    : null;
  // Keep the background between strokes available to the model. Neighboring
  // glyphs are hidden from the model but only target glyphs are composited.
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
      const keep = !glyphMask[source] && !neighborMask?.[source];
      hasBackground ||= keep;
      mask[i] = aot ? Number(!keep) : Number(keep) * 255;
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
        if (!glyphMask[y * width + x] || neighborMask?.[y * width + x]) continue;
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

function erasedInkBounds(before, after, region, ink) {
  const [r, g, b] = ink.match(/../g).map(channel => parseInt(channel, 16));
  const { left, top, right, bottom } = pixelBounds(region, before.width, before.height, 0);
  let minX = right, minY = bottom, maxX = left - 1, maxY = top - 1;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const i = (y * before.width + x) * 4;
    if (Math.hypot(before.data[i] - r, before.data[i + 1] - g, before.data[i + 2] - b) > 40 ||
        Math.hypot(before.data[i] - after.data[i], before.data[i + 1] - after.data[i + 1],
          before.data[i + 2] - after.data[i + 2]) < 35) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX) return;
  return { x: minX / before.width, y: minY / before.height,
    width: (maxX - minX + 1) / before.width, height: (maxY - minY + 1) / before.height };
}

function textLanguage(text) {
  if (/[ăđơưũĩạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu.test(text)) return 'vi-VN';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja-JP';
  if (/\p{Script=Hangul}/u.test(text)) return 'ko-KR';
  if (/\p{Script=Hebrew}/u.test(text)) return 'he';
  return undefined;
}

// The preliminary read can lose tone marks or whole accented letters.
function likelyVietnamese(text) {
  if (textLanguage(text) === 'vi-VN') return true;
  const folded = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
  const words = folded.match(/\p{L}+/gu) ?? [];
  const phrase = words.join(' ');
  if (/\b(kinh te|giai phap|giao duc|viet nam|phat trien|bao ve|cong dong|thuc hien|ket luan|moi truong|du lich|giu gin|la phoi)\b/.test(phrase))
    return true;
  const common = new Set(['cua', 'nguoi', 'nhung', 'duoc', 'khong', 'trong', 'nhieu', 'chung',
    'chinh', 'minh', 'giua', 'nhan', 'nhat', 'tieng', 'viet', 'thuc', 'trien', 'phuong']);
  return new Set(words.filter(word => common.has(word))).size >= 2;
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

async function withOcr(callback, progress = () => {}) {
  progress('Loading OCR…');
  const { PaddleOcrService, V6_TINY_MODEL } = await import(/* @vite-ignore */ ocrModule);
  if (!V6_TINY_MODEL) throw new Error('The V6 medium OCR model is unavailable.');
  const service = new PaddleOcrService({ model: V6_TINY_MODEL });
  try {
    await service.initialize();
    progress('OCR model ready…');
    return await callback(service);
  } finally {
    await service.destroy();
  }
}

async function withVietnameseRecognizer(callback, progress) {
  progress('Loading OCR…');
  const moduleUrl = 'https://esm.sh/tesseract.js@6.0.1';
  const { createWorker, PSM } = await import(/* @vite-ignore */ moduleUrl);
  const worker = await createWorker('vie', 1, {
    langPath: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main',
    gzip: false,
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    return await callback(async crop => (await worker.recognize(crop)).data.text);
  } finally {
    await worker.terminate();
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

function enclosingBox(parts) {
  const x = Math.min(...parts.map(box => box.x));
  const y = Math.min(...parts.map(box => box.y));
  const width = Math.max(...parts.map(box => box.x + box.width)) - x;
  const height = Math.max(...parts.map(box => box.y + box.height)) - y;
  return { x, y, width, height };
}

function groupAdjacentLines(boxes, aspectRatio) {
  const follows = (upper, lower) => {
    const height = Math.min(upper.height, lower.height);
    const gap = lower.y - upper.y - upper.height;
    if (lower.y <= upper.y || gap < -height * .3 || gap > height * .65 ||
        Math.max(upper.height, lower.height) > height * 1.3) return false;
    const overlap = Math.min(upper.x + upper.width, lower.x + lower.width) - Math.max(upper.x, lower.x);
    if (overlap < Math.min(upper.width, lower.width) * .75) return false;
    const tolerance = height * .45 / aspectRatio;
    return Math.abs(upper.x - lower.x) <= tolerance ||
      Math.abs(upper.x + upper.width / 2 - lower.x - lower.width / 2) <= tolerance;
  };
  const next = new Map();
  const linked = new Set();
  for (const upper of boxes) {
    const below = boxes.filter(lower => follows(upper, lower));
    if (below.length !== 1 || boxes.filter(other => follows(other, below[0])).length !== 1) continue;
    next.set(upper, below[0]);
    linked.add(below[0]);
  }
  return boxes.filter(box => !linked.has(box)).map(box => {
    const parts = [box];
    for (let line = next.get(box); line; line = next.get(line)) parts.push(line);
    return parts;
  });
}

export async function detectImageTextRegions(shape, progress) {
  const job = openPicture(shape.id);
  progress('Loading OCR…');
  const context = await pictureCanvas(job.picture);
  const { width, height } = context.canvas;
  const { boxes } = await withOcr(service => {
    progress('Detecting text regions…');
    return service.detect(context.canvas);
  });
  const picture = job.current();
  const [l, t, r, b] = JSON.parse(job.crop).map(value => value / 100000);
  const pictures = embeddedGraphicBounds(context);
  const regions = boxes.flatMap(box => {
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
        box.width <= 0 || box.height <= 0 || isInsidePicture(box, pictures)) return [];
    const x = Math.max(0, l, box.x / width), y = Math.max(0, t, box.y / height);
    const w = Math.min(1, 1 - r, (box.x + box.width) / width) - x;
    const h = Math.min(1, 1 - b, (box.y + box.height) / height) - y;
    return w > 0 && h > 0 ? [{ x, y, width: w, height: h }] : [];
  });
  if (!regions.length) return false;
  const existing = pictureMarkers(picture.id);
  const newRegions = regions.filter(box => !existing.some(({ ocrRegion }) => ocrRegion.source === job.source && ocrRegion.crop === job.crop &&
        (ocrRegion.parts || [ocrRegion.box]).some(part =>
          Object.keys(box).every(key => Math.abs(part[key] - box[key]) < 0.001))));
  for (const parts of groupAdjacentLines(newRegions, width / height)) {
    const box = enclosingBox(parts);
    addShapeRaw({
      name: 'OCR region', type: 'rect', $_otag: 'sp', ...regionGeometry(picture, box),
      locked: true,
      solidFill: { uniClr: { ...blue.uniClr, alpha: { $_val: 9000 } } },
      ln: { solidFill: blue, $_w: 12700 },
      ocrRegion: { pictureId: picture.id, source: job.source, crop: job.crop, box, ...(parts.length > 1 ? { parts } : {}) },
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
  const box = enclosingBox(parts);
  const geometry = regionGeometry(job.picture, box);
  updateShape({ id: markers[0].id, ...geometry, d: `R0,0,${geometry.w},${geometry.h}`,
    ocrRegion: { ...first, box, parts } });
  for (const marker of markers.slice(1)) deleteShape({ delshp: marker.id, evt: null });
  await saveDexie();
}

export async function extractImageText(shapes, progress, engine = 'migan') {
  const markers = shapes.map(shape => getShapeDeep(shape.id));
  if (!markers.length || markers.some(marker => !marker?.ocrRegion))
    throw new Error('Select a detected text region.');
  const first = markers[0].ocrRegion;
  if (markers.some(marker => marker.ocrRegion.pictureId !== first.pictureId ||
      marker.ocrRegion.source !== first.source || marker.ocrRegion.crop !== first.crop))
    throw new Error('Extract regions from one picture at a time.');
  const job = openPicture(first.pictureId);
  if (first.source !== job.source || first.crop !== job.crop)
    throw new Error('The picture changed. Detect its text regions again.');
  const context = await pictureCanvas(job.picture);
  return extractRegions(job, context, markers, progress, engine);
}

// A colored picture bullet can be included in the same OCR box as its
// label. Look for a compact, differently colored block before a clear gap.
function trimGraphicBullet(box, pixels) {
  const { width, height, data } = pixels;
  const { left, top, right, bottom } = pixelBounds({
    x: box.x * width, y: box.y * height, width: box.width * width, height: box.height * height,
  }, width, height, 0);
  const lineHeight = bottom - top;
  if (lineHeight < 10 || right - left < lineHeight * 3) return box;
  const background = [0, 1, 2].map(channel => {
    const corners = [top * width + left, top * width + right - 1,
      (bottom - 1) * width + left, bottom * width + right - 1];
    const values = corners.map(index => data[index * 4 + channel]).sort((a, b) => a - b);
    return (values[1] + values[2]) / 2;
  });
  const columns = Array.from({ length: right - left }, () => [0, 0, 0, 0]);
  for (let x = left; x < right; x++) for (let y = top; y < bottom; y++) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.hypot(r - background[0], g - background[1], b - background[2]) < 95) continue;
    const column = columns[x - left];
    column[0] += r; column[1] += g; column[2] += b; column[3]++;
  }
  const start = columns.findIndex(column => column[3]);
  if (start < 0) return box;
  let end = start;
  while (end < columns.length && columns[end][3]) end++;
  let next = end;
  while (next < columns.length && !columns[next][3]) next++;
  if (end - start < lineHeight * .45 || end - start > lineHeight * 1.4 ||
      next - end < lineHeight * .23 || next - end > lineHeight * 1.1 ||
      columns.length - next < lineHeight * 2) return box;
  const color = (from, to) => {
    const sum = [0, 0, 0, 0];
    for (let x = from; x < to; x++) for (let c = 0; c < 4; c++) sum[c] += columns[x][c];
    return sum.slice(0, 3).map(channel => channel / sum[3]);
  };
  const bullet = color(start, end), label = color(next, columns.length);
  if (Math.max(...bullet) - Math.min(...bullet) < 40 ||
      Math.hypot(...bullet.map((channel, index) => channel - label[index])) < 90) return box;
  const x = (left + next) / width;
  return { ...box, x, width: box.x + box.width - x };
}

export async function extractImageTextAt(pictureId, point, { progress, highlight, active }) {
  const job = openPicture(pictureId);
  const context = await pictureCanvas(job.picture);
  if (!active()) return false;
  const { width, height } = context.canvas;
  const key = JSON.stringify([job.fileId, getSlidesSlideId(), pictureId, job.crop]);
  const cached = slideLanguageScan?.key === key && slideLanguageScan.sources.has(job.source)
    ? slideLanguageScan : undefined;
  const { boxes, vietnamese } = await withOcr(async service => {
    progress('Finding text regions…');
    const detection = await service.detect(context.canvas);
    if (cached || !active() || !detection.boxes.length)
      return { boxes: detection.boxes, vietnamese: cached?.vietnamese ?? false };
    progress('Checking slide language…');
    const { text } = await service.recognize(context.canvas, { strategy: 'per-line' });
    return { boxes: detection.boxes, vietnamese: likelyVietnamese(text.trim().normalize('NFC')) };
  }, progress);
  if (!active()) return false;
  job.current();
  if (!cached && boxes.length) slideLanguageScan = { key, sources: new Set([job.source]), vietnamese };
  const [l, t, r, b] = JSON.parse(job.crop).map(value => value / 100000);
  const pixels = context.getImageData(0, 0, width, height);
  const detected = boxes.flatMap(box => {
    const x = Math.max(l, box.x / width), y = Math.max(t, box.y / height);
    const right = Math.min(1 - r, (box.x + box.width) / width);
    const bottom = Math.min(1 - b, (box.y + box.height) / height);
    return right > x && bottom > y ? [{ x, y, width: right - x, height: bottom - y }] : [];
  });
  const regions = detected.filter(bullet => {
    const bulletWidth = bullet.width * width;
    const bulletHeight = bullet.height * height;
    if (bulletWidth > bulletHeight * 1.4) return true;
    return !detected.some(label => {
      const gap = (label.x - bullet.x - bullet.width) * width;
      if (gap < 0 || gap > bulletHeight * 1.1 || label.width * width < bulletHeight * 2 ||
          Math.abs(bullet.y + bullet.height / 2 - label.y - label.height / 2) > bullet.height * .4) return false;
      const pair = enclosingBox([bullet, label]);
      return trimGraphicBullet(pair, pixels).x >= bullet.x + bullet.width;
    });
  }).map(box => trimGraphicBullet(box, pixels));
  const x = l + point.x * (1 - l - r), y = t + point.y * (1 - t - b);
  const hit = regions.filter(box => x >= box.x && x <= box.x + box.width &&
    y >= box.y && y <= box.y + box.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  if (!hit) return false;
  const parts = groupAdjacentLines(regions, width / height).find(group => group.includes(hit));
  const box = enclosingBox(parts);
  highlight({ x: (box.x - l) / (1 - l - r), y: (box.y - t) / (1 - t - b),
    width: box.width / (1 - l - r), height: box.height / (1 - t - b) });
  const extracted = await extractRegions(job, context, [{ ocrRegion: { box, parts } }],
    progress, 'migan', active, vietnamese);
  if (extracted && active() && slideLanguageScan?.key === key)
    slideLanguageScan.sources.add(imageSource(getShapeDeep(pictureId)));
  return extracted;
}

async function extractRegions(job, context, markers, progress, engine, active, slideVietnamese = false) {
  const canvas = context.canvas;
  const interactive = Boolean(active);
  const toPixels = box => ({ x: box.x * canvas.width, y: box.y * canvas.height,
    width: box.width * canvas.width, height: box.height * canvas.height });
  const cropLine = (region, margin = 0) => {
    // Vietnamese tone marks can sit outside a tight detected line.
    const line = { ...region, y: region.y - margin, height: region.height + margin * 2 };
    const { left, top, right, bottom } = pixelBounds(line, canvas.width, canvas.height, 0);
    const crop = document.createElement('canvas');
    crop.width = right - left;
    crop.height = bottom - top;
    const cropContext = crop.getContext('2d');
    cropContext.fillStyle = '#fff';
    cropContext.fillRect(0, 0, crop.width, crop.height);
    cropContext.drawImage(canvas, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return crop;
  };
  const records = markers.map(marker => {
    const selection = marker.ocrRegion;
    const region = toPixels(selection.box);
    const holes = (selection.parts || [selection.box]).map(toPixels).sort((a, b) => a.y - b.y || a.x - b.x);
    return { marker, selection, region, holes };
  });
  const pictures = interactive ? [] : embeddedGraphicBounds(context);
  const validation = document.createElement('canvas').getContext('2d');
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = '100px Arial';
  const normalize = text => text.trim().normalize('NFC');
  const logResult = (record, lineIndex, model, text) => console.info('[Image text extraction] Raw OCR result', {
    shapeId: record.marker.id,
    line: lineIndex + 1,
    model,
    text,
    codePoints: Array.from(text, char => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`),
  });
  await withOcr(async service => {
    const recognize = async crop => (await service.recognize(crop, { strategy: 'per-line', minimumConfidence: interactive ? 0 : .6 })).text;
    const verify = async (crop, text, read = recognize) => {
      // Illustrations can produce short, isolated OCR tokens. Check that the
      // crop could plausibly contain the token and that it survives a second
      // reading with the color removed and a little surrounding whitespace.
      if (/^[\p{L}\p{N}]{1,2}$/u.test(text)) {
        const metrics = measure.measureText(text);
        const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
        const { width, height } = crop;
        if (inkHeight > 0 && width / height > Math.max(1.25, 1.8 * inkWidth / inkHeight)) return false;
        const padding = Math.max(2, Math.ceil(height * .08));
        validation.canvas.width = width + padding * 2;
        validation.canvas.height = height + padding * 2;
        validation.fillStyle = '#fff';
        validation.fillRect(0, 0, validation.canvas.width, validation.canvas.height);
        validation.filter = 'grayscale(1)';
        validation.drawImage(crop, padding, padding);
        if (normalize(await read(validation.canvas)) !== text) return false;
      }
      return Boolean(text);
    };
    for (const [index, record] of records.entries()) {
      const rawLines = [];
      for (const [lineIndex, hole] of record.holes.entries()) {
        progress(`Reading box ${index + 1} of ${records.length} · line ${lineIndex + 1} of ${record.holes.length}…`);
        if (isInsidePicture(hole, pictures)) break;
        const crop = cropLine(hole);
        if (!interactive && isSparseConnector(crop)) break;
        const rawText = await recognize(crop);
        logResult(record, lineIndex, 'PP-OCRv6 medium', rawText);
        const text = normalize(rawText);
        // Keep isolated OCR fragments out of the inpainting mask. Count
        // Unicode letters and digits so accents and punctuation add no length.
        if (!interactive && record.holes.length === 1 && (text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) <= 3) break;
        if (!(interactive ? text : await verify(crop, text))) break;
        rawLines.push(rawText);
      }
      if (rawLines.length !== record.holes.length) continue;
      record.rawLines = rawLines;
    }
  }, progress);
  const candidates = records.filter(record => record.rawLines);
  const vietnamese = candidates.length > 0 && (slideVietnamese || candidates.some(record => likelyVietnamese(normalize(record.rawLines.join(' ')))));
  if (vietnamese) {
    await withVietnameseRecognizer(async recognize => {
      for (const record of candidates) {
        for (const [lineIndex, hole] of record.holes.entries()) {
          const preliminary = normalize(record.rawLines[lineIndex]);
          if (/[^\p{Script=Latin}\p{N}\p{M}\p{P}\p{S}\s]/u.test(preliminary)) continue;
          const rawText = await recognize(cropLine(hole, glyphSearchPadding(hole)));
          logResult(record, lineIndex, 'Tesseract Vietnamese', rawText);
          const text = normalize(rawText);
          if (text && (interactive || record.holes.length > 1 || (text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) > 3))
            record.rawLines[lineIndex] = rawText;
        }
      }
    }, progress);
  }
  for (const record of candidates) {
    record.rawText = record.rawLines.join('\n');
    record.text = record.rawLines.map(normalize).join('\n');
  }
  const readable = records.filter(record => record.text);
  if (!readable.length || (interactive && !active())) return false;
  for (const record of interactive ? [] : records) {
    const currentMarker = getShapeDeep(record.marker.id);
    if (!currentMarker || JSON.stringify(currentMarker.ocrRegion) !== JSON.stringify(record.selection))
      throw new Error('A selected region changed during extraction.');
  }
  const current = job.current();
  const allRegions = pictureMarkers(current.id)
    .filter(shape => shape.ocrRegion.source === job.source && shape.ocrRegion.crop === job.crop);
  const neighbors = allRegions.filter(shape => !markers.some(marker => marker.id === shape.id))
    .flatMap(shape => (shape.ocrRegion.parts || [shape.ocrRegion.box]).map(toPixels));

  progress(`Extracting…`);
  const before = context.getImageData(0, 0, canvas.width, canvas.height);
  const targetHoles = readable.flatMap(record => record.holes);
  const glyphMask = makeGlyphMask(context, targetHoles);
  if (interactive) {
    const glyphs = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    for (const record of readable) {
      const lines = record.rawLines.map(normalize);
      const longest = lines.reduce((best, line, index) => line.length > lines[best].length ? index : best, 0);
      record.fontMatch = matchExtractedFont(lines[longest], record.holes[longest], context, glyphMask, glyphs);
    }
  }
  const cleaned = await eraseText(context, targetHoles, neighbors, engine,
    expandGlyphMask(glyphMask, canvas.width, canvas.height));
  if (interactive && !active()) return false;
  const after = context.getImageData(0, 0, canvas.width, canvas.height);
  const media = await processImage(cleaned, {
    fileId: job.fileId,
    name: editTextMediaName(genId(), job.source),
  });
  if (interactive && !active()) return false;
  if (!media?.name) throw new Error('Could not store the cleaned picture.');
  const currentPicture = job.current();
  const { dataUrl, ...blip } = currentPicture.blipFill.blip;
  updateShape({ id: currentPicture.id, blipFill: { ...currentPicture.blipFill, blip: {
    ...blip, $_target: media.name, $_w: media.w, $_h: media.h,
  } } });
  for (const sibling of allRegions) {
    if (!readable.some(record => record.marker.id === sibling.id))
      updateShape({ id: sibling.id, ocrRegion: { ...sibling.ocrRegion, source: media.name } });
  }
  for (const record of readable) {
    const { marker, selection, region, text } = record;
    let geometry = regionGeometry(currentPicture, selection.box);
    const ink = estimateInkColor(before, after, region);
    const lang = textLanguage(text) || (vietnamese ? 'vi-VN' : undefined);
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const centered = selection.parts?.length > 1 &&
      selection.parts.some(part => Math.abs(part.x - selection.box.x) > selection.box.height * .08) &&
      selection.parts.every(part => Math.abs(part.x + part.width / 2 - selection.box.x -
        selection.box.width / 2) <= selection.box.height * .08);
    const paragraphProperties = {
      ...(lang === 'he' ? { $_rtl: 1 } : {}),
      ...(centered ? { $_algn: 'ctr' } : {}),
    };
    const family = record.fontMatch?.family ?? 'Arial';
    const bold = record.fontMatch?.bold;
    measure.font = `${bold ? 'bold ' : ''}100px "${family}"`;
    const measuredWidth = Math.max(...lines.map(line => measure.measureText(line).width));
    const lineHeight = geometry.h / lines.length;
    let size = Math.min(lineHeight * 0.8, measuredWidth > 0 ? geometry.w * 100 / measuredWidth : lineHeight);
    // The OCR box and the font advance can both be asymmetric around a digit.
    // Fit the visible ink and offset the text origin by the glyph's bearing.
    if (ink && /^[\p{L}\p{N}]\p{M}*$/u.test(text)) {
      const box = erasedInkBounds(before, after, region, ink);
      const metrics = measure.measureText(text);
      const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      if (box && inkHeight > 0 && fontHeight > 0) {
        const sx = geometry.w / selection.box.width;
        const sy = geometry.h / selection.box.height;
        const scale = box.height * sy / inkHeight;
        size = scale * 100;
        geometry = regionGeometry(currentPicture, {
          x: box.x + box.width / 2 + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) * scale / (2 * sx),
          y: box.y + box.height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent -
            2 * metrics.fontBoundingBoxAscent) * scale / (2 * sy),
          width: metrics.width * scale / sx,
          height: fontHeight * scale / sy,
        });
      }
    }
    const { w, h } = geometry;
    const shape = {
      id: marker.id, ocrRegion: null, locked: false, solidFill: null, hideSpinHandle: true,
      name: 'Extracted text', type: 'text', $_otag: 'sp',
      ...geometry, d: `R0,0,${w},${h}`, noFill: true, ln: { noFill: true },
      txBody: {
        bodyPr: { $_wrap: 'none', $_anchor: 'ctr', $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 },
        p: lines.map(line => ({ pPr: paragraphProperties, r: [{ t: line, rPr: {
          $_sz: Math.max(100, Math.round(size * 75)), latin: { $_typeface: family },
          ...(bold ? { $_b: 1 } : {}),
          ...(lang ? { $_lang: lang } : {}),
          ...(ink ? { solidFill: { uniClr: { $_otag: 'srgbClr', $_val: ink } } } : {}),
        } }] })),
      },
    };
    const id = interactive ? addShapeRaw(shape).id : marker.id;
    if (!interactive) updateShape(shape);
    const paragraphs = getShapeDeep(id)?.txBody?.p;
    const storedText = paragraphs?.map(paragraph => paragraph.r.map(run => run.t).join('')).join('\n');
    const expectedText = lines.join('\n');
    const matches = storedText?.normalize('NFC') === expectedText;
    const diagnostic = { shapeId: marker.id, rawOcrText: record.rawText, expectedText, storedText, matches };
    if (matches) console.debug('[Image text extraction] OCR text comparison', diagnostic);
    else console.warn('[Image text extraction] OCR text differs from shape text', diagnostic);
  }
  await saveDexie();
  return readable.length;
}
