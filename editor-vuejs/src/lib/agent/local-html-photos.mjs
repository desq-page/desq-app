import { parseSlideHTML } from './html-slides.mjs';
import { reflowLocalHTML } from './local-html-reflow.mjs';

export function photoDirection(request, title, layout, budget) {
  if (budget <= 0 || !layout?.photoSlots?.length || /\b(?:text[- ]only|no (?:photos?|pictures?|images?)|without (?:photos?|pictures?|images?))\b|纯文字|不要图片|不使用图片/i.test(request)) return undefined;
  const topic = request.match(/about this topic:\s*([^\n]+)/i)?.[1] || title;
  const words = topic.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu) || [];
  const query = words.slice(0,4).join(' ').slice(0,160) || title.slice(0,160);
  return { query, alt: `${title} — supporting photograph`.slice(0,200), slot:layout.photoSlots[0] };
}

// A reference is advisory, so restore a real image request when the model drops
// the selected photo slot. Reflow text beside it rather than painting over text.
export function restoreLocalPhoto(html, { request, title, layout, budget, design }) {
  const direction = photoDirection(request,title,layout,budget);
  if (!direction) return undefined;
  const root = parseSlideHTML(html);
  if (root.querySelector('img')) return undefined;
  const image = root.ownerDocument.createElement('img');
  image.setAttribute('data-query',direction.query);
  image.setAttribute('alt',direction.alt);
  image.setAttribute('data-host-photo','true');
  image.style.cssText='position:absolute;left:752px;top:176px;width:472px;height:360px;object-fit:cover';
  root.append(image);
  const result = reflowLocalHTML(root.outerHTML,{title,design,reservePhoto:true});
  return {...result,photoRestored:true,adjustments:['Restored the selected template photo slot as a resolvable image request.',...result.adjustments]};
}
