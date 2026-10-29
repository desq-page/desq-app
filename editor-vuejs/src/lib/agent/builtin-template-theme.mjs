import {OFFICE_COLOR_SCHEMES} from './office-color-schemes.mjs';
import {legibleInk} from './deck-design.mjs';
export {OFFICE_COLOR_SCHEMES as BUILTIN_THEMES};
// Convert authored RGB roles to native theme references. Apply one Office scheme
// to the whole family; layouts and placeholder IDs never change.
export function applyBuiltinTemplateTheme(parts,id='office'){
 const selected=OFFICE_COLOR_SCHEMES.find(s=>s.id===id);if(!selected)throw Error('Unknown Office theme color scheme.');
 const colors=selected.colors,ink=color=>legibleInk('#'+color)==='#FFFFFF'?'lt1':'dk1';
 const refs={'F7FAFC':['lt1',''],'142D43':['dk2',''],'087F8C':['accent1',''],'C46B32':['accent2',''],'4C6374':['dk2','<a:lumMod val="75000"/><a:lumOff val="25000"/>'],'E6EFF3':['lt2',''],'FFFFFF':['lt1',''],'14202C':['dk1',''],'AAB4BF':['accent1','<a:tint val="60000"/>'],'526170':['dk2','']};
 for(const path of Object.keys(parts)){
  if(!/^ppt\/(?:slideLayouts|slideMasters|charts)\/[^/]+\.xml$/.test(path)&&!/^ppt\/(?:.*\/)?theme\/[^/]+\.xml$/.test(path))continue;
  let xml=new TextDecoder().decode(parts[path]);
  if(path.includes('/theme/')){
   for(const [tag,color]of Object.entries(colors)){
    const pattern=new RegExp(`(<((?:[\\w.-]+:)?)${tag}\\b[^>]*>)[\\s\\S]*?(</(?:[\\w.-]+:)?${tag}>)`,'g');
    xml=xml.replace(pattern,(_,open,prefix,close)=>`${open}<${prefix}srgbClr val="${color}"/>${close}`);
   }
   xml=xml.replace(/(<(?:[\w.-]+:)?(?:theme|clrScheme)\b[^>]*\bname=")[^"]*(")/g,`$1${selected.name}$2`);
  }else{
   xml=xml.replace(/<([\w.-]+:)?srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?srgbClr>)/g,(all,prefix='',color,children='')=>{
    const ref=refs[color.toUpperCase()];if(!ref)return all;
    return `<${prefix}schemeClr val="${ref[0]}">${ref[1].replaceAll('a:',prefix)}${children}</${prefix}schemeClr>`;
   });
   // These two roles identify ink authored over accent1 and accent2 respectively.
   // A single pass avoids remapping newly-chosen dark/light ink a second time.
   xml=xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g,shape=>shape.replace(/(<(?:[\w.-]+:)?schemeClr\b[^>]*\bval=")(lt1|dk1)(")/g,(_,before,role,after)=>before+ink(role==='lt1'?colors.accent1:colors.accent2)+after));
   if(path.includes('/slideMasters/'))xml=xml.replace(/(<(?:[\w.-]+:)?cSld\b[^>]*\bname=")[^"]*(")/,`$1Built-in · ${selected.name}$2`);
  }
  parts[path]=new TextEncoder().encode(xml);
 }
}
