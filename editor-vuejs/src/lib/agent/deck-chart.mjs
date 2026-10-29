import { editorColor } from './colors.mjs';

// Savanna's PPTX serializer expects the original native chart part as well as
// ECharts preview data. Author both from the same validated series.
export function nativeChartPart({ chartType, categories, series }, accent = '#087F75') {
  // tXml's text-node representation is a string; numeric primitives become
  // empty elements. Keep numbers in chartData, strings in DrawingML caches.
  const points = values => values.map((value, i) => ({ $_idx: i, 'c:v': String(value) }));
  const colors = [editorColor(accent).uniClr.$_val, '708EA4', 'B08048', '8773A1'];
  const nativeSeries = series.map((s, i) => ({
    'c:idx': { $_val: i }, 'c:order': { $_val: i }, 'c:tx': { 'c:v': s.name },
    'c:spPr': { 'a:solidFill': { 'a:srgbClr': { $_val: colors[i] } },
      ...(chartType === 'line' ? { 'a:ln': { $_w: 28575, 'a:solidFill': { 'a:srgbClr': { $_val: colors[i] } } } } : {}) },
    'c:cat': { 'c:strLit': { 'c:ptCount': { $_val: categories.length }, 'c:pt': points(categories) } },
    'c:val': { 'c:numLit': { 'c:formatCode': 'General', 'c:ptCount': { $_val: s.values.length }, 'c:pt': points(s.values) } },
  }));
  const axisIds = [{ $_val: 100001 }, { $_val: 100002 }];
  const plot = { 'c:layout': {},
    [`c:${chartType}Chart`]: {
      ...(chartType === 'bar' ? { 'c:barDir': { $_val: 'col' }, 'c:grouping': { $_val: 'clustered' } }
        : chartType === 'line' ? { 'c:grouping': { $_val: 'standard' } } : { 'c:varyColors': { $_val: 1 } }),
      'c:ser': nativeSeries, ...(chartType === 'pie' ? {} : { 'c:axId': axisIds }),
    },
    ...(chartType === 'pie' ? {} : {
      'c:catAx': { 'c:axId': axisIds[0], 'c:scaling': { 'c:orientation': { $_val: 'minMax' } }, 'c:axPos': { $_val: 'b' },
        'c:crossAx': axisIds[1], 'c:crosses': { $_val: 'autoZero' }, 'c:auto': { $_val: 1 }, 'c:lblAlgn': { $_val: 'ctr' } },
      'c:valAx': { 'c:axId': axisIds[1], 'c:scaling': { 'c:orientation': { $_val: 'minMax' } }, 'c:axPos': { $_val: 'l' },
        'c:numFmt': { $_formatCode: 'General', $_sourceLinked: 0 }, 'c:crossAx': axisIds[0], 'c:crosses': { $_val: 'autoZero' }, 'c:crossBetween': { $_val: 'between' } },
    }),
  };
  return { 'c:chartSpace': {
    '$_xmlns:c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
    '$_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    '$_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'c:chart': { 'c:autoTitleDeleted': { $_val: 1 }, 'c:plotArea': plot,
      'c:legend': { 'c:legendPos': { $_val: 'b' }, 'c:overlay': { $_val: 0 } }, 'c:plotVisOnly': { $_val: 1 } },
  } };
}
