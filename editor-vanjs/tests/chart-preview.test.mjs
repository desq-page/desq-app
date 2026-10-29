import test from 'node:test';
import assert from 'node:assert/strict';
import { addVanChartPreviews } from '../../editor-vuejs/src/lib/main/vanChartPreview.mjs';

test('Vue handoff renders nested charts without modifying chart data', async () => {
  const chart = { id: 'chart', chartData: { series: [{ data: [1, 2] }] } };
  const record = { shapes: [{ children: [chart] }] };
  const theme = { name: 'theme' }, master = { clrMap: { accent1: 'accent2' } };
  await addVanChartPreviews(record, theme, master, (shape, ssr, grid, editable, context) => {
    assert.equal(ssr, true);
    assert.deepEqual(context, { theme, clrMap: master.clrMap });
    shape.chartData.series[0].data.push(3);
    return '<svg width="100rem" height="50rem"></svg>';
  });
  assert.match(chart.chartSvg, /^<svg/);
  assert.deepEqual(chart.chartData.series[0].data, [1, 2]);
});
