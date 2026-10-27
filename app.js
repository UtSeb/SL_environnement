/* Browser-local demonstrator with supplied environmental and administrative datasets. */
'use strict';
const $=id=>document.getElementById(id);
const territoryFiles={sl:['Sud-Lorraine','Limites SL.geojson'],sud54:['Sud 54','Plaque Sud54.geojson'],meuse:['Sud Meuse','Plaque SudMeuse.geojson'],vosges:['Vosges Ouest','Plaque Vosges Ouest.geojson'],sddv:['Saint-Dié — périmètre fourni','Plaque SDDV.geojson']};
const waterFile='Etats general - ecologique - chimique - masses eaux Sl-alleger.geojson';
const titles={ecologique:'État écologique',chimique:'État chimique',global:'État global — champ fourni'};
const classes={ecologique:['Très bon','Bon','Moyen','Médiocre','Mauvais','Inconnu'],chimique:['Bon','Non atteint','Inconnu'],global:['Bon','Moyen','Médiocre','Mauvais','Inconnu']};
const colors={'Très bon':'#287cb8',Bon:'#4b976b',Moyen:'#d5b640','Médiocre':'#dc863d',Mauvais:'#c04c4c','Non atteint':'#a365a3',Inconnu:'#929c98'};
const number=(v,digits=0)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(v);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const collection=features=>({type:'FeatureCollection',features});
let map,boundaryLayer,waterLayer,baseLayer;
let activeTerritory='sl',adminLoading=false,analysisReady=false;
const communeSources=["administratif/communes-01.geojson", "administratif/communes-02.geojson", "administratif/communes-03.geojson", "administratif/communes-04.geojson", "administratif/communes-05.geojson", "administratif/communes-06.geojson", "administratif/communes-07.geojson", "administratif/communes-08.geojson"];
const adminSources={epci:['administratif/epci.geojson'],commune:communeSources,group:communeSources};
const adminDatasets={};
const territoryLists={areas:Object.keys(territoryFiles).map(key=>({key,name:territoryFiles[key][0],code:''}))};
let allWater=null,territories={},clipped=[],visible=[],busy=false,exporting=false,sqlPromise=null;
const cache=new Map();
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function state(feature,mode=$('mode').value){
  const p=feature.properties,raw=p[{ecologique:'Etat ecologique',chimique:'Etat chimique',global:'Etat masse eau '}[mode]];
  if(raw&&classes[mode].includes(String(raw).trim()))return String(raw).trim();
  if(mode==='ecologique')return ({1:'Très bon',2:'Bon',3:'Moyen',4:'Médiocre',5:'Mauvais'})[p._swEcologicalStatusOrPotentialValue]||'Inconnu';
  if(mode==='chimique')return ({2:'Bon',3:'Non atteint'})[p._swChemicalStatusValue]||'Inconnu';
  return 'Inconnu';
}
function code(f){return f.properties.CdEuMasseDEau||String(f.properties.gid??f.properties.fid??'Sans code');}
function waterStyle(f){return {color:colors[state(f)],weight:3,opacity:Number($('waterOpacity').value)/100};}
function popup(f){
  const p=f.properties;
  return `<div class="popup-code">${escape(code(f))}</div><h3>${escape(p.NomMasseDEau||'Masse d’eau sans nom')}</h3>${['ecologique','chimique'].map(m=>`<div class="popup-state"><span>${escape(titles[m])}</span><b>${escape(state(f,m))}</b></div>`).join('')}<div class="popup-state"><span>Lignes dans le périmètre</span><b>${number(p.longueur_km,2)} km</b></div><p class="hint">Évaluation issue du fichier fourni. Millésime à documenter.</p>`;
}
function initMap(){
  map=L.map('map',{zoomControl:true,preferCanvas:true,zoomSnap:.25}).setView([48.45,6.2],8);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  boundaryLayer=L.geoJSON(null,{style:{color:'#254e3b',weight:2,dashArray:'6 5',fillColor:'#698e4b',fillOpacity:.035}}).addTo(map);
  waterLayer=L.geoJSON(null,{style:waterStyle,onEachFeature:(f,l)=>l.bindPopup(popup(f))}).addTo(map);
  setBasemap();
  ['layerPanel','tablePanel'].forEach(id=>{L.DomEvent.disableClickPropagation($(id));L.DomEvent.disableScrollPropagation($(id));});
}
function setBasemap(){
  if(!map)return;
  if(baseLayer)map.removeLayer(baseLayer);
  const prefix='https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&';
  const definitions={ign:[prefix+'FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}','© IGN',19],ortho:[prefix+'FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}','© IGN',19],osm:['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png','© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',19],relief:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}','© Esri, USGS',13]};
  const [url,attribution,maxNativeZoom]=definitions[$('basemap').value];
  baseLayer=L.tileLayer(url,{attribution,maxNativeZoom,maxZoom:19}).addTo(map);baseLayer.bringToBack();baseLayer.setOpacity($('basemap').value==='ign'?.65:1);
}
function fit(){if(boundaryLayer?.getBounds().isValid())map.fitBounds(boundaryLayer.getBounds(),{paddingTopLeft:[35,80],paddingBottomRight:[window.innerWidth>1150?310:45,100]});}
function populateStates(){
  $('stateFilter').replaceChildren(new Option('Tous les états','all'),...classes[$('mode').value].map(s=>new Option(s,s)));
  $('indicatorTitle').textContent=titles[$('mode').value];$('stateHeading').textContent=titles[$('mode').value];
  $('legend').innerHTML=classes[$('mode').value].map(s=>`<span class="legend-entry"><i style="background:${colors[s]}"></i>${escape(s)}</span>`).join('');
}
function refresh(){
  const filter=$('stateFilter').value;
  visible=clipped.filter(f=>filter==='all'||state(f)===filter);
  const counts={};for(const s of classes[$('mode').value])counts[s]=new Set();
  const ids=new Set();for(const f of visible){ids.add(code(f));counts[state(f)].add(code(f));}
  $('count').textContent=number(ids.size);
  $('length').textContent=number(visible.reduce((sum,f)=>sum+f.properties.longueur_km,0),1);
  $('tableCount').textContent=number(ids.size);
  $('distribution').innerHTML=classes[$('mode').value].map(s=>{const n=counts[s].size,pct=ids.size?100*n/ids.size:0;return `<div class="bar-row" title="${n} masse(s) d’eau — ${number(pct,1)} %"><span>${escape(s)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[s]}"></div></div><span class="bar-value">${number(n)}</span></div>`;}).join('');
  waterLayer.clearLayers();waterLayer.addData(collection(visible));
  $('export').disabled=busy||exporting||!analysisReady;
  renderTable();
}
function renderTable(){
  const term=$('search').value.trim().toLocaleLowerCase('fr');
  const rows=visible.map((f,i)=>({f,i})).filter(({f})=>(code(f)+' '+(f.properties.NomMasseDEau||'')).toLocaleLowerCase('fr').includes(term)).sort((a,b)=>(a.f.properties.NomMasseDEau||'').localeCompare(b.f.properties.NomMasseDEau||'','fr'));
  $('tableBody').innerHTML=rows.map(({f,i})=>`<tr><td>${escape(code(f))}</td><td><button type="button" data-feature="${i}">${escape(f.properties.NomMasseDEau||'Sans nom')}</button></td><td><span class="state-dot" style="background:${colors[state(f)]}"></span>${escape(state(f))}</td><td>${number(f.properties.longueur_km,2)} km</td></tr>`).join('');
  $('tableEmpty').hidden=rows.length!==0;
}
function tableOpen(open){$('tablePanel').hidden=!open;$('toggleTable').setAttribute('aria-expanded',String(open));}
async function analyze(){
  if(!allWater||busy||!territories[$('territory').value])return;
  busy=true;analysisReady=false;const key=$('territory').value;activeTerritory=key;
  $('territoryType').disabled=true;$('territorySearch').disabled=true;
  Protections.setTerritory(key).catch(e=>status('Zonages : '+e.message,true));
  $('territory').disabled=true;$('analyze').disabled=true;$('export').disabled=true;
  $('selectionBadge').textContent='Calcul en cours';status('Découpe des géométries au périmètre…');
  try{
    const fc=territories[key];boundaryLayer.clearLayers();boundaryLayer.addData(fc);
    $('territoryHint').textContent=(key.startsWith('commune_')?'Code INSEE : '+key.slice(8)+'. ':key.startsWith('epci_')?'Code SIREN : '+key.slice(5)+'. ':key.startsWith('group_')?'Regroupement fourni : attributs source non agrégés. ':'')+'Périmètre fourni ; les données environnementales restent limitées à leur couverture source.';
    $('mapTitle').textContent=territoryFiles[key][0];$('boundaryName').textContent=territoryFiles[key][0];
    if(!cache.has(key)){
      const mask=Spatial.prepareMask(fc),result=[];
      for(let i=0;i<allWater.features.length;i++){
        const f=Spatial.clipFeature(allWater.features[i],mask);
        if(f){f.properties.territoire_analyse=territoryFiles[key][0];result.push(f);}
        if(i%25===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      cache.set(key,result);
    }
    clipped=cache.get(key);analysisReady=true;$('selectionBadge').textContent='Découpe réalisée';
    busy=false;refresh();fit();
    status('Découpe réalisée · les filtres et l’export portent sur les géométries du territoire.');
  }catch(error){clipped=[];busy=false;refresh();$('selectionBadge').textContent='Échec';status('Analyse impossible : '+error.message,true);console.error(error);}
  finally{busy=false;$('territoryType').disabled=false;$('territorySearch').disabled=$('territoryType').value==='areas';$('territory').disabled=false;$('analyze').disabled=false;$('export').disabled=exporting||!analysisReady;}
}
async function loadJson(file){const r=await fetch('data/'+file.split('/').map(encodeURIComponent).join('/'));if(!r.ok)throw Error(file+' — HTTP '+r.status);const data=await r.json();if(data.type!=='FeatureCollection')throw Error(file+' : GeoJSON invalide');return data;}
function getSQL(){
  if(!sqlPromise)sqlPromise=(async()=>{
    if(!window.initSqlJs)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/sql-wasm.js';script.onload=resolve;script.onerror=()=>reject(Error('Le moteur GeoPackage n’a pas pu être chargé.'));document.head.append(script);});
    return initSqlJs({locateFile:file=>'vendor/'+file});
  })().catch(e=>{sqlPromise=null;throw e;});
  return sqlPromise;
}
async function exportGpkg(){
  if(!analysisReady||busy||exporting)return;
  exporting=true;$('export').disabled=true;const snapshot=visible.slice(),key=activeTerritory,mode=$('mode').value,filter=$('stateFilter').value;
  const oldText=$('export').innerHTML;$('export').textContent='Préparation du GeoPackage…';status('Création du GeoPackage dans votre navigateur…');
  try{
    const protectionSources=Protections.provenance(),protectionSets=await Protections.snapshot(key);
    const SQL=await getSQL();
    const perimeter=territories[key].features.map(f=>({...f,properties:{...f.properties,nom_perimetre:territoryFiles[key][0]}}));
    const bytes=GeoPackage.create(SQL,[{name:'cours_eau_decoupes',features:snapshot,description:'Lignes du fichier fourni, découpées au périmètre et filtrées.'},{name:'perimetre_analyse',features:perimeter,description:'Périmètre territorial utilisé pour la découpe.'},...protectionSets],{
      zonages:protectionSources,traitement_zonages:'Intersection aux limites fournies. Cinq périmètres initiaux : Shapely 2. Communes et EPCI : polygon-clipping pour les surfaces, Spatial pour les lignes et points, dans le navigateur. Surfaces attributaires source non recalculées.',
      depot:'https://github.com/UtSeb/SL_environnement',fichier_cours_eau:'data/'+waterFile,fichier_perimetre:territoryFiles[key][1].split(' ; ').map(path=>'data/'+path).join(' ; '),producteur_initial:'À renseigner',millesime_evaluation:'À renseigner',licence_donnees:'À renseigner',date_export:new Date().toISOString(),territoire:territoryFiles[key][0],indicateur:titles[mode],filtre_etat:filter==='all'?'Tous les états':filter,traitement:'Intersection des lignes avec les polygones du périmètre ; géométries 2D ; états repris de la source sans réévaluation.',longueur:'Kilomètres sur les lignes découpées ; distance sphérique, rayon 6371,0088 km ; réseau fourni non exhaustif.',crs:'EPSG:4326',version_portail:'0.4',identifiant_perimetre:key,attributs_perimetre:key.startsWith('group_')?'Regroupement fourni : attributs source non agrégés.':'Attributs source conservés.'
    });
    const blob=new Blob([bytes],{type:'application/geopackage+sqlite3'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='biodiversite_'+key+'_'+mode+'_'+new Date().toISOString().slice(0,10)+'.gpkg';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status('GeoPackage téléchargé · cours d’eau, zonages cochés, périmètre et provenance, prêts à ouvrir dans QGIS.');
  }catch(error){status('Export impossible : '+error.message,true);console.error(error);}
  finally{exporting=false;$('export').innerHTML=oldText;$('export').disabled=busy||!analysisReady;}
}
function filterTerritories(){
  const type=$('territoryType').value,term=Territorial.normalize($('territorySearch').value);
  const items=(territoryLists[type]||[]).filter(x=>Territorial.normalize(x.name+' '+x.code).includes(term));
  const previous=$('territory').value;
  $('territory').replaceChildren(...items.map(x=>new Option(x.name+(x.code&&type!=='group'?' ('+x.code+')':''),x.key)));
  if(items.some(x=>x.key===previous))$('territory').value=previous;
  else {const option=new Option(items.length?'Choisir dans les résultats':'Aucun résultat','',true,true);option.disabled=true;$('territory').prepend(option);}
  $('territory').disabled=!items.length||busy||adminLoading;
  $('analyze').disabled=busy||adminLoading||!$('territory').value;
  $('territoryMatches').textContent=type==='areas'?'':number(items.length)+' résultat(s)';
}
async function changeTerritoryType(){
  if(busy||adminLoading)return;
  const type=$('territoryType').value;$('territorySearch').value='';
  adminLoading=true;$('territoryType').disabled=true;$('territory').disabled=true;$('analyze').disabled=true;$('territorySearch').disabled=true;
  try{
    if(!territoryLists[type]){
      $('territoryMatches').textContent='Chargement du référentiel…';
      const paths=adminSources[type],cacheKey=paths.join(';');
      const fc=adminDatasets[cacheKey]||(adminDatasets[cacheKey]=collection((await Promise.all(paths.map(loadJson))).flatMap(fc=>fc.features)));const items=Territorial.catalog(fc,type);
      for(const item of items){territories[item.key]=collection([item.feature]);territoryFiles[item.key]=[item.name,adminSources[type].join(' ; ')];}
      territoryLists[type]=items;
    }
    adminLoading=false;filterTerritories();
    if(territoryLists[type].some(x=>x.key===activeTerritory)){$('territory').value=activeTerritory;$('analyze').disabled=false;}
    $('territoryHint').textContent='Rechercher un nom ou un code, puis sélectionner un périmètre. La carte conserve la dernière analyse jusqu’à la sélection.';
  }catch(e){$('territoryMatches').textContent='Chargement impossible : '+e.message;}
  finally{adminLoading=false;$('territoryType').disabled=false;$('territorySearch').disabled=type==='areas';}
}
function bindEvents(){
  $('territoryType').addEventListener('change',changeTerritoryType);$('territorySearch').addEventListener('input',filterTerritories);
  $('territory').addEventListener('change',analyze);$('analyze').addEventListener('click',analyze);
  $('mode').addEventListener('change',()=>{populateStates();if(map)refresh();});
  $('stateFilter').addEventListener('change',()=>{if(map)refresh();});
  $('export').addEventListener('click',exportGpkg);$('basemap').addEventListener('change',setBasemap);$('fit').addEventListener('click',fit);
  $('showWater').addEventListener('change',()=>{if(map)$('showWater').checked?waterLayer.addTo(map):map.removeLayer(waterLayer);});
  $('showBoundary').addEventListener('change',()=>{if(map)$('showBoundary').checked?boundaryLayer.addTo(map):map.removeLayer(boundaryLayer);});
  $('waterOpacity').addEventListener('input',()=>waterLayer?.setStyle(waterStyle));
  $('toggleLayers').addEventListener('click',()=>{const open=$('layerPanel').hidden;$('layerPanel').hidden=!open;$('toggleLayers').setAttribute('aria-expanded',String(open));});
  $('toggleTable').addEventListener('click',()=>tableOpen($('tablePanel').hidden));$('closeTable').addEventListener('click',()=>tableOpen(false));
  $('search').addEventListener('input',renderTable);
  $('tableBody').addEventListener('click',e=>{const button=e.target.closest('button[data-feature]');if(!button)return;const f=visible[Number(button.dataset.feature)];let target;waterLayer.eachLayer(l=>{if(l.feature===f)target=l;});if(target){tableOpen(false);map.fitBounds(target.getBounds(),{padding:[65,65],maxZoom:13});target.openPopup();}});
  $('sources').addEventListener('click',()=>$('sourceDialog').showModal());$('closeSources').addEventListener('click',()=>$('sourceDialog').close());
  if(window.innerWidth<=1150){$('layerPanel').hidden=true;$('toggleLayers').setAttribute('aria-expanded','false');}
}
async function start(){
  populateStates();bindEvents();
  try{
    if(typeof L==='undefined')throw Error('Le composant cartographique n’a pas pu être chargé. Vérifiez votre connexion puis rechargez la page.');
    initMap();await Protections.init(map);
    const keys=Object.keys(territoryFiles);
    const datasets=await Promise.all([loadJson(waterFile),...keys.map(k=>loadJson(territoryFiles[k][1]))]);
    allWater=datasets[0];keys.forEach((k,i)=>territories[k]=datasets[i+1]);
    $('territory').disabled=false;$('analyze').disabled=false;await analyze();
  }catch(error){status('Chargement impossible : '+error.message,true);$('selectionBadge').textContent='Indisponible';console.error(error);}
}
start();
