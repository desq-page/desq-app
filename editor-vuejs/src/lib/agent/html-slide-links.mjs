export function collectHtmlSlideLinks(shapes) {
  for (const shape of shapes) {
    const match = [...(shape.sourceIds || [])].reverse().map(id => /^desq-html-slide-link-(\d+)-\d+$/.exec(id)).find(Boolean);
    if (match) shape.htmlSlideTargetIndex = Number(match[1]) - 1;
    if (shape.children) collectHtmlSlideLinks(shape.children);
  }
}

export function hasHtmlSlideLinks(pages) {
  const visit = shapes => shapes.some(shape => Number.isInteger(shape.htmlSlideTargetIndex) || (shape.children && visit(shape.children)));
  return pages.some(page => visit(page.shapes));
}

export function resolveHtmlSlideLinks(pages, slideIds) {
  const visit = shapes => shapes.forEach(shape => {
    if (shape.htmlSlideTargetIndex !== undefined) {
      const index = shape.htmlSlideTargetIndex;
      if (!Number.isInteger(index) || !slideIds[index]) throw Error('HTML link refers to a missing slide.');
      shape.link = '@sld:' + slideIds[index];
      delete shape.htmlSlideTargetIndex;
    }
    if (shape.children) visit(shape.children);
  });
  pages.forEach(page => visit(page.shapes));
}
export function collectScriptBindings(shapes){
  for(const shape of shapes){
    const source=[...(shape.sourceIds||[])].reverse().find(id=>id.startsWith('desq-html-script-call-'));
    if(source)shape.link='@run:'+source.slice('desq-html-script-call-'.length);
    if(shape.children)collectScriptBindings(shape.children);
  }
}
