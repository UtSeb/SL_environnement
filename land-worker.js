/* Expensive geometry operations run off the UI thread. */
importScripts('vendor/polygon-clipping.min.js','spatial.js','land-core.js?v=0.5');
let manifest=null;const cache=new Map();
async function json(path){const r=await fetch(path);if(!r.ok)throw Error(path+' : HTTP '+r.status);return r.json();}
onmessage=async event=>{
 const {perimeter,ids,whole}=event.data;
 try{
  manifest=manifest||await json('data/foncier/manifest.json');
  const box=Spatial.bounds(perimeter.features.map(f=>f.geometry.coordinates)),parts=manifest.parts.filter(p=>LandCore.overlap(p.bbox,box));
  const records=[];let done=0;
  for(let i=0;i<parts.length;i+=4){
   const group=await Promise.all(parts.slice(i,i+4).map(async p=>{if(!cache.has(p.file))cache.set(p.file,await json('data/foncier/'+p.file));return cache.get(p.file).features;}));
   group.forEach(fs=>records.push(...fs));done+=group.length;postMessage({progress:'Chargement des secteurs : '+done+' / '+parts.length});
  }
  const result=LandCore.compute(records,perimeter,ids,manifest.zones,whole,(i,n)=>postMessage({progress:'Calcul des surfaces : '+i+' / '+n}));
  postMessage({result});
 }catch(e){postMessage({error:e.message});}
};
