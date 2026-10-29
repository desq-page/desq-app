import collection from './office-color-schemes.json' with {type:'json'};
export const OFFICE_COLOR_SCHEMES=Object.freeze(collection.schemes);
export function officeColorScheme(value){const id=String(value||'').trim().toLowerCase();return OFFICE_COLOR_SCHEMES.find(s=>s.id===id||s.name.toLowerCase()===id)||OFFICE_COLOR_SCHEMES[0];}
export function officeColorCatalogue(){return OFFICE_COLOR_SCHEMES.map(({id,name,colors})=>({id,name,colors}));}
