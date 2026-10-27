'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');
global.Spatial=require('../spatial.js');const G=require('../geopackage.js');const init=require('../vendor/sql-wasm.js');
(async()=>{
 const SQL=await init({locateFile:name=>require('node:path').resolve(__dirname,'../vendor',name)});
 const territory=JSON.parse(fs.readFileSync('data/Plaque Sud54.geojson'));
 const water=JSON.parse(fs.readFileSync('data/Etats general - ecologique - chimique - masses eaux Sl-alleger.geojson'));
 const mask=Spatial.prepareMask(territory),features=water.features.map(f=>Spatial.clipFeature(f,mask)).filter(Boolean);
 const bytes=G.create(SQL,[{name:'cours_eau_decoupes',features},{name:'perimetre_analyse',features:territory.features}],{source:'Dépôt existant ; millésime à documenter',traitement:'Intersection test',crs:'EPSG:4326'});
 const db=new SQL.Database(bytes);
 assert.equal(db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');
 assert.equal(db.exec('SELECT count(*) FROM cours_eau_decoupes')[0].values[0][0],features.length);
 assert.equal(db.exec('SELECT count(*) FROM gpkg_contents')[0].values[0][0],3);
 assert.equal(db.exec('PRAGMA foreign_key_check').length,0);
 const names=db.exec('PRAGMA table_info(cours_eau_decoupes)')[0].values.map(v=>v[1]);
 assert.ok(names.includes('fid'));assert.ok(names.includes('gpkg_fid'));assert.ok(names.includes('Etat masse eau '));
 fs.writeFileSync('/tmp/sl-demo-test.gpkg',bytes);db.close();console.log('GeoPackage generated and SQLite integrity checked:',features.length,'features,',bytes.length,'bytes.');
})().catch(e=>{console.error(e);process.exit(1)});
