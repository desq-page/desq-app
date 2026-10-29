// Template character counts are writing guidance, not a reason to reject a deck.
// Measure inherited geometry and typography; never cut off original text.
export function fitNativeTemplateText(value,object,{maxLength,measureFits}={}){
 const text=String(value??'');
 let probe;
 if(!measureFits&&object?.width>0&&object?.height>0&&object?.fontSize>0&&typeof document!=='undefined'){
  probe=document.createElement('div');
  Object.assign(probe.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',boxSizing:'border-box',width:Math.max(1,object.width-4)+'px',height:Math.max(1,object.height)+'px',fontFamily:object.fontFamily||'Arial',fontSize:object.fontSize+'px',fontWeight:object.fontWeight||'700',fontStyle:object.fontStyle||'normal',lineHeight:Math.max(1,Math.min(object.fontSize*(object.lineHeight||1.2),object.height))+'px',letterSpacing:(object.letterSpacing||0)+'px',whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'0',margin:'0',border:'0',overflow:'hidden'});
  document.body.appendChild(probe);
  measureFits=value=>{probe.textContent=value;return probe.scrollHeight<=probe.clientHeight+1&&probe.scrollWidth<=probe.clientWidth+1;};
 }
 const fits=measureFits||(value=>!maxLength||[...value].length<=maxLength);
 try{
  if(!text||fits(text))return {text};
  return {text,original:text};
 }finally{probe?.remove();}
}


export const NATIVE_REPHRASE_INSTRUCTIONS='Rephrase this slide text more concisely to fit its existing textbox. Preserve meaning, key facts, names, dates and all numeric values. Keep the original language. Return only the complete rewritten text, without JSON, commentary, quotes or ellipses. Do not truncate sentences. If you cannot shorten it without losing essential information, return the original text.';
export async function rephraseNativeTemplateText(value,object,{rewriteText,signal,onProgress,maxLength,measureFits}={}){
 const initial=fitNativeTemplateText(value,object,{maxLength,measureFits});
 if(!initial.original||!rewriteText)return initial;
 signal?.throwIfAborted();
 try{
  onProgress?.('Rephrasing text to fit its template textbox…');
  const response=await rewriteText({text:initial.text,maxLength:Math.max(1,Math.min(maxLength||initial.text.length-1,initial.text.length-1)),box:object?{width:object.width,height:object.height,fontSize:object.fontSize}:undefined},{signal,onProgress});
  signal?.throwIfAborted();
  const shorter=(typeof response==='string'?response:response?.text)?.trim();
  if(!shorter||shorter.length>=initial.text.length||/…|\.\.\./u.test(shorter))return initial;
  const numbers=initial.text.match(/\d+(?:[.,]\d+)*/g)||[];
  if(numbers.some(number=>!shorter.includes(number)))return initial;
  const fitted=fitNativeTemplateText(shorter,object,{maxLength,measureFits});
  return fitted.original?initial:{...fitted,original:initial.text,rephrased:true};
 }catch(error){signal?.throwIfAborted();return initial;}
}
