'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const S=require('../spatial.js');
const square=[[[0,0],[2,0],[2,2],[0,2],[0,0]]];
const polygon=c=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:c}});
const mask=c=>S.prepareMask({type:'FeatureCollection',features:[polygon(c)]});
const line=c=>({type:'Feature',properties:{name:'original'},geometry:{type:'LineString',coordinates:c}});
let r=S.clipFeature(line([[-1,1],[3,1]]),mask(square));
assert.deepEqual(r.geometry.coordinates,[[[0,1],[2,1]]]);
assert.equal(r.properties.name,'original');
assert.equal(S.clipFeature(line([[-1,-1],[-2,-2]]),mask(square)),null);
assert.deepEqual(S.clipFeature(line([[.5,.5],[1.5,1.5]]),mask(square)).geometry.coordinates,[[[.5,.5],[1.5,1.5]]]);
const holed=[...square,[[.5,.5],[.5,1.5],[1.5,1.5],[1.5,.5],[.5,.5]]];
r=S.clipFeature(line([[-1,1],[3,1]]),mask(holed));
assert.deepEqual(r.geometry.coordinates,[[[0,1],[.5,1]],[[1.5,1],[2,1]]]);
assert.deepEqual(S.clipFeature(line([[-1,0],[3,0]]),mask(square)).geometry.coordinates,[[[0,0],[2,0]]]);
assert.equal(S.clipFeature(line([[-1,-1],[0,0],[-1,1]]),mask(square)),null);
const multi={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:[square,[[[4,0],[6,0],[6,2],[4,2],[4,0]]]]}}]};
r=S.clipFeature(line([[-1,1],[7,1]]),S.prepareMask(multi));assert.deepEqual(r.geometry.coordinates,[[[0,1],[2,1]],[[4,1],[6,1]]]);
assert.ok(Math.abs(S.lengthKm({type:'LineString',coordinates:[[0,0],[1,0]]})-111.19508)<.001);
// A closed-ring repeated coordinate must not make every point a boundary point.
assert.equal(S.contains(mask(square),[3,1]),false);
const water=JSON.parse(fs.readFileSync('data/Etats general - ecologique - chimique - masses eaux Sl-alleger.geojson'));
const results={};
for(const f of ['Limites SL.geojson','Plaque Sud54.geojson','Plaque SudMeuse.geojson','Plaque Vosges Ouest.geojson','Plaque SDDV.geojson']){
 const territory=JSON.parse(fs.readFileSync('data/'+f)),prepared=S.prepareMask(territory);
 const start=Date.now(),clipped=water.features.map(f=>S.clipFeature(f,prepared)).filter(Boolean);
 assert.ok(clipped.length>0);assert.ok(clipped.every(f=>f.properties.longueur_km>0));
 // Check that every retained elementary segment midpoint is actually in the mask.
 for(const f of clipped)for(const c of f.geometry.coordinates)for(let i=1;i<c.length;i++)assert.ok(S.contains(prepared,[(c[i][0]+c[i-1][0])/2,(c[i][1]+c[i-1][1])/2]));
 results[f]={count:clipped.length,km:clipped.reduce((s,f)=>s+f.properties.longueur_km,0),ms:Date.now()-start};
}
fs.writeFileSync('/tmp/sl-spatial-results.json',JSON.stringify(results));
console.log('Spatial checks passed: crossings, holes, boundary, disjoint polygons, source attributes, real datasets.');console.log(results);
