// Use ordinary HTML paint primitives so the packaged capture renderer can
// measure fields through the same sandbox as other slide artwork.
export function prepareHtmlFormFields(source) {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const fields = new Map();
  const controls = parsed.querySelectorAll('input, select, textarea');
  for (const field of controls) {
    const tag = field.localName;
    const type = tag === 'input' ? field.type : tag;
    if (type === 'hidden') {
      field.remove();
      continue;
    }
    const value = type === 'password' || type === 'file' ? '' : field.value;
    const placeholder = field.getAttribute('placeholder') || '';
    const options = tag === 'select' ? [...field.options].map(option => ({
      value: option.value, label: option.label, disabled: option.disabled || !!option.closest('optgroup[disabled]'), selected: option.selected,
    })) : undefined;
    const metadata = {type, value,
      ...Object.fromEntries(['min', 'max', 'step', 'maxlength'].filter(key => field.hasAttribute(key)).map(key => [key === 'maxlength' ? 'maxLength' : key, field.getAttribute(key)])),
      placeholder, label: field.getAttribute('aria-label') || field.labels?.[0]?.textContent?.trim() || placeholder || field.name || field.id || 'Form field',
      disabled: field.matches(':disabled'), readOnly: !!field.readOnly,
      ...(['checkbox', 'radio'].includes(type) ? {checked: field.checked, name: field.name} : {}),
      ...(options ? {options, multiple: field.multiple} : {})};
    const label = options ? options.filter(option => option.selected).map(option => option.label).join(', ')
      : type === 'checkbox' || type === 'radio' ? (field.checked ? '✓' : ' ')
      : value || placeholder;
    let id = '!!desq-form-field-' + fields.size;
    while (parsed.getElementById(id)) id += '-field';
    const box = parsed.createElement('span');
    box.id = id;
    box.className = field.className;
    box.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;background:#fff;border:1px solid #777;border-radius:4px;padding:2px 6px;font:inherit;color:inherit;min-height:1.5em;' + field.style.cssText;
    if (type === 'checkbox' || type === 'radio') {
      box.style.width ||= '1.5em';
      if (type === 'radio') box.style.borderRadius = '50%';
    } else if (tag !== 'select') box.style.width ||= '10em';
    box.textContent = label;
    if (field.id) {
      // Keep authored script references on an outer wrapper while the inner
      // ID identifies the native field paint and text during compilation.
      const ref = parsed.createElement('span');
      ref.id = field.id;
      ref.append(box);
      field.replaceWith(ref);
    } else field.replaceWith(box);
    fields.set(id, metadata);
  }
  const containers = parsed.querySelectorAll('form, fieldset, legend, label');
  for (const element of containers) {
    const container = parsed.createElement(element.localName === 'label' ? 'span' : 'div');
    for (const key of ['id', 'class', 'style', 'hidden']) {
      if (element.hasAttribute(key)) container.setAttribute(key, element.getAttribute(key));
    }
    container.append(...element.childNodes);
    element.replaceWith(container);
  }
  return {source: containers.length || controls.length ? '<!doctype html>' + parsed.documentElement.outerHTML : source, fields};
}

export function mergeHtmlFormFieldShapes(shapes, fields) {
  const bySource = new Map(shapes.map(shape => [shape.sourceIds?.at(-1), shape]));
  const mergedText = new Set();
  for (const [id, field] of fields) {
    const box = bySource.get(id + ':box');
    const text = bySource.get(id + ':text');
    if (!box) continue;
    box.name = field.label;
    box.htmlField = field;
    box.prstGeom = { $_prst: 'roundRect', avLst: { gv: [{ $_name: 'adj', $_fmla: 'val 10000' }] } };
    delete box.custGeom;
    if (text?.txBody) {
      box.txBody = text.txBody;
      const body = box.txBody.bodyPr;
      body.$_anchor = 'ctr';
      body.$_lIns = body.$_rIns = 0;
      body.$_tIns = body.$_bIns = 0;
      for (const paragraph of box.txBody.p) paragraph.pPr = {...paragraph.pPr, $_algn: 'ctr'};
      mergedText.add(text);
    }
  }
  return shapes.filter(shape => !mergedText.has(shape));
}
