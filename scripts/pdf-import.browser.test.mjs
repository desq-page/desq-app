import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium'].find(existsSync);

function fixturePdf() {
  const artwork = '0.8 0.1 0.2 rg 20 20 70 40 re f\nBT /F1 18 Tf 30 120 Td (Editable PDF) Tj ET\nq 40 0 0 30 170 40 cm /Im1 Do Q';
  const clipped = '10 10 30 30 re W n 0 0 100 100 re f';
  const stream = (data, dictionary = '') => `<< /Length ${data.length} ${dictionary} >>\nstream\n${data}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 7 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream(artwork),
    stream('FF0000>', '/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode'),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 8 0 R >>',
    stream(clipped),
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test('PDF imports native text, a vector path and an image, with a fallback for clipping', { skip: !chrome, timeout: 60000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'desq-pdf-import-'));
  try {
    await build({
      stdin: { resolveDir: resolve('.'), contents: `
        import * as pdfjs from 'pdfjs-dist';
        import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
        import { pdfDocument } from 'shared-vuejs/api/document-import-importPdf';
        globalThis.pdfjsWorker = { WorkerMessageHandler };
        const check = (value, message) => { if (!value) throw Error(message); };
        (async () => {
          try {
            const file = new File([${JSON.stringify(fixturePdf())}], 'example.pdf');
            const { doc, flattened } = await pdfDocument(file, pdfjs);
            check(doc.file.width === 300 && doc.file.height === 200, 'page size preserved');
            check(doc.slides.length === 2 && flattened === 1, 'one slide per page and one fallback');
            const shapes = doc.slides[0].shapes;
            check(shapes.some(shape => shape.txBody && JSON.stringify(shape.txBody).includes('Editable PDF')), 'editable text');
            check(shapes.some(shape => shape.type === 'path' && Math.abs(shape.x - 20) < 0.1 && Math.abs(shape.y - 140) < 0.1), 'vector path position');
            const image = shapes.find(shape => shape.type === 'image');
            check(image && Math.abs(image.x - 170) < 0.1 && Math.abs(image.y - 130) < 0.1, 'native image position');
            check(doc.assets[image.blipFill.blip.$_target].data.startsWith('data:image/png'), 'embedded image');
            check(doc.slides[1].shapes.some(shape => shape.type === 'image'), 'fallback image');
            document.body.textContent = 'PASS';
          } catch (error) { document.body.textContent = error.stack; }
        })();
      ` },
      bundle: true, format: 'esm', outfile: join(directory, 'fixture.js'),
      external: ['*?url', 'module', 'fs', 'path', 'url'],
      plugins: [{ name: 'document-persistence', setup(builder) {
        builder.onResolve({ filter: /importEditableHtml\.mjs$/ }, () => ({ path: 'storage', namespace: 'stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export function importEditableDocument() {}' }));
      } }],
    });
    writeFileSync(join(directory, 'fixture.html'), '<!doctype html><body><script type="module" src="fixture.js"></script>');
    const html = await runBrowserFixture(chrome, pathToFileURL(join(directory, 'fixture.html')).href, join(directory, 'profile'));
    assert.match(html, /<body>PASS<\/body>/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
