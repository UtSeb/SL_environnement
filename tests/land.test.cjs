'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../land-core.js');global.Spatial=require('../spatial.js');const G=require('../geopackage.js'),init=require('../vendor/sql-wasm.js');
const read=p=>JSON.parse(fs.readFileSync(p));
(async()=>{
 const rect=(x,y,w,h)=>({type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]});
 const perimeter={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:rect(6,48,.02,.02)}]};
 const base=rect(6,48,.02,.02),left=rect(6,48,.015,.02),right=rect(6.005,48,.015,.02);
 const record={type:'Feature',geometry:base,properties:{ocs_id:1,lib_21_n3:'Habitat'},intersections:[[0,left],[1,right]]};
 const r=C.compute([record],perimeter,['a','b','a'],[{layer:'a',name:'A'},{layer:'b',name:'B'}],true);
 assert.ok(Math.abs(r.stats.totalHa-r.stats.crossedHa)<1e-7);assert.equal(r.stats.count,1);assert.ok(r.stats.layerAreas.a+r.stats.layerAreas.b>r.stats.crossedHa);
 const empty=C.compute([record],perimeter,['absent'],[{layer:'a'},{layer:'b'}],true);assert.equal(empty.stats.crossedHa,0);assert.equal(empty.crossed.features.length,0);
 const outside={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:rect(7,49,.01,.01)}]};assert.equal(C.compute([record],outside,['a'],[{layer:'a'},{layer:'b'}]).stats.percent,null);
 const m=read('data/foncier/manifest.json'),records=m.parts.flatMap(p=>read('data/foncier/'+p.file).features);assert.equal(records.length,m.count);assert.equal(new Set(records.map(f=>f.properties.ocs_id)).size,m.count);
 const whole=read('data/Limites SL.geojson'),proof=[];
 const scenarios=[{key:'sl',perimeter:whole,whole:true},...['88413','54578'].map(code=>({key:'commune_'+code,perimeter:{type:'FeatureCollection',features:read('data/administratif/catalogue.json').commune.flatMap(p=>read('data/'+p).features).filter(f=>String(f.properties.code_insee)===code)}}))];
 const SQL=await init({locateFile:n=>path.resolve(__dirname,'../vendor',n)});
 for(const scenario of scenarios){
  const out=C.compute(records,scenario.perimeter,['zonage_12','zonage_16'],m.zones,scenario.whole);
  assert.ok(out.stats.crossedHa>=0&&out.stats.crossedHa<=out.stats.totalHa+1e-7);
  if(scenario.whole)assert.ok(Math.abs(out.stats.totalHa-m.surface_sl_ha)<.00001);
  const bytes=G.create(SQL,[{name:'consommation_2010_2021',features:out.consumption.features},{name:'consommation_dans_espaces',features:out.crossed.features},{name:'perimetre_analyse',features:scenario.perimeter.features}],{source:m.source,millesime:m.millesime});
  const db=new SQL.Database(bytes);assert.equal(db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');assert.equal(db.exec('PRAGMA foreign_key_check').length,0);db.close();fs.writeFileSync('/tmp/land-'+scenario.key+'.gpkg',bytes);
  proof.push({...scenario,stats:out.stats});console.log(scenario.key,JSON.stringify(out.stats));
 }
 fs.writeFileSync('/tmp/land-proof.json',JSON.stringify({projected:C.project([6.184,48.69]),scenarios:proof}));
})().catch(e=>{console.error(e);process.exit(1)});
