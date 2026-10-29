import {OFFICE_COLOR_SCHEMES} from './office-color-schemes.mjs';
import { TYPOGRAPHY_GUIDE } from './typography-guide.mjs';
import { AUTOSHAPE_NAMES } from './autoshape-catalog.mjs';

const str = (maxLength, minLength = 0) => ({ type: 'string', minLength, maxLength });
const num = (minimum, maximum) => ({ type: 'number', minimum, maximum });
const array = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const color = str(32, 1);
const motionEffect=obj({effect:str(80,1),duration:num(0,86400),delay:num(0,86400),trigger:{...str(20),enum:['on-click','with-previous','after-previous']},trigger_shape:str(100),repeat_count:num(.001,10000),auto_reverse:{type:'boolean'},rewind:{type:'boolean'},accelerate:num(0,1),decelerate:num(0,1),bounce_end:num(0,1),effect_options:obj({direction:str(40),amount:num(-10000,10000),color,font_name:str(100),relative:{type:'boolean'},size:num(-10000,10000)})});
const groupMotion=obj({...motionEffect.properties,effects:array(motionEffect,20,1)});
const run = obj({ text: str(600, 1), bold: { type: 'boolean' }, italic: { type: 'boolean' }, color }, ['text']);
const paragraph = obj({ text: str(1200), runs: array(run, 12), bullet: { type: 'boolean' } });
const geometry = { x: num(0, 1280), y: num(0, 720), width: num(1, 1280), height: num(1, 720) };
export const deckElementSchema = obj({
  kind: { ...str(16), enum: ['text', 'shape', 'image', 'table', 'chart'] }, ...geometry,
  text: str(1200), paragraphs: array(paragraph, 8), fontSize: num(10, 72), bold: { type: 'boolean' },
  color, fill: color, shape: { ...str(64), enum: AUTOSHAPE_NAMES },
  query: str(160, 1), alt: str(200, 1),
  rows: array(array(str(160), 6, 1), 10, 1),
  chartType: { ...str(16), enum: ['bar', 'line', 'pie'] },
  categories: array(str(80, 1), 10, 1),
  series: array(obj({ name: str(80, 1), values: array(num(-1e12, 1e12), 10, 1) }, ['name', 'values']), 4, 1),
  dataLabel: str(200, 1),
}, ['kind', 'x', 'y', 'width', 'height']);

export const deckSlideSchema = obj({
  title: str(120, 1), purpose: str(300, 1), subtitle: str(220), body: str(900),
  layout: { ...str(20), enum: ['pptx', 'markdown', 'html', 'svg', 'cover', 'section', 'content', 'two-column', 'three-column', 'comparison', 'metrics', 'timeline', 'closing', 'custom', 'process', 'statement', 'agenda', 'hub-spoke'] },
  templateFields: array(obj({id:str(30,1),text:str(20000),query:str(160),alt:str(200),rows:array(array(str(200),12),20),categories:array(str(100),30),series:array(obj({name:str(100),values:array(num(-1e12,1e12),30)},['name','values']),8)},['id']),100),
  templateSelection: obj({ family: str(80,1), layout: str(200,1), modelSelectedLayout: {type:'boolean'}, hostReflowed: {type:'boolean'} }, ['family','layout']),
  overflowContent: obj({ text: str(80000, 1), html: str(80000, 1) }, ['text', 'html']),
  markdown: str(80000, 1), visualSVG: str(40000, 1), svg: str(80000, 1), html: str(80000, 1),
  booleans:array(obj({operation:{...str(12),enum:['union','intersect','subtract','combine','fragment']},source_ids:array(str(100,1),32,2),output_id:str(100,1)},['operation','source_ids','output_id']),20),
  motion:obj({transition:obj({effect:str(40,1),duration:num(0,86400),advance_after:num(0,86400),advance_click:{type:'boolean'},effect_options:obj({direction:str(40),orientation:str(16),morph_by:str(16),spokes:num(1,8),through_black:{type:'boolean'}})}),animation:motionEffect,groups:{type:'object',maxProperties:100,additionalProperties:groupMotion}}),
  relationship: { ...str(16), enum: ['none', 'sequence', 'contrast', 'membership', 'hierarchy'] },
  takeaway: str(220), visualConcept: str(300),
  tone: { ...str(10), enum: ['base', 'dark', 'accent'] },
  variant: { ...str(10), enum: ['standard', 'split', 'band'] }, accent: color,
  bullets: array(str(220, 1), 6),
  items: array(obj({ title: str(90, 1), body: str(300), value: str(40) }, ['title']), 6),
  images: array(obj({ query: str(160, 1), alt: str(200, 1) }, ['query', 'alt']), 1),
  elements: array(deckElementSchema, 24),
  source: str(400),
}, ['title', 'purpose', 'layout']);

export const deckProperties = {
  colorScheme:{...str(80,1),enum:OFFICE_COLOR_SCHEMES.map(s=>s.id)},
  generationModel: str(160,1),
  language:str(35,2),
  title: str(160, 1), audience: str(200, 1), objective: str(400, 1),
  strategy: obj({ thesis: str(300, 1), narrative: str(600, 1), visualStyle: str(300, 1) }, ['thesis', 'narrative', 'visualStyle']),
  design: obj({ background: color, foreground: color, accent: color, secondary: color, muted: color, surface: color, dark: color,
    palette: { ...str(16), enum: ['ocean', 'forest', 'ember', 'plum', 'graphite'] },
    fontFamily: str(80, 1), style: { ...str(16), enum: ['light', 'dark'] } }),
  slides: array(deckSlideSchema, 20, 1),
};
export const deckSchema = obj(deckProperties, ['title', 'audience', 'objective', 'slides']);

export const DECK_AUTHORING_GUIDE = `For a request for a deck, presentation, or multiple slides, use ONLY savanna_create_deck.
${TYPOGRAPHY_GUIDE}
Act as a presentation strategist, designer, and editor. First decide the central thesis and narrative arc, then the visual concept for each slide, then write concise content. Include strategy {thesis,narrative,visualStyle}; these three fields belong ONLY inside strategy, never at the top level. Each slide should include takeaway (one clear point) and visualConcept (why this composition fits). Use specific titles: a supported finding for evidence slides, a plain subject label for processes and explanatory slides. Never invent evidence to make a slide look impressive.
Default to 8 slides unless a count is requested; maximum 20 per request. A three-slide deck needs distinct content structures, not three title/text/image pages. Choose design.palette ocean/forest/ember/plum/graphite to suit the topic; optional overrides background/foreground/accent/secondary/muted/surface/dark and fontFamily. Use consistent heading/body font roles and one quiet background by default. Never alternate full-slide colors to simulate composition variety. slide.tone=base/dark/accent and variant=standard/split/band control background and composition; choose them intentionally. Respect requested brand colors, uniform templates, slide counts and content; variety must never override explicit user requirements.
Build a visual narrative: opening claim -> evidence/explanation -> implications -> action. Prefer processes, relationships, comparisons and supplied data over repeated bullet pages. In 5+ slides, aim for at least three composition families, never three identical adjacent compositions unless requested. Use editable shapes meaningfully, not as random decoration. Keep generous whitespace; remove or rewrite crowded prose before reducing font size. Do not make every slide a row of cards.
Each slide needs title, purpose and layout. cover/section/closing emphasize title and subtitle; content uses body and bullets; two-column/comparison use 2 items; metrics uses 2-4 items with value/title/body; timeline uses 3-5 ordered items. Keep content concise. Bullets share ONE textbox with one paragraph each.
Additional layouts: statement emphasizes one strong title with supporting subtitle/body; agenda uses 2-6 numbered items in horizontal rows; process uses 2-5 items with native chevrons showing a sequence; hub-spoke uses 2-4 items around a central takeaway (keep takeaway <=80 characters). comparison has contrasting color fields, metrics emphasizes large values, timeline uses a horizontal rail and milestones. Do not put body/bullets on item layouts; use items[].body. Titles <=75 characters and item titles <=45 characters are good design targets. Large title text and restrained accents establish hierarchy.
three-column uses EXACTLY 3 items with title/body in three native rounded rectangles. Use it for peer concepts, benefits or options. For short decks, prioritize useful content: an editorial overview, three-column explanation, then process or comparison. Do not consume two of three pages with cover/closing unless asked. Images support the message; they are not the default carrier on every page. Include relationship=none/sequence/contrast/membership/hierarchy to describe content relationships.
When the user explicitly requests cover + one content page + closing, preserve exactly that roster. Give the middle page a useful native composition (e.g. three-column with three peer ideas, comparison or labeled AutoShapes). Place an image on the cover and/or closing without turning the middle page into another title/bullets/picture layout. "Simple" and "quickly" mean concise content and fewer steps, not bypassing native composition. A colorful deck can use coordinated accent objects on a shared neutral background.
For custom diagrams or data slides use layout=custom and elements in a 1280x720 design canvas. The editor reserves y=0..145 for title and y=654..720 for footer; keep custom elements in x=54..1226,y=155..644. Avoid unintended overlaps. Explicit elements may also accompany other layouts only in unused space. All elements need kind,x,y,width,height.
text elements use text or paragraphs (optional runs with bold/italic/color), fontSize in points. shape elements use any available AutoShape name plus fill; text/paragraphs on a shape become its native editable label. image elements use query/alt, NEVER URLs. table elements use rectangular rows (first row is header). chart elements use chartType bar/line/pie, categories, series [{name,values}], and mandatory dataLabel describing source/units or explicitly labeling illustrative data. Pie needs one series and nonnegative values. Never fabricate factual statistics; use supplied data or label examples as illustrative. Use source for source citations supplied by the user; do not invent citations. Images are optional Wikimedia search queries; use at most 8 images across the whole deck. Never author unsupported features as if they worked.
For images, supply query as 2 to 4 Wikimedia subject keywords (e.g. "rooftop solar panels"), never a sentence or art direction. Prefer native-language subject names and preserve diacritics (e.g. Vietnamese Tet flowers: "hoa mai" or "hoa đào"); do not mix a native name with its English translation in one query. Use alt for the full description. The host searches Wikimedia first and uses the connected cloud provider's image generation if no usable image is found. Do not invent generated URLs or claim generation succeeded before execution.
For simple single-slide requests keep savanna_create_slide. Deck insertion adds pages after the current page, preserving existing content. No extra navigation/edit calls.`;
