import { piniaSelect } from "@/lib/common/store";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { updateText } from "shared-vuejs/api/updateText";
import { gid } from "shared-vuejs/api/utility";

export function textboxEffectTargets() {
  const textbox = gid(piniaSelect().selShpFormat?.id)?.querySelector<HTMLElement>(".textbox");
  if (!textbox) return [];
  const runs = Array.from(textbox.querySelectorAll<HTMLElement>("p span"))
    .filter(run => !run.querySelector("span"));
  return runs.length ? runs : [textbox];
}

type TextEffect = "shdw" | "glow" | "refl";
type ReadEffect = (effect: TextEffect) => string;

export function readTextEffect(effect: TextEffect) {
  const selection = piniaSelect();
  if (selection.editingInfo) {
    return selection.editingPendingFormats?.[`--${effect}`] ?? selection.editingInfo[effect] ?? "";
  }
  return textboxEffectTargets().map(run => getComputedStyle(run).getPropertyValue(`--${effect}`).trim())
    .find(Boolean) ?? "";
}

export function applyTextEffect(buildStyle: (read: ReadEffect) => Record<string, string>) {
  const selection = piniaSelect();
  if (selection.editingInfo) {
    execEditorSurroundSpan(buildStyle(readTextEffect), undefined, false);
    return;
  }
  const shapeId = selection.selShpFormat?.id;
  const runs = textboxEffectTargets();
  if (!shapeId || !runs.length) return;
  for (const run of runs) {
    const computed = getComputedStyle(run);
    const style = buildStyle(effect => computed.getPropertyValue(`--${effect}`).trim());
    for (const [property, value] of Object.entries(style))
      run.style.setProperty(property, value);
  }
  updateText(false, false, [shapeId]);
}
