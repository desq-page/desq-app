// Model image wrappers carry the same data as canonical query/alt fields.
export function normalizeTemplateImageField(field){
 if(!field||typeof field!=='object'||Array.isArray(field)||!Object.hasOwn(field,'image'))return field;
 const {image,...result}=field;
 if(image===null||image===false||image==='')return result;
 let request;
 if(typeof image==='string')request={query:image,alt:image};
 else if(image&&typeof image==='object'&&!Array.isArray(image)){
  const unknown=Object.keys(image).find(key=>!['query','alt','description','id','name'].includes(key));
  if(unknown)throw Error(`Unknown image property: ${unknown}. Use query and alt.`);
  request={query:image.query??image.description,alt:image.alt??image.description??image.query};
 }else throw Error('Image must contain a description or query and alt.');
 for(const key of ['query','alt'])if(request[key]!==undefined){
  if(Object.hasOwn(result,key)&&result[key]!==request[key])throw Error(`Conflicting image ${key} values.`);
  result[key]=request[key];
 }
 return result;
}
