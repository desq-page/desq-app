import suppliedShapes from 'shared-vuejs/api/suppliedShapes';

// Share the editor palette's public catalog; adding a preset there exposes it
// to the agent schema as well. Freehand drawing modes are not named presets.
export const AUTOSHAPES = Object.freeze(suppliedShapes.flatMap(group => group.shapes
  .filter(shape => typeof shape.prst === 'string')
  .map(shape => Object.freeze({ id: shape.prst, name: shape.n, category: group.type, noFill: !!shape.noFill }))));

const aliases = { oval: 'ellipse', rectangle: 'rect', circle: 'ellipse', star: 'star5', roundedRectangle: 'roundRect' };
export const AUTOSHAPE_NAMES = Object.freeze([...new Set([...AUTOSHAPES.map(shape => shape.id), ...Object.keys(aliases)])]);
const normalized = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const lookup = new Map(AUTOSHAPES.flatMap(shape => [[normalized(shape.id), shape], [normalized(shape.name), shape]]));
for (const [alias, id] of Object.entries(aliases)) lookup.set(normalized(alias), AUTOSHAPES.find(shape => shape.id === id));
lookup.set('roundedrect', lookup.get('roundrect'));

export function resolveAutoshape(name) {
  const shape = typeof name === 'string' ? lookup.get(normalized(name)) : undefined;
  if (!shape) throw new Error('Unknown AutoShape. Choose a preset from the editor AutoShapes catalog.');
  return shape;
}
