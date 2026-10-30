// Direct Desq JSON mapping of elements.py::_decode_shape_style.
// Copyright (c) 2025-2026 Hugo He, MIT; upstream notice is retained in third_party/ppt-master/.
import { XMLParser, XMLValidator } from "fast-xml-parser";
const colorTags = new Set([
  "srgbClr",
  "schemeClr",
  "sysClr",
  "prstClr",
  "scrgbClr",
  "hslClr",
]);
export function nativeShapeStyle(encoded) {
  if (!encoded) return undefined;
  if (
    typeof encoded !== "string" ||
    encoded.length > 48000 ||
    !/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)
  )
    throw Error("Invalid native shape-style base64.");
  let xml;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
    );
  } catch {
    throw Error("Invalid native shape-style encoding.");
  }
  if (/<!DOCTYPE|<!ENTITY|<\?|\s(?!xmlns:)[\w.-]+:[\w.-]+\s*=/i.test(xml))
    throw Error(
      "Native shape style must not contain external/relationship attributes.",
    );
  if (XMLValidator.validate(xml) !== true)
    throw Error("Invalid native shape-style XML.");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "$_",
    removeNSPrefix: true,
    parseTagValue: false,
  }).parse(xml);
  if (!parsed.style || Object.keys(parsed).length !== 1)
    throw Error("Native shape-style payload must be p:style.");
  const convert = (node) => {
    if (Array.isArray(node)) return node.map(convert);
    if (node === null || typeof node !== "object") return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("$_xmlns")) continue;
      if (colorTags.has(key)) out.uniClr = { $_otag: key, ...convert(value) };
      else out[key] = convert(value);
    }
    return out;
  };
  return convert(parsed.style);
}
