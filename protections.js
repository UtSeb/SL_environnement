/* Protection and inventory layers, intersected offline with the supplied territories. */
'use strict';
const Protections=(()=>{
  let definitions=[],map,current='sl',revision=0,ready=false;
  const selected=new Set(),layers=new Map(),cache=new Map(),pending=new Map();
  const el=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=f=>{const p=f.properties||{};return p.NOM_SITE||p.SITENAME||p.NOM||p.nom_site||p.nom||p.CODE_ENS||p.ID_MNHN||p.fid||'Sans nom';};
  async function data(d,key){
    const id=key+'/'+d.id;if(cache.has(id))return cache.get(id);
    if(!pending.has(id))pending.set(id,(async()=>{const r=await fetch('data/protections/'+key+'/'+d.id+'.geojson');if(!r.ok)throw Error(d.label+' — HTTP '+r.status);const fc=await r.json();if(fc.type!=='FeatureCollection')throw Error('GeoJSON invalide : '+d.label);cache.set(id,fc);return fc;})().finally(()=>pending.delete(id)));
    return pending.get(id);
  }
  function clear(){for(const l of layers.values())map.removeLayer(l);layers.clear();}
  async function draw(d,key,version){
    const note=el('note_'+d.id);note.textContent='Chargement…';
    try{
      const fc=await data(d,key);if(version!==revision||!selected.has(d.id))return;
      const style={color:d.color,weight:2,fillOpacity:Number(el('protectionOpacity').value)/100,opacity:.9};
      const layer=L.geoJSON(fc,{style,pointToLayer:(f,p)=>L.circleMarker(p,{...style,radius:6,fillOpacity:.9}),onEachFeature:(f,l)=>l.bindPopup('<h3>'+safe(title(f))+'</h3><b>'+safe(d.label)+'</b><div class="protection-attributes">'+Object.entries(f.properties||{}).map(([k,v])=>'<div><strong>'+safe(k)+'</strong> : '+safe(typeof v==='object'?JSON.stringify(v):v)+'</div>').join('')+'</div>')});
      if(layers.has(d.id))map.removeLayer(layers.get(d.id));layers.set(d.id,layer);layer.addTo(map);
      note.textContent=fc.features.length+' entité(s) · découpées';
    }catch(e){if(version===revision){note.textContent='Échec · décocher puis recocher pour réessayer';el('protectionStatus').textContent=e.message;}}
  }
  async function setTerritory(key){current=key;revision++;if(!ready)return;clear();el('protectionStatus').textContent='';for(const d of definitions){el('note_'+d.id).textContent=d.counts[key]+' entité(s)';}await Promise.all(definitions.filter(d=>selected.has(d.id)).map(d=>draw(d,key,revision)));}
  async function snapshot(key){
    const chosen=definitions.filter(d=>selected.has(d.id));
    return Promise.all(chosen.map(async d=>({name:d.id,features:(await data(d,key)).features,description:d.label+' ; intersection avec le périmètre fourni ; source : '+d.source})));
  }
  function provenance(){return JSON.stringify(definitions.filter(d=>selected.has(d.id)).map(d=>({couche:d.id,nom:d.label,fichier:'data/protections/sources/'+d.source})));}
  async function exportOnly(){
    const button=el('exportProtections'),key=current;button.disabled=true;
    try{const sources=provenance(),sets=await snapshot(key);if(!sets.some(s=>s.features.length))throw Error('Aucune entité dans les couches cochées pour ce territoire.');
      const SQL=await getSQL();const bytes=GeoPackage.create(SQL,[...sets,{name:'perimetre_analyse',features:territories[key].features}],{depot:'https://github.com/UtSeb/SL_environnement',territoire:territoryFiles[key][0],couches:sources,crs:'EPSG:4326',traitement:'Intersection Shapely 2 des géométries sources avec les périmètres fournis ; réparation si nécessaire ; aucune simplification. Les surfaces source restent celles de la source.',date_export:new Date().toISOString()});
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/geopackage+sqlite3'}));const a=document.createElement('a');a.href=url;a.download='protections_'+key+'.gpkg';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);el('protectionStatus').textContent='GeoPackage téléchargé.';
    }catch(e){el('protectionStatus').textContent='Export impossible : '+e.message;}finally{button.disabled=!selected.size;}
  }
  function showTable(d){
    const dialog=el('protectionDialog');el('protectionTableTitle').textContent=d.label+' · '+territoryFiles[current][0];
    const fc=cache.get(current+'/'+d.id);if(!fc)return;
    const props=[...new Set(fc.features.flatMap(f=>Object.keys(f.properties||{})))];
    el('protectionTable').innerHTML='<thead><tr>'+props.map(p=>'<th>'+safe(p)+'</th>').join('')+'</tr></thead><tbody>'+fc.features.map(f=>'<tr>'+props.map(p=>'<td>'+safe(typeof f.properties[p]==='object'?JSON.stringify(f.properties[p]):f.properties[p])+'</td>').join('')+'</tr>').join('')+'</tbody>';
    dialog.showModal();
  }
  async function init(m){
    map=m;
    try{const r=await fetch('data/protections/manifest.json');if(!r.ok)throw Error('Catalogue indisponible');definitions=await r.json();
      const groups=[...new Set(definitions.map(d=>d.group))];
      el('protectionLayers').innerHTML=groups.map(group=>'<details><summary>'+safe(group)+'</summary>'+definitions.filter(d=>d.group===group).map(d=>'<div class="protection-row"><label><input type="checkbox" data-protection="'+d.id+'"><i style="background:'+d.color+'"></i><span>'+safe(d.label)+'<small id="note_'+d.id+'">'+d.counts[current]+' entité(s)</small></span></label><button type="button" class="text-button" data-table="'+d.id+'" aria-label="Table attributaire de '+safe(d.label)+'">Table</button></div>').join('')+'</details>').join('');
      el('protectionLayers').addEventListener('change',e=>{const id=e.target.dataset.protection;if(!id)return;el('protectionStatus').textContent='';if(e.target.checked){selected.add(id);draw(definitions.find(d=>d.id===id),current,revision);}else{selected.delete(id);if(layers.has(id)){map.removeLayer(layers.get(id));layers.delete(id);}el('note_'+id).textContent=definitions.find(d=>d.id===id).counts[current]+' entité(s)';}el('exportProtections').disabled=!selected.size;});
      el('protectionLayers').addEventListener('click',async e=>{const id=e.target.dataset.table;if(!id)return;const d=definitions.find(d=>d.id===id),key=current;try{await data(d,key);if(key===current)showTable(d);}catch(err){el('protectionStatus').textContent=err.message;}});
      el('protectionOpacity').addEventListener('input',()=>layers.forEach(layer=>layer.setStyle({fillOpacity:Number(el('protectionOpacity').value)/100})));
      el('exportProtections').addEventListener('click',exportOnly);el('closeProtectionTable').addEventListener('click',()=>el('protectionDialog').close());ready=true;
    }catch(e){el('protectionStatus').textContent='Chargement des zonages impossible : '+e.message;}
  }
  return {init,setTerritory,snapshot,provenance};
})();
