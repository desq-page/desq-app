import {sourceBundle,textFromModel} from './source-bundle.mjs';
import { parse } from 'parse5';

// HTML5 tree construction accepts void tags, optional end tags and malformed markup.
// parse5 creates plain data only: scripts never execute and resources never load.
function parseHTML(html) {
  function convert(node) {
    if (node.nodeName === '#text') return node.value;
    if (!node.tagName) return null;
    return {tagName:node.tagName, attributes:Object.fromEntries((node.attrs || []).map(attr=>[attr.name,attr.value])),
      children:(node.childNodes || []).map(convert).filter(child=>child !== null)};
  }
  return parse(String(html)).childNodes.map(convert).filter(node=>node !== null);
}
// Parse inert markup as data; no article HTML is mounted or executed.
export function articleHTMLText(html) {
  return textFromHTMLNodes(parseHTML(html));
}

function textFromHTMLNodes(nodes) {
  function walk(node) {
    if (typeof node === 'string') return node;
    const tag = node.tagName?.toLowerCase(), attrs = node.attributes || {};
    if (['script', 'style', 'nav', 'noscript', 'head', 'footer'].includes(tag) ||
      /(?:^|\s)(?:mw-editsection|reference|references|reflist|navbox|infobox|metadata|toc)(?:\s|$)/.test(attrs.class || '')) return '';
    const text = (node.children || []).map(walk).join('');
    if (/^h[2-6]$/.test(tag)) return `\n\n== ${text.trim()} ==\n`;
    return ['p', 'li', 'dt', 'dd', 'tr', 'blockquote', 'div', 'section'].includes(tag) ? `\n${text}\n` : text;
  }
  function findContent(list) { for (const node of list) { if (typeof node !== 'object') continue; if (['article','main'].includes(node.tagName?.toLowerCase()) || node.attributes?.id === 'mw-content-text') return node; const found = findContent(node.children || []); if (found) return found; } }
  const content = findContent(nodes);
  return (content ? [content] : nodes).map(walk).join('').replace(/[ \t]+/g, ' ');
}

export function splitArticleSections(text, source) {
  const chunks = String(text).split(/\n\s*={2,6}\s*([^=\n]+?)\s*={2,6}\s*\n/);
  const sections = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const heading = i ? chunks[i - 1].trim() : source.title;
    if (/^(references|external links|see also|notes|bibliography)$/i.test(heading)) continue;
    const content = chunks[i].replace(/\s+/g, ' ').trim();
    for (let offset = 0; offset < content.length; offset += 1800) {
      const excerpt = content.slice(offset, offset + 1800);
      if (excerpt.length >= 60) sections.push({ heading, text: excerpt, sourceId: source.id, url: source.url });
    }
  }
  return sections;
}

export function htmlSource(html,{id=`source-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,name='HTML article',origin}={}) {
  const nodes=parseHTML(html);
  const text=textFromHTMLNodes(nodes),sections=splitArticleSections(text,{title:name,id,url:origin});
  const assets=[],headings=[];
  const visit=node=>{if(typeof node!=='object')return;const attrs=node.attributes||{};
    if(/^h[1-6]$/.test(node.tagName))headings.push({tag:node.tagName,text:textFromModel(node.children),style:attrs.style});
    if(node.tagName==='img')assets.push({id:`${id}:A${assets.length+1}`,kind:'html-image-reference',name:attrs.alt||attrs['data-query']||'Article image',url:attrs.src,query:attrs['data-query'],width:attrs.width,height:attrs.height});
    for(const child of node.children||[])visit(child);
  };
  nodes.forEach(visit);
  return sourceBundle({id,name,kind:'html',origin,assets,blocks:sections.map(s=>({heading:s.heading,text:s.text,kind:'section'})),
    design:{sectionCount:sections.length,headings},warnings:[]});
}
