'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const T=require('../territorial.js');global.Spatial=require('../spatial.js');const G=require('../geopackage.js'),init=require('../vendor/sql-wasm.js');
const read=p=>JSON.parse(fs.readFileSync(p));
(async()=>{
 const manifest=read('data/administratif/catalogue.json');
 const communes={type:'FeatureCollection',features:manifest.commune.flatMap(p=>read('data/'+p).features)},epci=read('data/administratif/epci.geojson');
 const c=T.catalog(communes,'commune'),e=T.catalog(epci,'epci'),groups=T.catalog(communes,'group');assert.equal(c.length,1172);assert.equal(groups.length,2);assert.equal(e.length,32);
 assert.equal(new Set(c.map(x=>x.code)).size,1172);assert.equal(new Set(e.map(x=>x.code)).size,32);
 assert.ok(T.normalize('Saint-Dié-des-Vosges').includes(T.normalize('saint-die')));
 const ring=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
 const mask={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring(0,0,10),ring(4,4,2)]}}]};
 const mixed={type:'FeatureCollection',features:[{type:'Feature',id:'mixed',bbox:[-1,-1,20,20],properties:{id:'keep'},geometry:{type:'GeometryCollection',geometries:[{type:'Polygon',coordinates:[ring(-1,-1,12)]},{type:'LineString',coordinates:[[-1,5],[11,5]]},{type:'MultiPoint',coordinates:[[1,1],[5,5],[12,12]]}]}}]};
 const result=await T.intersect(mixed,mask);assert.equal(result.features.length,1);assert.equal(result.features[0].id,'mixed');assert.equal(result.features[0].properties.id,'keep');assert.ok(!('bbox' in result.features[0]));
 const parts=result.features[0].geometry.geometries;assert.equal(parts.length,3);assert.equal(parts[0].coordinates[0].length,2);assert.equal(parts[1].coordinates.length,2);assert.deepEqual(parts[2].coordinates,[[1,1]]);
 assert.equal(mixed.features[0].geometry.geometries[2].coordinates.length,3);
 const defs=read('data/protections/manifest.json');
 const chosen=[...['54578','52289','88413'].map(code=>c.find(x=>x.code===code)),e.find(x=>x.name.includes('Grand Nancy')),e.find(x=>x.name.includes('Saint-Dié'))];assert.ok(chosen.every(Boolean));
 const SQL=await init({locateFile:n=>path.resolve(__dirname,'../vendor',n)}),outputs=[];
 for(const item of chosen){
  const perimeter={type:'FeatureCollection',features:[item.feature]},sets=[];
  for(const d of defs){const clipped=await T.intersect(read('data/protections/sl/'+d.id+'.geojson'),perimeter);sets.push({name:d.id,features:clipped.features});}
  const bytes=G.create(SQL,[...sets,{name:'perimetre_analyse',features:perimeter.features}],{territoire:item.name,code:item.code});
  const db=new SQL.Database(bytes);assert.equal(db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');assert.equal(db.exec('PRAGMA foreign_key_check').length,0);db.close();
  fs.writeFileSync('/tmp/admin-'+item.key+'.gpkg',bytes);outputs.push({key:item.key,name:item.name,perimeter,sets});console.log(item.name,sets.reduce((n,s)=>n+s.features.length,0),'entités découpées');
 }
 fs.writeFileSync('/tmp/admin-intersections.json',JSON.stringify(outputs));
 console.log('Catalogues, trous, géométries mixtes et exports administratifs vérifiés.');
})().catch(e=>{console.error(e);process.exit(1)});
