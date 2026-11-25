import {
  getFileInfo, getShapeDeep, getSlideInfo, getSelectSelGrpShps, getSelectSelShps, updateShape,
} from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { getMediaRecordFromOPFS } from "shared-vuejs/api/opfs";
import { saveBlobToCacheAPI } from "shared-vuejs/api/upload";
import { genId } from "shared-vuejs/api/utility";
import { color2array } from "shared-vuejs/api/colorUtils";
import { showError } from "@/lib/main/utils";

type Paint = "fill" | "stroke";

const pendingPaint = new Map<string, Promise<void>>();
const svgName = /\.svg(?:\+xml)?$/i;
const geometry = "path, rect, circle, ellipse, polygon, polyline, line, text, use";

function svgExtensions(blip) {
  const extensions = blip?.["a:extLst"]?.["a:ext"];
  return Array.isArray(extensions) ? extensions : extensions ? [extensions] : [];
}

function svgTarget(shape) {
  const blip = shape?.blipFill?.blip;
  return svgExtensions(blip).find(extension => extension["asvg:svgBlip"]?.$_target)?.["asvg:svgBlip"].$_target
    ?? (svgName.test(blip?.$_target ?? "") ? blip.$_target : undefined);
}

export function isSvgPicture(shape) {
  return !!shape && (shape.type === "svg" || !!svgTarget(shape));
}

export function setSvgPaint(property: Paint, color: string | number[]) {
  const fileId = getFileInfo()?.id;
  const slideId = getSlideInfo()?.id;
  if (!fileId || !slideId) return;

  const rgb = color ? typeof color === "string" ? color2array(color) : color : null;
  const paint = rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${rgb[3] ?? 1})` : "none";
  const groupSelection = getSelectSelGrpShps();
  const ids = groupSelection.length ? groupSelection : getSelectSelShps();

  for (const id of new Set(ids)) {
    if (!isSvgPicture(getShapeDeep(id))) continue;
    const key = JSON.stringify([fileId, slideId, id]);
    const onSlide = () => getFileInfo()?.id === fileId && getSlideInfo()?.id === slideId;
    const edit = (pendingPaint.get(key) ?? Promise.resolve()).then(async () => {
      if (!onSlide()) return;
      const shape = getShapeDeep(id);
      if (!isSvgPicture(shape)) return;

      const source = svgTarget(shape);
      const text = source
        ? new TextDecoder().decode((await getMediaRecordFromOPFS(fileId, source)).data)
        : shape.svg;
      if (!text || !onSlide()) return;

      const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
      if (svg.localName !== "svg" || svg.namespaceURI !== "http://www.w3.org/2000/svg") {
        throw new Error("Invalid SVG");
      }
      const elements = [...svg.querySelectorAll<SVGElement>(geometry)]
        .filter(element => element.namespaceURI === svg.namespaceURI
          && !element.closest("clipPath, mask, pattern, marker")
          && (property !== "fill" || element.localName !== "line"));
      if (!elements.length) throw new Error("SVG has no paintable geometry");

      for (const element of elements) {
        element.setAttribute(property, paint);
        element.style.setProperty(property, paint, "important");
      }

      const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
      const blip = shape.blipFill?.blip;
      const width = blip?.$_w || shape.w;
      const height = blip?.$_h || shape.h;
      const target = await saveBlobToCacheAPI(blob, `${genId()}.svg`, blob.type, fileId, width, height);
      if (!target || !onSlide()) return;
      const latest = getShapeDeep(id);
      if (!isSvgPicture(latest) || svgTarget(latest) !== source) return;
      const latestBlip = latest.blipFill?.blip;
      const extensions = svgExtensions(latestBlip).filter(extension => !extension["asvg:svgBlip"]);
      updateShape({
        ...latest,
        $_otag: "pic",
        type: "svg",
        svg: undefined,
        svgPaint: { ...latest.svgPaint, [property]: paint },
        ...(property === "fill"
          ? { solidFill: undefined }
          : { ln: undefined }),
        blipFill: {
          srcRect: {},
          stretch: { fillRect: {} },
          ...latest.blipFill,
          blip: {
            ...latestBlip,
            dataUrl: undefined,
            "a:extLst": extensions.length ? { ...latestBlip?.["a:extLst"], "a:ext": extensions } : undefined,
            $_target: target, $_w: width, $_h: height,
          },
        },
      });
      await saveDexie();
    }).catch(() => {
      if (onSlide()) showError("Could not change the SVG color.");
    }).finally(() => {
      if (pendingPaint.get(key) === edit) pendingPaint.delete(key);
    });
    pendingPaint.set(key, edit);
  }
}
