// Extract local raster bytes before the strict HTML layout sandbox strips src.
// Resource URLs never pass through to the compiler or image-search resolver.
export async function prepareEmbeddedHtmlImages(source, { document = globalThis.document, measure = imageDimensions } = {}) {
  const parsed = new document.defaultView.DOMParser().parseFromString(source, 'text/html');
  const images = new Map(), bySource = new Map();
  for (const image of parsed.querySelectorAll('img[src]')) {
    const src = image.getAttribute('src').trim();
    const match = /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[a-z\d+/=\s]+$/i.exec(src);
    if (!match) continue;
    let asset = bySource.get(src);
    if (!asset) {
      const {w,h} = await measure(src);
      if (![w,h].every(value => Number.isFinite(value) && value > 0)) throw Error('Embedded image has invalid dimensions.');
      const name = `html-image-${images.size + 1}.${match[1].toLowerCase().replace('jpg','jpeg')}`;
      asset = {name,w,h,data:src}; images.set(name,asset); bySource.set(src,asset);
    }
    image.removeAttribute('src'); image.removeAttribute('srcset');
    image.setAttribute('data-desq-embedded-image',asset.name);
    image.setAttribute('data-query',(image.getAttribute('alt') || 'Embedded image').slice(0,160));
    if (!image.getAttribute('alt')) image.setAttribute('alt','Embedded image');
    if (!image.hasAttribute('width')) image.setAttribute('width',String(asset.w));
    if (!image.hasAttribute('height')) image.setAttribute('height',String(asset.h));
  }
  return {source:images.size ? '<!doctype html>'+parsed.documentElement.outerHTML : source,images};
}
async function imageDimensions(source) {
  const blob=await (await fetch(source)).blob();
  if (globalThis.createImageBitmap) {
    const bitmap=await createImageBitmap(blob);
    const size={w:bitmap.width,h:bitmap.height}; bitmap.close(); return size;
  }
  const url=URL.createObjectURL(blob);
  try {const image=new Image();image.src=url;await image.decode();return {w:image.naturalWidth,h:image.naturalHeight};}
  finally {URL.revokeObjectURL(url);}
}
export function embeddedHtmlAssets(deck, images, document=globalThis.document) {
  const assets=new Map();
  for (const [pageIndex,slide] of deck.slides.entries()) {
    const template=document.createElement('template');template.innerHTML=slide.html;
    for (const [index,image] of [...template.content.querySelectorAll('img')].entries()) {
      const asset=images.get(image.getAttribute('data-desq-embedded-image'));
      if(asset)assets.set(`${pageIndex}:svg:${index}`,{media:{name:asset.name,w:asset.w,h:asset.h}});
    }
  }
  return assets;
}
