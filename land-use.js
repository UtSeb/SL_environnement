/* OCS Grand Est 2010–2021 consumption crossed with selected ecological spaces. */
'use strict';
const LandUse=(()=>{
 const el=id=>document.getElementById(id),fmt=(v,d=2)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let map,worker=null,manifest=null,result=null,key='sl',version=0,allLayer=null,crossLayer=null,zoneLayer=null,resultKey=null,resultIds=[],resultScope='';
 function note(t,error=false){el('landStatus').textContent=t;el('landStatus').classList.toggle('error',error);status('Foncier : '+t,error);}
 function clear(){version++;if(worker){worker.terminate();worker=null;}if(allLayer)map.removeLayer(allLayer);if(crossLayer)map.removeLayer(crossLayer);if(zoneLayer)map.removeLayer(zoneLayer);allLayer=crossLayer=zoneLayer=null;result=null;el('indicatorTitle').textContent=titles[el('mode').value];document.querySelector('.map-note').textContent='Données de démonstration / millésime à documenter';el('landResults').hidden=true;el('landLegend').hidden=true;el('landRun').disabled=!territories[key];}
 function setTerritory(k){key=k;clear();note('Choisir les espaces à comparer, puis lancer le croisement.');}
 async function getManifest(){if(!manifest){const r=await fetch('data/foncier/manifest.json');if(!r.ok)throw Error('Catalogue foncier indisponible.');manifest=await r.json();}return manifest;}
 function popup(f,cross){const p=f.properties;return '<div class="popup-code">OCS Grand Est / 2010–2021 / objet '+esc(p.ocs_id)+'</div><h3>'+esc(p.lib_10_n3)+' → '+esc(p.lib_21_n3)+'</h3><p>Consommation dans le territoire : <b>'+fmt(p.surface_territoire_ha,4)+' ha</b></p>'+(cross?'<p>Dans les espaces retenus : <b>'+fmt(p.surface_croisee_ha,4)+' ha</b></p><p>'+esc(p.espaces)+'</p>':'')+'<p class="hint">Intersection avec les zonages fournis. Leur présence à la date du changement n’est pas établie.</p>';}
 async function render(data,revision,ids,k){
  let spaces=[];try{spaces=await Protections.forIds(ids,k);}catch(e){console.warn('Fond des espaces comparés indisponible',e);}
  if(revision!==version)return false;
  zoneLayer=L.geoJSON({type:'FeatureCollection',features:spaces.flatMap(s=>s.features)},{pane:'landZones',interactive:false,style:{color:'#215f69',weight:1,fillOpacity:.045}});
  if(el('landShowZones').checked)zoneLayer.addTo(map);
  const make=(color,fillOpacity,cross)=>L.geoJSON(null,{pane:cross?'landCross':'landBase',style:{color,weight:cross?1:.5,fillOpacity},onEachFeature:(f,l)=>l.bindPopup(popup(f,cross))});
  allLayer=make('#ad7130',.25,false);crossLayer=make('#b52b36',.85,true);
  for(let i=0;i<Math.max(data.consumption.features.length,data.crossed.features.length);i+=300){
   if(revision!==version)return false;
   allLayer.addData(data.consumption.features.slice(i,i+300));crossLayer.addData(data.crossed.features.slice(i,i+300));await new Promise(r=>setTimeout(r,0));
  }
  if(revision!==version)return false;
  if(el('landShowAll').checked)allLayer.addTo(map);crossLayer.addTo(map);
  if(el('showWater').checked){el('showWater').checked=false;el('showWater').dispatchEvent(new Event('change'));}
  return true;
 }
 function showStats(data){
  const s=data.stats;el('landTotal').textContent=fmt(s.totalHa);el('landInside').textContent=fmt(s.crossedHa);el('landPercent').textContent=s.percent===null?'—':fmt(s.percent,1)+' %';
  el('landResultTitle').textContent=territoryFiles[key][0];el('landCount').textContent=fmt(s.count,0)+' polygone(s) concernés sur '+fmt(s.sourceCount,0)+'.';
  el('landBreakdown').innerHTML=Object.entries(s.byDestination).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,ha])=>'<tr><td>'+esc(name)+'</td><td>'+fmt(ha)+' ha</td></tr>').join('');
  el('landHotspots').innerHTML=data.crossed.features.map((f,i)=>({f,i})).sort((a,b)=>b.f.properties.surface_croisee_ha-a.f.properties.surface_croisee_ha).slice(0,5).map(({f,i})=>'<button type="button" class="land-hotspot" data-land-feature="'+i+'">'+esc(f.properties.lib_21_n3)+'<b>'+fmt(f.properties.surface_croisee_ha)+' ha</b></button>').join('');
  el('landResults').hidden=false;el('landLegend').hidden=false;el('landHeading').scrollIntoView({block:'start',behavior:'auto'});
 }
 async function run(){
  if(busy){note('L’analyse du territoire est en cours. Réessayer dans un instant.');return;}
  clear();const revision=version,k=key;el('landRun').disabled=true;note('Préparation du croisement…');
  try{
   const m=await getManifest();if(revision!==version)return;
   const scope=el('landScope').value;
   const wanted=scope==='znieff'?['zonage_12','zonage_16']:scope==='natura'?['zonage_04','zonage_19']:scope==='reglementaires'?m.layers.filter(d=>d.group==='Protections réglementaires').map(d=>d.id):Protections.selectedIds();
   const ids=wanted.filter(id=>m.layers.some(d=>d.id===id));
   if(!ids.length)throw Error('Choisir au moins une couche surfacique. Les points et les lignes ne contribuent pas à ce croisement.');
   const ignored=wanted.length-ids.length;
   worker=worker||new Worker('land-worker.js?v=0.5');
   worker.onerror=e=>{if(revision!==version)return;note('Croisement impossible : '+(e.message||'erreur du moteur'),true);el('landRun').disabled=false;worker.terminate();worker=null;};
   worker.onmessage=async e=>{
    if(revision!==version)return;
    if(e.data.progress){note(e.data.progress);return;}
    if(e.data.error){note('Croisement impossible : '+e.data.error,true);el('landRun').disabled=false;return;}
    try{
     note('Affichage des résultats…');const ok=await render(e.data.result,revision,ids,k);if(!ok)return;
     result=e.data.result;resultKey=k;resultIds=ids;resultScope=el('landScope').selectedOptions[0].textContent;showStats(result);el('indicatorTitle').textContent='Consommation 2010–2021';document.querySelector('.map-note').textContent='OCS Grand Est / 2010–2021 / zonages fournis';
     note(result.stats.count?'Croisement terminé. Les secteurs rouges sont cliquables.'+(ignored?' Points et lignes exclus.':''):'Aucune consommation dans les espaces retenus sur ce territoire.');
    }catch(error){if(revision===version)note('Affichage impossible : '+error.message,true);}
    finally{if(revision===version)el('landRun').disabled=false;}
   };
   worker.postMessage({perimeter:territories[k],ids,whole:k==='sl'});
  }catch(e){if(revision===version){note(e.message,true);el('landRun').disabled=false;}}
 }
 function provenance(){return {source:'OCS Grand Est',millesime:2021,periode:'2010–2021',fichier_source:manifest.source_file,sha256_source:manifest.source_sha256,territoire:territoryFiles[resultKey][0],perimetre:resultKey,scenario:resultScope,couches:JSON.stringify(manifest.layers.filter(d=>resultIds.includes(d.id))),surfaces:'Hectares recalculés en Lambert-93 EPSG:2154 après intersection. Union des espaces par objet OCS ; absence de chevauchement surfacique des objets OCS vérifiée à la préparation.',limites:'Consommation selon la règle fournie, et non indicateur légal d’artificialisation nette. Zonages fournis : leur existence au moment de l’aménagement n’est pas établie. Ne démontre pas une atteinte écologique ni une infraction.',crs_geometries:'EPSG:4326',version_portail:'0.5'};}
 function download(bytes,mime,name){const url=URL.createObjectURL(new Blob([bytes],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function exportGpkg(){
  if(!result)return;const snapshot=result,k=resultKey,meta=provenance();el('landExport').disabled=true;
  try{const SQL=await getSQL(),bytes=GeoPackage.create(SQL,[{name:'consommation_2010_2021',features:snapshot.consumption.features},{name:'consommation_dans_espaces',features:snapshot.crossed.features},{name:'perimetre_analyse',features:territories[k].features}],meta);download(bytes,'application/geopackage+sqlite3','croisement_foncier_'+k+'_2010_2021.gpkg');note('GeoPackage téléchargé : consommation, intersections disponibles, périmètre et provenance.');}
  catch(e){note('Export impossible : '+e.message,true);}finally{el('landExport').disabled=false;}
 }
 function exportCsv(){if(!result)return;const s=result.stats,quote=v=>'"'+String(v??'').replaceAll('"','""')+'"',num=v=>v==null?'':String(v).replace('.',',');
  const rows=[['Territoire','Période','Espaces retenus','Bilan','Consommation totale (ha)','Surface croisée (ha)','Part consommation (%)'],[territoryFiles[resultKey][0],'2010–2021',resultScope,'Union sans double compte',num(s.totalHa),num(s.crossedHa),num(s.percent)],...Object.entries(s.layerAreas).map(([id,ha])=>[territoryFiles[resultKey][0],'2010–2021',resultScope,manifest.layers.find(d=>d.id===id).label+' (non additionnable aux autres couches)',num(s.totalHa),num(ha),num(s.totalHa?100*ha/s.totalHa:null)])];
  download('\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8','bilan_foncier_'+resultKey+'_2010_2021.csv');
 }
 function init(m){map=m;map.createPane('landZones');map.getPane('landZones').style.zIndex=410;map.createPane('landBase');map.getPane('landBase').style.zIndex=420;map.createPane('landCross');map.getPane('landCross').style.zIndex=430;
  el('landRun').addEventListener('click',run);el('landScope').addEventListener('change',()=>{clear();note('Choix modifié. Relancer le croisement.');});
  el('protectionLayers').addEventListener('change',()=>{if(el('landScope').value==='checked'){clear();note('Couches modifiées. Relancer le croisement.');}});
  el('landShowZones').addEventListener('change',()=>{if(zoneLayer)el('landShowZones').checked?zoneLayer.addTo(map):map.removeLayer(zoneLayer);});
  el('landViewMap').addEventListener('click',()=>document.querySelector('.map-workspace').scrollIntoView({block:'start',behavior:'auto'}));
  el('landShowAll').addEventListener('change',()=>{if(allLayer)el('landShowAll').checked?allLayer.addTo(map):map.removeLayer(allLayer);});
  el('landExport').addEventListener('click',exportGpkg);el('landCsv').addEventListener('click',exportCsv);
  el('landHotspots').addEventListener('click',e=>{const b=e.target.closest('button[data-land-feature]');if(!b||!result)return;const f=result.crossed.features[Number(b.dataset.landFeature)];crossLayer.eachLayer(l=>{if(l.feature===f){map.fitBounds(l.getBounds(),{padding:[60,60],maxZoom:17});l.openPopup();}});});
 }
 return {init,setTerritory};
})();
