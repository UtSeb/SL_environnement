/* Explicit, keyboard-accessible navigation for the cartographic workspace. */
'use strict';
const WorkspaceUI=(()=>{
 const el=id=>document.getElementById(id);let active='territory',searching=false,initialized=false;
 function show(name,focusTab=false){
  const panel=el('panel-'+name);if(!panel)return;
  const previous=el('panel-'+active),moveFocus=previous?.contains(document.activeElement);
  document.querySelectorAll('[role="tab"][data-panel]').forEach(tab=>{const selected=tab.dataset.panel===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  document.querySelectorAll('.workspace-panel').forEach(p=>p.hidden=p!==panel);
  active=name;document.querySelector('.panel-stack').scrollTop=0;
  if(initialized&&window.innerWidth<=720)document.querySelector('.sidebar').scrollIntoView({block:'start',behavior:'auto'});
  el('toggleLayers').setAttribute('aria-expanded',String(name==='layers'));
  if(focusTab)el('tab-'+name).focus();else if(moveFocus)panel.focus({preventScroll:true});
 }
 function feedback(text,error=false){el('workspaceFeedback').textContent=text;el('workspaceFeedback').title=text;el('workspaceFeedback').classList.toggle('error',error);}
 function updateLegend(){const water=el('showWater').checked;el('waterLegend').hidden=!water;el('mapLegend').hidden=!water&&el('landLegend').hidden;}
 function invalidate(){el('resultsEmpty').hidden=false;el('resultsBadge').hidden=true;el('resultsScope').textContent='Consommation foncière 2010–2021 et espaces d’intérêt écologique.';el('landExportHint').textContent='Lancer un croisement pour activer ces téléchargements.';el('landExport').disabled=true;el('landCsv').disabled=true;updateLegend();}
 function complete(scope){el('resultsEmpty').hidden=true;el('resultsBadge').hidden=false;el('resultsScope').textContent=scope+' / 2010–2021';el('landExportHint').textContent=el('activeTerritoryLabel').textContent+' / '+scope+' / 2010–2021';el('landExport').disabled=false;el('landCsv').disabled=false;updateLegend();show('results');}
 function setTerritory(name){el('activeTerritoryLabel').textContent=name;el('activeTerritoryLabel').title=name;}
 function updateBadge(){const count=Protections.selectedIds().length;el('layersBadge').hidden=!count;el('layersBadge').textContent=count;el('layersBadge').setAttribute('aria-label',count+' zonages cochés');}
 function filterLayers(){
  const term=Territorial.normalize(el('layerSearch').value);let count=0;
  el('protectionLayers').querySelectorAll('details').forEach(group=>{
   if(term&&!searching)group.dataset.wasOpen=String(group.open);
   let matches=0;group.querySelectorAll('.protection-row').forEach(row=>{const ok=!term||Territorial.normalize(row.querySelector('label').textContent).includes(term);row.hidden=!ok;if(ok)matches++;});
   group.hidden=!matches;if(term)group.open=!!matches;else if(searching){group.open=group.dataset.wasOpen==='true';delete group.dataset.wasOpen;}
   count+=matches;
  });
  searching=!!term;el('layerSearchStatus').textContent=term?(count?count+' zonage(s) correspondant(s)':'Aucun zonage correspondant. Modifier la recherche.'):'21 zonages, regroupés par famille.';
 }
 function layersReady(){el('layerSearch').disabled=false;const first=el('protectionLayers').querySelector('details');if(first)first.open=true;filterLayers();}
 function init(){
  document.querySelector('.workspace-nav').addEventListener('click',e=>{const tab=e.target.closest('button[data-panel]');if(tab)show(tab.dataset.panel);});
  document.querySelector('.workspace-nav').addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   const tabs=[...document.querySelectorAll('[role="tab"][data-panel]')],index=tabs.indexOf(e.target.closest('button[data-panel]'));if(index<0)return;e.preventDefault();
   const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;show(tabs[next].dataset.panel,true);
  });
  document.addEventListener('click',e=>{const button=e.target.closest('[data-panel-target]');if(button)show(button.dataset.panelTarget);});
  el('layerSearch').addEventListener('input',filterLayers);el('protectionLayers').addEventListener('change',()=>queueMicrotask(updateBadge));
  el('useCheckedLayers').addEventListener('click',()=>{if(!Protections.selectedIds().length){feedback('Cocher au moins un zonage avant de préparer le croisement.');return;}el('landScope').value='checked';el('landScope').dispatchEvent(new Event('change'));show('cross');});
  el('showWaterFromTab').addEventListener('click',()=>{el('showWater').checked=true;el('showWater').dispatchEvent(new Event('change'));feedback('Cours d’eau affichés sur la carte.');});
  el('openWaterTable').addEventListener('click',()=>{if(el('tablePanel').hidden)el('toggleTable').click();});
  el('showWater').addEventListener('change',updateLegend);
  el('jumpToMap').addEventListener('click',()=>document.querySelector('.map-workspace').scrollIntoView({block:'start',behavior:'auto'}));
  if(window.innerWidth<=720)el('mapDisplaySettings').open=false;
  show('territory');updateLegend();invalidate();initialized=true;
  const observer=new IntersectionObserver(entries=>{el('jumpToMap').hidden=entries[0].intersectionRatio>.25;},{threshold:[0,.25,.5]});observer.observe(document.querySelector('.map-workspace'));
 }
 return {init,show,complete,invalidate,setTerritory,layersReady,feedback,updateLegend};
})();
