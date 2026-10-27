'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
global.Spatial=require('../spatial.js');const G=require('../geopackage.js'),init=require('../vendor/sql-wasm.js');
(async()=>{
 const SQL=await init({locateFile:n=>path.resolve(__dirname,'../vendor',n)});
 const defs=JSON.parse(fs.readFileSync('data/protections/manifest.json'));assert.equal(defs.length,21);
 for(const territory of ['sl','sud54','meuse','vosges','sddv']){
  const sets=defs.map(d=>({name:d.id,features:JSON.parse(fs.readFileSync('data/protections/'+territory+'/'+d.id+'.geojson')).features}));
  for(let i=0;i<defs.length;i++)assert.equal(sets[i].features.length,defs[i].counts[territory]);
  const bytes=G.create(SQL,sets,{territory});const db=new SQL.Database(bytes);assert.equal(db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');assert.equal(db.exec('PRAGMA foreign_key_check').length,0);
  for(const set of sets.filter(s=>s.features.length))assert.equal(db.exec('SELECT count(*) FROM '+set.name)[0].values[0][0],set.features.length);
  fs.writeFileSync('/tmp/protections-'+territory+'.gpkg',bytes);db.close();console.log(territory,'exported',sets.reduce((n,s)=>n+s.features.length,0),'features');
 }
})().catch(e=>{console.error(e);process.exit(1)});
