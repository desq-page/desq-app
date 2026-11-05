import { SVGPathData } from 'svg-pathdata';
import { round3 } from 'shared-vuejs/api/utility';

// Round after geometry, transforms and grouping have finished producing paths.
export function roundHtmlShapePaths(shapes) {
  for (const shape of shapes) {
    if (typeof shape.d === 'string' && shape.d) {
      if (shape.d.startsWith('R')) {
        // The editor's compact rectangle command is not an SVG command.
        shape.d = shape.d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi, value => String(round3(Number(value))));
      } else {
        shape.d = new SVGPathData(shape.d).transform(command => {
          for (const [key, value] of Object.entries(command))
            if (key !== 'type' && typeof value === 'number') command[key] = round3(value);
          return command;
        }).encode();
      }
    }
    if (shape.children) roundHtmlShapePaths(shape.children);
  }
}
