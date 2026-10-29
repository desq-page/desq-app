import { wrapDeckText } from "./deck-text.mjs";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const plain = (value) =>
  String(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`|(?<!\*)\*(?!\*)/g, "")
    .trim();
export const MARKDOWN_AUTHORING_GUIDE = `Write presentation content as Markdown only. No JSON, HTML, tool calls or introduction. Use # Presentation title then ## Slide 1: Title, ## Slide 2: Title, etc. Each slide contains actual content: short paragraphs, bullet lists, **bold** emphasis, and Markdown tables where useful. Separate slides with --- if desired. Preserve requested facts, language, count and purpose. Never invent statistics or citations. Keep one slide to about 120 words. Optional blockquote directives: > Style: clean blue; > Background: #FFFFFF; > Accent: #087F8C; > Font: Arial; > Image: descriptive subject keywords; > Diagram: process: Collect -> Analyze -> Act; > Visual: a specific diagram to explain. These are design notes, not audience-facing text. For diagrams prefer a short process sequence; complex visual suggestions are elaborated in a later step. Images may also use ![descriptive subject](image). Never output image URLs, CSS or scripts. Keep factual content in ordinary Markdown, not only in design directives.`;
export function cleanMarkdown(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 80000)
    throw Error("Return nonempty Markdown within 80,000 characters.");
  const value = text.trim();
  return /^```(?:markdown|md)\s*\n/i.test(value)
    ? value
        .replace(/^```(?:markdown|md)\s*\n/i, "")
        .replace(/\n```\s*$/, "")
        .trim()
    : value;
}
export function parseMarkdownSlides(text, { count } = {}) {
  const source = cleanMarkdown(text),
    lines = source.split(/\r?\n/),
    sections = [];
  let current = [],
    fenced = false,
    explicit = /^##\s+(?:slide|page)\s*\d*\s*[:.\-–]?/im.test(source),
    headings =
      !explicit &&
      (count || 0) > 1 &&
      (source.match(/^##\s+/gm) || []).length === count;
  const flush = () => {
    if (current.some((line) => line.trim()))
      sections.push(current.join("\n").trim());
    current = [];
  };
  for (const line of lines) {
    if (/^```/.test(line.trim())) fenced = !fenced;
    if (
      !fenced &&
      (explicit
        ? /^##\s+(?:slide|page)\s*\d*\s*[:.\-–]?/i.test(line)
        : headings
          ? /^##\s+/.test(line)
          : /^---+\s*$/.test(line))
    ) {
      flush();
      if (!/^---+\s*$/.test(line)) current.push(line);
      continue;
    }
    if (explicit && !fenced && /^---+\s*$/.test(line)) continue;
    current.push(line);
  }
  flush();
  let title = plain(source.match(/^#\s+(.+)$/m)?.[1] || "Presentation");
  let pages = sections;
  if ((explicit || headings) && pages.length && !/^##\s+/i.test(pages[0])) {
    const preamble = pages.shift();
    // Carry deck-level style directives into every page; no model-authored executable format.
    const globalStyle = preamble
      .split("\n")
      .filter((line) =>
        /^>\s*(?:style|background|accent|foreground|font)\s*:/i.test(line),
      )
      .join("\n");
    if (globalStyle) pages = pages.map((page) => page + "\n" + globalStyle);
  }
  if (!pages.length) throw Error("The model returned no Markdown slides.");
  if (pages.length > 20) throw Error("Use at most 20 Markdown slides.");
  if (count && pages.length !== count)
    throw Error(
      `Expected exactly ${count} Markdown slides; received ${pages.length}. Use one ## Slide N: Title heading per slide.`,
    );
  const slides = pages.map((markdown, index) => {
    const heading = markdown.match(/^#{1,3}\s+(.+)$/m)?.[1];
    const slideTitle = plain(
      heading?.replace(/^(?:slide|page)\s*\d*\s*[:.\-–]?\s*/i, "") ||
        `Slide ${index + 1}`,
    );
    if (slideTitle.length > 120)
      throw Error(
        `Slide ${index + 1} title exceeds 120 characters. Shorten its heading.`,
      );
    return {
      title: slideTitle,
      purpose: "Communicate the supplied slide content",
      layout: "markdown",
      markdown,
    };
  });
  return { title: title.slice(0, 160), slides };
}
function tableRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => plain(cell.replace(/\\\|/g, "|")));
}
export function markdownContent(markdown) {
  const lines = cleanMarkdown(markdown).split(/\r?\n/),
    blocks = [],
    directives = {},
    warnings = [];
  let skippedTitle = false,
    paragraph = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i],
      trim = line.trim();
    if (/^```/.test(trim)) {
      flush();
      const language = trim.slice(3).trim().toLowerCase(),
        code = [];
      while (++i < lines.length && !/^```/.test(lines[i].trim()))
        code.push(lines[i]);
      if (language === "svg") directives.svg = code.join("\n");
      else if (["mermaid", "diagram"].includes(language))
        directives.visual = code.join("\n");
      else blocks.push({ type: "paragraph", text: code.join("\n") });
      continue;
    }
    const directive = trim.match(
      /^(?:>\s*)?(?:\*\*)?(style|background|foreground|accent|font|image|diagram|visual|layout)(?:\*\*)?\s*:\s*(.*)$/i,
    );
    if (directive) {
      flush();
      const key = directive[1].toLowerCase();
      directives[key] = [directives[key], directive[2]]
        .filter(Boolean)
        .join("; ");
      continue;
    }
    const image = trim.match(/!\[([^\]]*)\]\(([^)]*)\)/);
    if (image) {
      flush();
      directives.image =
        image[1] ||
        (!/^https?:|^data:/i.test(image[2]) ? image[2] : "Supporting image");
      const rest = line.replace(image[0], "").trim();
      if (rest) paragraph.push(rest);
      continue;
    }
    if (/^#{1,3}\s+/.test(trim)) {
      flush();
      if (!skippedTitle) {
        skippedTitle = true;
        continue;
      }
      blocks.push({ type: "heading", text: trim.replace(/^#+\s+/, "") });
      continue;
    }
    if (
      trim.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])
    ) {
      flush();
      const rows = [tableRow(trim)];
      i++;
      while (
        i + 1 < lines.length &&
        lines[i + 1].includes("|") &&
        lines[i + 1].trim()
      )
        rows.push(tableRow(lines[++i]));
      if (
        rows.length > 10 ||
        rows[0].length > 6 ||
        rows.some((row) => row.length !== rows[0].length)
      )
        throw Error(
          "Markdown tables require at most 10 rectangular rows and 6 columns.",
        );
      blocks.push({ type: "table", rows });
      continue;
    }
    if (!trim || /^---+$/.test(trim)) {
      flush();
      continue;
    }
    const bullet = trim.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
    if (bullet) {
      flush();
      blocks.push({ type: "bullet", text: bullet[1] });
    } else paragraph.push(trim.replace(/^>\s?/, ""));
  }
  flush();
  if (
    !blocks.length &&
    !directives.image &&
    !directives.svg &&
    !directives.diagram &&
    !directives.visual
  )
    throw Error("Markdown slide has no content.");
  return { blocks, directives, warnings };
}
function processLabels(description) {
  const text =
    description?.replace(/^(?:process|flow|timeline|sequence)\s*:\s*/i, "") ||
    "";
  if (/^(?:graph|flowchart|sequenceDiagram|classDiagram)\b/i.test(text.trim()))
    return null;
  const labels = text
    .split(/\s*(?:->|→|=>)\s*/)
    .map(plain)
    .filter(Boolean);
  return labels.length >= 2 &&
    labels.length <= 6 &&
    labels.every((label) => label.length <= 60)
    ? labels
    : null;
}
export function markdownStyleRequest(markdown) {
  const style = markdownContent(markdown).directives.style;
  return style &&
    /watercolor|glass|gradient|3d|isometric|texture|neon|sketch|hand.drawn|surreal/i.test(
      style,
    )
    ? style
    : null;
}
export function markdownVisualRequest(markdown) {
  const { directives } = markdownContent(markdown);
  if (directives.svg) return null;
  const description =
    directives.diagram ||
    directives.visual ||
    (/^(?:diagram|icon|illustration|schematic|flowchart)\b/i.test(
      directives.image || "",
    )
      ? directives.image
      : null);
  return !description || processLabels(description) ? null : description;
}
function inlineRuns(text) {
  const runs = [];
  const pattern = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`/g;
  let cursor = 0;
  const normalized = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  for (const match of normalized.matchAll(pattern)) {
    if (match.index > cursor)
      runs.push({ text: normalized.slice(cursor, match.index) });
    runs.push({
      text: match[1] || match[2] || match[3] || match[4],
      bold: !!(match[1] || match[2]),
      italic: !!match[3],
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < normalized.length) runs.push({ text: normalized.slice(cursor) });
  return runs;
}
export function markdownPageSVG(
  slide,
  { design = {}, measureText, onWarning = () => {} } = {},
) {
  const { blocks, directives } = markdownContent(slide.markdown);
  const color = (value, fallback) =>
    /^#[\da-f]{6}$/i.test(value || "") ? value : fallback;
  const style = (directives.style || "").toLowerCase();
  if (markdownStyleRequest(slide.markdown))
    onWarning(
      "Complex style suggestion uses a simple native palette approximation.",
    );
  const background = color(
    directives.background,
    /dark|navy/.test(style) ? "#102A43" : design.background || "#FFFFFF",
  );
  const foreground = color(
    directives.foreground,
    background === "#102A43" ? "#FFFFFF" : design.foreground || "#172B4D",
  );
  const accent = color(
    directives.accent,
    /green|forest/.test(style)
      ? "#087F5B"
      : /orange|warm/.test(style)
        ? "#C65D21"
        : design.accent || "#087F8C",
  );
  const font = (directives.font || design.fontFamily || "Arial").slice(0, 80),
    parts = [`<rect width="1280" height="720" fill="${background}"/>`];
  const image = directives.image,
    visual = slide.visualSVG || directives.svg,
    labels = processLabels(directives.diagram || directives.visual);
  const hasVisual = !!(
    image ||
    visual ||
    labels ||
    directives.diagram ||
    directives.visual
  );
  const width = hasVisual ? 548 : 1152,
    lineHeight = 34;
  let y = 190;
  const titleLines = wrapDeckText(slide.title, 1152, 36, font, measureText);
  if (titleLines.length > 2)
    throw Error("Markdown title needs a shorter heading.");
  const titleY = titleLines.length > 1 ? 80 : 104;
  if (titleLines.length > 1) y = 226;
  parts.push(
    `<text font-size="48" font-weight="bold" fill="${foreground}" data-paragraph-line-height="56">${titleLines.map((line, i) => `<tspan x="64" y="${titleY + i * 56}">${escape(line)}</tspan>`).join("")}</text><rect x="64" y="${titleLines.length > 1 ? 164 : 132}" width="96" height="5" fill="${accent}"/>`,
  );
  for (const block of blocks) {
    if (block.type === "table") {
      const height = block.rows.length * 42;
      if (y + height > 668)
        throw Error(
          "Markdown table does not fit. Split the content across slides.",
        );
      const payload = {
        x: 64,
        y: y - 22,
        width,
        height,
        rows: block.rows,
        header_rows: 1,
        style: {
          font_family: font,
          font_size: 18,
          header_fill: accent,
          header_text: "#FFFFFF",
          body_fill: background,
          body_text: foreground,
        },
      };
      parts.push(
        `<g data-pptx-replace-with="table" data-pptx-native-authority="json"><metadata type="application/json">${escape(JSON.stringify(payload))}</metadata></g>`,
      );
      y += height + 18;
      continue;
    }
    const runs = inlineRuns(block.text),
      text = runs.map((run) => run.text).join(""),
      size = block.type === "heading" ? 28 : 24;
    const lines = wrapDeckText(
      text,
      width - (block.type === "bullet" ? 32 : 0),
      size * 0.75,
      font,
      measureText,
    );
    if (y + lines.length * lineHeight > 690)
      throw Error(
        "Markdown text does not fit. Shorten or split the page; preserve all required facts.",
      );
    let offset = 0;
    const spans = lines
      .map((line, index) => {
        const start = Math.max(offset, text.indexOf(line, offset)),
          end = start + line.length;
        let runOffset = 0;
        const rich = runs
          .map((run) => {
            const a = Math.max(start, runOffset),
              b = Math.min(end, runOffset + run.text.length);
            runOffset += run.text.length;
            return b > a
              ? `<tspan${run.bold ? ' font-weight="bold"' : ""}${run.italic ? ' font-style="italic"' : ""}>${escape(run.text.slice(a - (runOffset - run.text.length), b - (runOffset - run.text.length)))}</tspan>`
              : "";
          })
          .join("");
        offset = end;
        return `<tspan x="${block.type === "bullet" ? 88 : 64}" y="${y + index * lineHeight}"${index ? ' data-paragraph-line-break="1"' : ""}>${block.type === "bullet" && !index ? "• " : ""}${rich}</tspan>`;
      })
      .join("");
    parts.push(
      `<text font-size="${size}" fill="${foreground}"${block.type === "heading" ? ' font-weight="bold"' : ""} data-paragraph-line-height="${lineHeight}">${spans}</text>`,
    );
    y += lines.length * lineHeight + 20;
  }
  if (image) {
    const query = plain(image).slice(0, 160);
    parts.push(
      `<image x="704" y="182" width="512" height="420" data-query="${escape(query)}" aria-label="${escape(plain(image).slice(0, 200))}" preserveAspectRatio="xMidYMid slice"/>`,
    );
  } else if (visual) {
    const match = visual
      .trim()
      .match(
        /^<svg\b[^>]*viewBox=["']0 0 1280 720["'][^>]*>([\s\S]*)<\/svg>$/i,
      );
    if (!match) throw Error("Visual SVG requires a complete 1280×720 viewBox.");
    parts.push(`<g transform="translate(680 184) scale(0.42)">${match[1]}</g>`);
  } else if (labels) {
    labels.forEach((label, index) => {
      const boxY = 178 + index * (440 / labels.length);
      parts.push(
        `<rect x="736" y="${boxY}" width="432" height="56" rx="12" fill="${accent}"/><text x="952" y="${boxY + 35}" text-anchor="middle" font-size="22" fill="#FFFFFF">${escape(label)}</text>`,
      );
      if (index < labels.length - 1)
        parts.push(
          `<path d="M952 ${boxY + 60}v${440 / labels.length - 66}" fill="none" stroke="${accent}" stroke-width="3"/>`,
        );
    });
  } else if (directives.diagram || directives.visual) {
    onWarning(
      "The suggested visual could not be resolved; an editable description is retained.",
    );
    parts.push(
      `<rect x="704" y="182" width="512" height="420" rx="16" fill="#E6EDF2"/>`,
    );
    const lines = wrapDeckText(
      plain(directives.diagram || directives.visual),
      448,
      18,
      font,
      measureText,
    );
    parts.push(
      `<text x="736" y="236" font-size="24" fill="#172B4D">${lines.map((line, i) => `<tspan x="736" y="${236 + i * 34}">${escape(line)}</tspan>`).join("")}</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" font-family="${escape(font)}">${parts.join("")}</svg>`;
}
