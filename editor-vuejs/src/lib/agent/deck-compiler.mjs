import { validateMorphPairs } from "./morph-pairs.mjs";
import { imagePlaceholderCaption } from './image-search-caption.mjs';
import { promoteSlideBackground } from './slide-background.mjs';
import { editorColor } from './colors.mjs';
import { resolveAutoshape } from './autoshape-catalog.mjs';
import { nativeChartPart } from './deck-chart.mjs';
import { deckDesign, slideDesign, legibleInk, tint } from './deck-design.mjs';
import { wrapDeckText } from './deck-text.mjs';
import { compilePageSVG, svgImageRequests } from './ppt-master-svg.mjs';
import { markdownPageSVG } from './markdown-slides.mjs';
import { htmlToSVG } from './html-slides.mjs';
import {compileMotion} from './ppt-master-motion.mjs';

// Authored SVG/HTML -> native Desq objects. No model code is executed.
export function compileDeck(deck, { width, height, genId, geometry, assets = new Map(), measureText,outlineText,deferTextOutlines=false } = {}) {
  if (![width, height].every(Number.isFinite) || width < 300 || height < 200 || width > 10000 || height > 10000)
    throw new Error('Unsupported presentation dimensions.');
  if (!deck.title.trim() || !deck.audience.trim() || !deck.objective.trim()) throw new Error('Deck title, audience and objective are required.');
  const sharedDesign = deckDesign(deck.design);
  const sx = width / 1280, sy = height / 720, scale = Math.min(sx, sy);
  const warnings = [], pages = [];
  let imageCount = 0;
  for (const [pageIndex, slide] of deck.slides.entries()) {
    const design = slideDesign(sharedDesign, slide, pageIndex), dark = design.tone !== 'base' || deck.design?.style === 'dark';
    if (!slide.title.trim() || !slide.purpose.trim()) throw new Error(`Slide ${pageIndex + 1} needs a title and purpose.`);
    if(['svg','html','markdown'].includes(slide.layout)) {
      const svg = slide.layout === 'markdown' ? markdownPageSVG(slide,{design:sharedDesign,measureText,onWarning:warning=>warnings.push(`Slide ${pageIndex+1}: ${warning}`)}) : slide.layout === 'html' ? htmlToSVG(slide.html, { onWarning: warning => warnings.push(`Slide ${pageIndex + 1}: ${warning}`) }) : slide.svg;
      if (slide.layout === 'html' && slide.svg) throw Error('HTML pages use html, not a model-supplied svg fallback.');
      if(slide.body||slide.bullets?.length||slide.items?.length||slide.elements?.length||slide.images?.length) throw Error(`${slide.layout.toUpperCase()} pages put every object in ${slide.layout}, not legacy layout fields.`);
      let page = compilePageSVG(svg,{width,height,genId,geometry,assets,pageIndex,measureText,booleans:slide.booleans,language:deck.language,outlineText,deferTextOutlines});
      // HTML rows already use browser wrapping. Keep their explicit line breaks and
      // rich runs rather than asking the preview/PowerPoint to re-wrap estimated widths.
      if (slide.layout === 'html') for (const shape of page.shapes) if (shape.txBody)
        shape.txBody.bodyPr.$_wrap = 'none';
      const imageEntries=[...assets.entries()].filter(([key,a])=>key.startsWith(`${pageIndex}:svg:`)&&!a.placeholder&&page.usedImageKeys.includes(key));
      const imageCredits=imageEntries.map(([key,a])=>({key,title:a.title,author:a.author,license:a.license,url:a.sourceUrl}));
      const creditLabel=a=>[a.title,a.author,a.license].filter(Boolean).join(' / ')+(a.sourceUrl?' / Source':'');
      const credited=[],seen=new Set(),fallbackAssets=new Map(assets);
      let replaced=false;
      for(const [key,asset] of imageEntries){
        const signature=JSON.stringify([asset.title,asset.author,asset.license,asset.sourceUrl]);
        if(seen.has(signature))continue;
        const candidate=[...credited.map(([,a])=>creditLabel(a)),creditLabel(asset)].join(' · ');
        if(wrapDeckText(candidate,1248,7,'Arial',measureText).length>2){
          const warning=`Slide ${pageIndex+1}: retained an image placeholder because its full attribution could not fit the credit footer.`;
          for(const [duplicateKey,duplicate] of imageEntries)if(JSON.stringify([duplicate.title,duplicate.author,duplicate.license,duplicate.sourceUrl])===signature)
            fallbackAssets.set(duplicateKey,{placeholder:true,warning});
          replaced=true;
          warnings.push(warning);
        }else credited.push([key,asset]);
        seen.add(signature);
      }
      if(replaced)page=compilePageSVG(svg,{width,height,genId,geometry,assets:fallbackAssets,pageIndex,measureText,booleans:slide.booleans,language:deck.language,outlineText,deferTextOutlines});
      if (slide.layout === 'html') for (const shape of page.shapes) if (shape.txBody)shape.txBody.bodyPr.$_wrap='none';
      if(credited.length){
        const rPr={$_sz:Math.round(7*scale*100),latin:{$_typeface:'Arial'},solidFill:editorColor('#334455')};
        const runs=[];
        for(const [index,[,asset]] of credited.entries()){
          runs.push({t:(index?' · ':'')+[asset.title,asset.author,asset.license].filter(Boolean).join(' / '),rPr:{...rPr}});
          if(asset.sourceUrl){
            let target;try{const url=new URL(asset.sourceUrl);if(['http:','https:'].includes(url.protocol))target=url.href;}catch{}
            runs.push({t:' / Source',rPr:{...rPr,...(target?{hlinkClick:{$_target:target}}:{})}});
          }
        }
        page.shapes.push({id:genId(),name:'Image credits',type:'text',autosize:true,$_otag:'sp',x:16*sx,y:694*sy,w:1248*sx,h:26*sy,solidFill:editorColor('#FFFFFF'),ln:{noFill:true},
          txBody:{bodyPr:{$_wrap:'square',$_anchor:'t',$_lIns:0,$_rIns:0,$_tIns:0,$_bIns:0},p:[{r:runs}]}});
      }
      imageCount += svgImageRequests(svg,pageIndex).length;
      if(imageCount>8)throw Error('Use at most eight images in a deck.');
      const motion=compileMotion(slide.motion,page.shapes,{width,height});
      pages.push({name:slide.title,shapes:page.shapes,showMaster:'0',transition:{advClick:1},...motion,agentMetadata:{version:3,engine:slide.layout === 'markdown' ? 'markdown-native' : slide.layout === 'html' ? 'html-native' : 'ppt-master-svg',deckTitle:deck.title,purpose:slide.purpose,layout:slide.layout,strategy:deck.strategy,...(slide.templateSelection?{templateSelection:slide.templateSelection}:{}),...(slide.overflowContent?{overflowContent:slide.overflowContent}:{}),...(slide.layout==='markdown'?{markdown:slide.markdown,generationModel:deck.generationModel}:{}),...(imageCredits.length?{imageCredits}:{}),sourceCommit:'b113d23720260c411ee47b2b05a73615f954deeb'}});
      warnings.push(...page.warnings); continue;
    }
    const shapes = [], textRegions = [];
    const base = (name, x, y, w, h) => ({ id: genId(), name, x: x * sx, y: y * sy, w: w * sx, h: h * sy });
    const paragraph = (p, size, color, bold = false) => ({ id: genId(),
      pPr: { $_algn: 'l', spcAft: { spcPts: { $_val: Math.round(size * scale * 40) } },
        ...(p.bullet ? { buChar: { $_char: '•' }, $_marL: Math.round(size * scale * 1.25 * 12700), $_indent: -Math.round(size * scale * .75 * 12700) } : {}) },
      r: (p.runs?.length ? p.runs : [{ text: p.text || '' }]).map(r => ({ t: r.text,
        rPr: { $_sz: Math.round(size * scale * 100), ...(r.bold ?? bold ? { $_b: 1 } : {}), ...(r.italic ? { $_i: 1 } : {}),
          latin: { $_typeface: design.fontFamily }, solidFill: editorColor(r.color || color) } })),
    });
    const fit = (paragraphs, w, h, preferred, minimum = 14) => {
      const estimate = size => paragraphs.reduce((total, p) => {
        const text = p.runs?.map(r => r.text).join('') ?? p.text ?? '';
        const available = Math.max(1, w - (p.bullet ? size * 2 : 0));
        const lines = wrapDeckText(text, available, size, design.fontFamily, measureText).length;
        return total + lines * size * 4 / 3 * 1.25 + size * .45;
      }, 0);
      let size = preferred;
      while (size > Math.min(minimum, preferred) && estimate(size) > h) size -= 1;
      if (estimate(size) > h) throw new Error(`Slide ${pageIndex + 1}: text does not fit (${slide.title}). Shorten it or give it more space.`);
      return size;
    };
    const text = (name, x, y, w, h, content, size = 22, color = design.foreground, bold = false) => {
      const paragraphs = typeof content === 'string' ? content.split('\n').map(text => ({ text })) : content;
      const fitted = fit(paragraphs, w, h, size);
      const shape = { ...base(name, x, y, w, h), type: 'text', autosize: true, $_otag: 'sp', noFill: true, ln: { noFill: true },
        txBody: { bodyPr: { $_wrap: 'square', $_anchor: 't', $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 }, p: paragraphs.map(p => paragraph(p, fitted, color, bold)) } };
      shape.d = `R0,0,${shape.w},${shape.h}`;
      shapes.push(shape); textRegions.push(shape); return shape;
    };
    const preset = (name, x, y, w, h, fill = design.accent, shapeName = 'rect') => {
      const preset = resolveAutoshape(shapeName), prstGeom = { $_prst: preset.id, avLst: {} };
      const b = base(name, x, y, w, h);
      const info = geometry(prstGeom, b.w, b.h);
      if (!info?.d || /NaN|Infinity|undefined|null/.test(info.d)) throw new Error(`Cannot construct ${shapeName}.`);
      const shape = { ...b, type: preset.id === 'ellipse' ? 'ellipse' : preset.name.toLowerCase(),
        $_otag: /Connector/.test(preset.id) ? 'cxnSp' : 'sp', d: info.d, prstGeom,
        ...(info.pathTransform ? { pathTransform: info.pathTransform } : {}),
        ...(info.prstTxMargin ? { prstTxMargin: info.prstTxMargin } : {}),
        ...(preset.noFill ? { noFill: true } : { solidFill: editorColor(fill) }),
        ln: preset.noFill ? { solidFill: editorColor(fill) } : { noFill: true } };
      shapes.push(shape); return shape;
    };
    const image = (descriptor, key, x, y, w, h) => {
      imageCount++;
      if (imageCount > 8) throw new Error('Use at most eight images in a deck.');
      const asset = assets.get(key);
      if (!asset) return; // Preflight layout pass; final compilation requires assets in the adapter.
      if (asset.placeholder) {
        const frame = preset('Image placeholder', x, y, w, h, dark ? '#243D50' : '#EDF2F6');
        frame.imagePlaceholder = { description: descriptor.query, alt: descriptor.alt, searchQueries: asset.searchQueries || [] };
        // Keep even very small custom image slots usable without failing the deck's text-fit preflight.
        const inset = Math.min(16, w / 10, h / 10);
        const caption = imagePlaceholderCaption(descriptor.query, asset);
        const size = Math.max(.1, Math.min(18, (w - inset * 2) / 16, (h - inset * 2) / 30));
        text('Image description', x + inset, y + inset, w - inset * 2, h - inset * 2, caption, size, design.muted);
        textRegions.pop(); // Image slots may intentionally have overlaid labels in custom layouts.
        warnings.push(asset.warning || `Image placeholder for “${descriptor.query}”.`);
        return;
      }
      if (!asset.media?.name || !asset.media.w || !asset.media.h) throw new Error('An image asset is incomplete.');
      const ratio = Math.min(w * sx / asset.media.w, h * sy / asset.media.h);
      const iw = asset.media.w * ratio, ih = asset.media.h * ratio;
      shapes.push({ ...base(descriptor.alt, x, y, w, h), type: 'image', $_otag: 'pic',
        x: x * sx + (w * sx - iw) / 2, y: y * sy + (h * sy - ih) / 2, w: iw, h: ih,
        blipFill: { blip: { $_target: asset.media.name, $_w: asset.media.w, $_h: asset.media.h } },
        imageSource: { title: asset.title, author: asset.author, license: asset.license, url: asset.sourceUrl, ...(asset.generation ? { generation: asset.generation } : {}) } });
    };
    preset('Background', 0, 0, 1280, 720, design.background);
    preset('Accent rule', 54, 44, slide.layout === 'section' ? 180 : 64, 5);
    const hero = ['cover', 'section', 'closing', 'statement'].includes(slide.layout);
    if (hero && slide.bullets?.length) throw new Error('Cover, section and closing layouts use subtitle/body, not bullets. Use a content layout for bullet points.');
    if (slide.layout === 'custom' && !slide.elements?.length) throw new Error('Custom slides need at least one element.');
    if (slide.layout === 'custom' && (slide.body || slide.bullets?.length || slide.items?.length)) throw new Error('Custom slides put body content in elements; do not supply unused body, bullets or items.');
    const itemLayouts = ['two-column', 'three-column', 'comparison', 'metrics', 'timeline', 'process', 'agenda', 'hub-spoke'];
    if (itemLayouts.includes(slide.layout) && (slide.body || slide.bullets?.length)) throw new Error('Column and timeline layouts put body content inside items.');
    const hasImage = !!slide.images?.length;
    const contentW = hasImage ? 650 : 1172;
    if (hero) {
      const statement = slide.layout === 'statement';
      if (!hasImage) {
        if (design.variant === 'split') preset('Hero color field', 920, 0, 360, 720, sharedDesign.accent);
        else if (design.variant === 'band') preset('Hero color band', 0, 570, 1280, 150, sharedDesign.dark);
        else {
          preset('Hero circle', 1010, 150, 160, 160, sharedDesign.secondary, 'ellipse');
          preset('Hero geometry', 920, 350, 240, 130, sharedDesign.accent, 'chevron');
        }
      }
      const heroW = hasImage ? 650 : design.variant === 'band' ? 1100 : 800;
      const closing = slide.layout === 'closing', heroX = closing && hasImage ? 600 : 54;
      const titleW = closing && hasImage ? 626 : heroW;
      text('Title', heroX, closing ? 220 : statement ? 175 : 190, titleW, closing ? 150 : 180, slide.title, statement ? 54 : 46, design.foreground, true);
      if (slide.subtitle || slide.body) text('Subtitle', heroX, 390, titleW, 155, slide.subtitle || slide.body, 23, design.muted);
    } else {
      text('Title', 54, 66, 1172, 76, slide.title, 32, design.foreground, true);
      if (slide.subtitle) text('Subtitle', 54, 145, 1172, 52, slide.subtitle, 17, design.muted);
      const top = slide.subtitle ? 210 : 170;
      if (slide.layout === 'content') {
        const paragraphs = [...(slide.body ? [{ text: slide.body }] : []), ...(slide.bullets || []).map(text => ({ text, bullet: true }))];
        if (!paragraphs.length) throw new Error(`Slide ${pageIndex + 1}: content layout needs body or bullets.`);
        if (!hasImage && design.variant === 'split') {
          preset('Editorial panel', 54, top, 330, 630 - top, sharedDesign.accent);
          text('Takeaway', 78, top + 28, 282, 340, slide.takeaway || slide.purpose, 30, legibleInk(sharedDesign.accent), true);
          text('Slide content', 430, top, 796, 630 - top, paragraphs, 24);
        } else {
          const band = !hasImage && design.variant === 'band';
          if (band) {
            preset('Takeaway band', 54, top, 1172, 108, sharedDesign.surface);
            text('Takeaway', 78, top + 16, 1124, 76, slide.takeaway || slide.purpose, 24, legibleInk(sharedDesign.surface), true);
          }
          const bodyTop = band ? top + 140 : top;
          text('Slide content', 54, bodyTop, contentW, 630 - bodyTop, paragraphs, 24);
        }
      } else if (itemLayouts.includes(slide.layout)) {
        const items = slide.items || [];
        const max = { 'two-column': 2, 'three-column': 3, comparison: 2, metrics: 4, timeline: 5, process: 5, agenda: 6, 'hub-spoke': 4 }[slide.layout];
        const minimum = slide.layout === 'three-column' ? 3 : 2;
        if (items.length < minimum || items.length > max) throw new Error(`Slide ${pageIndex + 1}: ${slide.layout} needs ${minimum}–${max} items.`);
        if (hasImage) throw new Error('Use image elements in unused space, rather than images with column layouts.');
        if (slide.layout === 'three-column') {
          const w = (1172 - 64) / 3;
          items.forEach((item, i) => {
            const x = 54 + i * (w + 32), h = 630 - top;
            const fill = i === 1 ? tint(sharedDesign.secondary) : i === 2 ? tint(sharedDesign.accent, .82) : sharedDesign.surface;
            const frame = preset('Content column', x, top, w, h, fill, 'roundRect');
            const content = [{ text: item.title }, ...(item.body ? [{ text: item.body }] : [])];
            const size = fit(content, w - 48, h - 64, 22, 17);
            frame.txBody = { bodyPr: { $_wrap: 'square', $_anchor: 't', $_lIns: 24 * sx * 9525, $_rIns: 24 * sx * 9525, $_tIns: 32 * sy * 9525, $_bIns: 32 * sy * 9525 },
              p: content.map((p, n) => paragraph(p, size, legibleInk(fill), n === 0)) };
            textRegions.push(frame);
            preset('Column accent', x + 24, top + 14, 48, 4, i === 1 ? sharedDesign.secondary : sharedDesign.accent);
          });
        } else if (slide.layout === 'agenda') {
          const rowH = (630 - top) / items.length;
          items.forEach((item, i) => {
            const y = top + i * rowH;
            preset('Agenda rule', 54, y + rowH - 8, 1172, 2, sharedDesign.surface);
            text('Agenda number', 54, y + 6, 72, rowH - 16, String(i + 1).padStart(2, '0'), 28, design.accent, true);
            text('Item title', 150, y + 8, item.body ? 380 : 1076, rowH - 18, item.title, 23, design.foreground, true);
            if (item.body) text('Item body', 560, y + 8, 666, rowH - 18, item.body, 18, design.muted);
          });
        } else if (slide.layout === 'hub-spoke') {
          // Orthogonal spokes keep relationships clear without crossings through text.
          const nodes = [[54, top], [876, top], [54, top + 220], [876, top + 220]];
          preset('Hub', 480, top + 120, 320, 150, sharedDesign.accent, 'roundRect');
          text('Hub label', 500, top + 142, 280, 106, slide.takeaway || slide.title, 24, legibleInk(sharedDesign.accent), true);
          items.forEach((item, i) => {
            const [x, y] = nodes[i], left = x < 480;
            preset('Spoke', left ? 404 : 800, y + 68, 76, 4, sharedDesign.secondary);
            preset('Spoke joint', left ? 476 : 800, Math.min(y + 68, top + 195), 4, Math.abs(top + 195 - (y + 68)), sharedDesign.secondary);
            preset('Node accent', x, y, 350, 4, i % 2 ? sharedDesign.secondary : sharedDesign.accent);
            text('Item title', x, y + 18, 350, 70, item.title, 23, design.foreground, true);
            if (item.body) text('Item body', x, y + 95, 350, Math.min(118, 630 - y - 95), item.body, 18, design.muted);
          });
        } else {
        const gap = 28, w = (1172 - gap * (items.length - 1)) / items.length;
        if (slide.layout === 'timeline') preset('Timeline rail', 54, top + 49, 1172, 4, sharedDesign.surface);
        items.forEach((item, i) => {
          const x = 54 + i * (w + gap), metric = slide.layout === 'metrics', timeline = slide.layout === 'timeline', process = slide.layout === 'process';
          const accent = i % 2 ? sharedDesign.secondary : sharedDesign.accent;
          const panel = slide.layout === 'comparison';
          if (panel) preset('Comparison field', x, top, w, 630 - top, i ? sharedDesign.surface : sharedDesign.accent);
          else if (process) preset('Process arrow', x, top, w, 96, accent, 'chevron');
          else if (timeline) preset('Timeline milestone', x, top + 28, 44, 44, accent, 'ellipse');
          else preset(`Item ${i + 1} accent`, x, top, w, 4, accent);
          if (metric && !item.value?.trim()) throw new Error('Metric items need an explicit value. Label illustrative numbers in their text.');
          if (metric || process) text('Value', x + (process ? w * .28 : 0), top + 18, w * (process ? .5 : 1), 72, metric ? item.value : String(i + 1).padStart(2, '0'), metric ? 48 : 30, process ? legibleInk(accent) : design.accent, true);
          const ty = top + (metric || timeline || process ? 120 : 28), inset = panel ? 24 : 0;
          const ink = panel ? legibleInk(i ? sharedDesign.surface : sharedDesign.accent) : design.foreground;
          text('Item title', x + inset, ty, w - inset * 2, 90, item.title, 24, ink, true);
          if (item.body) text('Item body', x + inset, ty + 105, w - inset * 2, 625 - ty - 105, item.body, 19, panel ? ink : design.muted);
        });
        }
      }
    }
    if (hasImage) image(slide.images[0], `${pageIndex}:hero`, slide.layout === 'closing' ? 54 : 752, hero ? 190 : 210, 474, hero ? 360 : 390);
    for (const [i, element] of (slide.elements || []).entries()) {
      const { x, y, width: w, height: h } = element;
      if (x < 54 || x + w > 1226 || y < 155 || y + h > 644) throw new Error(`Slide ${pageIndex + 1}: legacy element ${i + 1} at x=${x}, y=${y}, width=${w}, height=${h} exceeds the body area x=54..1226, y=155..644. Move/resize it inside that area, or use layout=svg with all objects inside svg for a full-slide design.`);
      if (element.kind === 'text') {
        const content = element.paragraphs?.length ? element.paragraphs : element.text;
        if (!content) throw new Error('Text elements need text or paragraphs.');
        if (Array.isArray(content) && content.some(p => !p.text?.trim() && !p.runs?.some(r => r.text.trim()))) throw new Error('Paragraphs cannot be empty.');
        text('Text', x, y, w, h, content, element.fontSize || 22, element.color || design.foreground, element.bold);
      } else if (element.kind === 'shape') {
        if (!element.shape) throw new Error('Shape elements need a preset name.');
        const shape = preset(element.shape, x, y, w, h, element.fill || design.accent, element.shape);
        const content = element.paragraphs?.length ? element.paragraphs : element.text ? [{ text: element.text }] : undefined;
        if (content) {
          const size = fit(content, w - 32, h - 32, element.fontSize || 22, 12);
          shape.txBody = { bodyPr: { $_anchor: 'ctr', $_lIns: 16 * sx * 9525, $_rIns: 16 * sx * 9525, $_tIns: 16 * sy * 9525, $_bIns: 16 * sy * 9525 },
            p: content.map(p => paragraph(p, size, element.color || legibleInk(element.fill || design.accent), element.bold)) };
          textRegions.push(shape);
        }
      } else if (element.kind === 'image') {
        if (!element.query?.trim() || !element.alt?.trim()) throw new Error('Images need search query and alt text.');
        image(element, `${pageIndex}:${i}`, x, y, w, h);
      } else if (element.kind === 'table') {
        const rows = element.rows;
        if (!rows?.length || rows.some(row => row.length !== rows[0].length)) throw new Error('Tables need rectangular rows.');
        const cw = w / rows[0].length, rh = h / rows.length;
        const cells = rows.map((row, ri) => ({ $_h: Math.round(rh * sy * 9525), tc: row.map(value => {
          const size = fit([{ text: value }], cw - 20, rh - 12, 18, 12);
          return { txBody: { bodyPr: {}, p: [paragraph({ text: value }, size, ri ? design.foreground : legibleInk(design.accent), !ri)] },
            tcPr: { ...{ $_marL: 10 * sx * 9525, $_marR: 10 * sx * 9525, $_marT: 6 * sy * 9525, $_marB: 6 * sy * 9525 },
              solidFill: editorColor(ri ? design.background : design.accent) } };
        }) }));
        shapes.push({ ...base('Table', x, y, w, h), type: 'table', $_otag: 'graphicFrame',
          graphic: { graphicData: { $_uri: 'http://schemas.openxmlformats.org/drawingml/2006/table', tbl: {
            tblPr: { $_firstRow: 1 }, tblGrid: { gridCol: rows[0].map(() => ({ $_w: Math.round(cw * sx * 9525) })) }, tr: cells } } } });
      } else if (element.kind === 'chart') {
        const { categories, series, chartType, dataLabel } = element;
        if (!chartType || !categories?.length || !series?.length || series.some(s => s.values.length !== categories.length) || !dataLabel?.trim())
          throw new Error('Charts need matching category/series data, chart type and a source/units label.');
        if (chartType === 'pie' && (series.length !== 1 || series[0].values.some(v => v < 0) || !series[0].values.some(v => v > 0))) throw new Error('Pie charts need one nonnegative series with a positive total.');
        if (h < 160 || w < 240) throw new Error('Charts need at least 240×160 design pixels.');
        shapes.push({ ...base('Chart', x, y, w, h - 35), type: 'chart', $_otag: 'graphicFrame',
          graphic: { graphicData: { $_uri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
            'c:chart': { chartJson: nativeChartPart(element, design.accent) } } },
          chartData: { animation: false, color: [design.accent, '#708EA4', '#B08048', '#8773A1'],
            textStyle: { fontFamily: design.fontFamily, color: design.foreground },
            legend: { textStyle: { color: design.foreground } },
            ...(chartType === 'pie' ? {} : { xAxis: [{ type: 'category', data: categories }], yAxis: { type: 'value' } }),
            grid: { left: '12%', right: '6%', top: '15%', bottom: '15%', containLabel: true },
            series: series.map(s => ({ name: s.name, type: chartType,
              data: chartType === 'pie' ? s.values.map((value, i) => ({ name: categories[i], value })) : s.values })) } });
        text('Chart data source', x, y + h - 28, w, 28, dataLabel, 12, design.muted);
      }
    }
    const credits = [...assets.entries()].filter(([key, a]) => key.startsWith(`${pageIndex}:`) && !a.placeholder).map(([, a]) => `${a.title} / ${a.author} / ${a.license} / ${a.sourceUrl}`);
    if (credits.length > 2) throw new Error('Use at most two images per slide so credits remain readable.');
    const footer = [slide.source, ...credits].filter(Boolean).join('\n');
    if (footer) text('Sources', 54, 654, 1060, 55, footer, 9, design.muted);
    text('Page number', 1150, 670, 76, 30, `${pageIndex + 1} / ${deck.slides.length}`, 11, design.muted);
    for (let a = 0; a < textRegions.length; a++) for (let b = a + 1; b < textRegions.length; b++) {
      const p = textRegions[a], q = textRegions[b];
      if (Math.min(p.x + p.w, q.x + q.w) > Math.max(p.x, q.x) + 1 && Math.min(p.y + p.h, q.y + q.h) > Math.max(p.y, q.y) + 1)
        throw new Error(`Slide ${pageIndex + 1}: text regions overlap (${p.name}, ${q.name}).`);
    }
    // Explicit authoring elements may intentionally overlap shapes/images (e.g. labels on diagrams).
    pages.push({ name: slide.title, shapes, showMaster: '0', transition: { advClick: 1 },
      agentMetadata: { version: 2, deckTitle: deck.title, audience: deck.audience, objective: deck.objective, purpose: slide.purpose, layout: slide.layout,
        takeaway: slide.takeaway, visualConcept: slide.visualConcept, strategy: deck.strategy, tone: design.tone, variant: design.variant, palette: deck.design?.palette || 'ocean' } });
  }
  validateMorphPairs(pages);
  for (const page of pages) promoteSlideBackground(page, { width, height });
  if (deck.slides.every(slide => slide.layout === deck.slides[0].layout)) warnings.push('All slides use the same composition; consider varying layouts.');
  return { pages, warnings, design: sharedDesign, scale, imageCount };
}

export function deckImageRequests(deck) {
  return deck.slides.flatMap((slide, page) => ['svg','html','markdown'].includes(slide.layout) ? svgImageRequests(slide.layout === 'markdown' ? markdownPageSVG(slide,{design:deckDesign(deck.design)}) : slide.layout === 'html' ? htmlToSVG(slide.html) : slide.svg,page) : [
    ...(slide.images || []).map(image => ({ key: `${page}:hero`, image })),
    ...(slide.elements || []).flatMap((image, index) => image.kind === 'image' ? [{ key: `${page}:${index}`, image }] : []),
  ]);
}
