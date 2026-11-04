// The SVG geometry transport carries a bounded native gradient, never arbitrary XML.
export function imageAlphaMask(value) {
  if (!value) return undefined;
  const input=JSON.parse(value),stops=input.gsLst?.gs,angle=Number(input.lin?.$_ang);
  if (!Array.isArray(stops)||stops.length<2||stops.length>16||!Number.isFinite(angle)) throw Error('Invalid image alpha mask.');
  return {gsLst:{gs:stops.map(stop=>{
    const pos=Number(stop.$_pos),alpha=Number(stop.uniClr?.alpha?.$_val);
    if (![pos,alpha].every(v=>Number.isFinite(v)&&v>=0&&v<=100000))throw Error('Invalid image alpha mask stop.');
    return {$_pos:Math.round(pos),uniClr:{$_otag:'srgbClr',$_val:'FFFFFF',alpha:{$_val:Math.round(alpha)}}};
  })},lin:{$_ang:Math.round((angle%21600000+21600000)%21600000),$_scaled:1}};
}
