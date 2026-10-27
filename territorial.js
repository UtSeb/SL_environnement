/* Administrative catalogues and browser-local intersections of mixed GeoJSON. */
(function(root){
  'use strict';
  const S=typeof module!=='undefined'?require('./spatial.js'):root.Spatial;
  const P=typeof module!=='undefined'?require('./vendor/polygon-clipping.min.js'):root.polygonClipping;
  const masks=new WeakMap();
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[’']/g,' ');
  function catalog(fc,type){
    const codeField=type==='epci'?'code_siren':'code_insee',seen=new Set();
    return fc.features.filter(f=>type==='epci'||(type==='commune'?/^\d{5}$/.test(String(f.properties?.code_insee)) : !/^\d{5}$/.test(String(f.properties?.code_insee)))).map(f=>{
      const p=f.properties||{},code=String(p[codeField]??'');
      if(!code||!p.nom_officiel||seen.has(code))throw Error('Code ou nom absent, ou code en doublon dans le référentiel.');
      if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))throw Error('Limite administrative non surfacique.');
      seen.add(code);return {key:type+'_'+code,code,name:p.nom_officiel,feature:f};
    }).sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.code.localeCompare(b.code));
  }
  function prepare(fc){
    if(masks.has(fc))return masks.get(fc);
    const polygons=fc.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
    if(!polygons.length)throw Error('Le périmètre est vide.');
    const mask={lines:S.prepareMask(fc),polygons};masks.set(fc,mask);return mask;
  }
  function overlap(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
  function clipGeometry(g,mask){
    if(!g)return null;
    if(g.type==='GeometryCollection'){
      const geometries=g.geometries.map(x=>clipGeometry(x,mask)).filter(Boolean);
      return geometries.length?{type:'GeometryCollection',geometries}:null;
    }
    if(!g.coordinates?.length||!overlap(S.bounds(g.coordinates),mask.lines.box))return null;
    if(g.type==='Point')return S.contains(mask.lines,g.coordinates)?{type:'Point',coordinates:g.coordinates.slice(0,2)}:null;
    if(g.type==='MultiPoint'){
      const coordinates=g.coordinates.filter(p=>S.contains(mask.lines,p)).map(p=>p.slice(0,2));
      return coordinates.length?{type:'MultiPoint',coordinates}:null;
    }
    if(g.type==='LineString'||g.type==='MultiLineString')return S.clipFeature({type:'Feature',geometry:g,properties:{}},mask.lines)?.geometry||null;
    if(g.type==='Polygon'||g.type==='MultiPolygon'){
      const coordinates=P.intersection(g.coordinates,mask.polygons);
      return coordinates.length?{type:'MultiPolygon',coordinates}:null;
    }
    throw Error('Géométrie non prise en charge : '+g.type);
  }
  async function intersect(fc,perimeter){
    const mask=prepare(perimeter),features=[];
    for(let i=0;i<fc.features.length;i++){
      const f=fc.features[i];let geometry;
      try{geometry=clipGeometry(f.geometry,mask);}catch(e){throw Error('Intersection impossible pour l’entité '+i+' : '+e.message);}
      if(geometry){const {bbox,...rest}=f;features.push({...rest,properties:{...f.properties},geometry});}
      if(i%12===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {type:'FeatureCollection',features};
  }
  root.Territorial={normalize,catalog,intersect};
  if(typeof module!=='undefined')module.exports=root.Territorial;
})(typeof window!=='undefined'?window:globalThis);
