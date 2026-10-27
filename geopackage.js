/* GeoPackage 1.3, 2D WGS84 vector export. SQLite supplied by sql.js. */
(function(root){
  'use strict';
  const quote=name=>'"'+name.replaceAll('"','""')+'"';
  function binaryGeometry(g) {
    const bytes=[];
    const u32=n=>{const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n,true);bytes.push(...a);};
    const point=p=>{for(const v of p.slice(0,2)){const a=new Uint8Array(8);new DataView(a.buffer).setFloat64(0,v,true);bytes.push(...a);}};
    const line=c=>{u32(c.length);c.forEach(point);};
    const polygon=c=>{u32(c.length);c.forEach(line);};
    const write=g=>{
      const types={Point:1,LineString:2,Polygon:3,MultiPoint:4,MultiLineString:5,MultiPolygon:6};
      if(!types[g.type])throw Error('Géométrie non prise en charge : '+g.type);
      bytes.push(1);u32(types[g.type]);
      if(g.type==='Point')point(g.coordinates);
      else if(g.type==='LineString')line(g.coordinates);
      else if(g.type==='Polygon')polygon(g.coordinates);
      else {u32(g.coordinates.length);const type={MultiPoint:'Point',MultiLineString:'LineString',MultiPolygon:'Polygon'}[g.type];g.coordinates.forEach(c=>write({type,coordinates:c}));}
    };
    // Little endian, no optional envelope, non-empty standard geometry.
    bytes.push(0x47,0x50,0,1);u32(4326);write(g);return new Uint8Array(bytes);
  }
  function create(SQL,datasets,provenance) {
    const db=new SQL.Database();
    try {
      db.run(`PRAGMA application_id=1196444487; PRAGMA user_version=10300;
        CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL,srs_id INTEGER NOT NULL PRIMARY KEY,organization TEXT NOT NULL,organization_coordsys_id INTEGER NOT NULL,definition TEXT NOT NULL,description TEXT);
        CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY,data_type TEXT NOT NULL,identifier TEXT UNIQUE,description TEXT DEFAULT '',last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),min_x DOUBLE,min_y DOUBLE,max_x DOUBLE,max_y DOUBLE,srs_id INTEGER,FOREIGN KEY(srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id));
        CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL,column_name TEXT NOT NULL,geometry_type_name TEXT NOT NULL,srs_id INTEGER NOT NULL,z TINYINT NOT NULL,m TINYINT NOT NULL,PRIMARY KEY(table_name,column_name),UNIQUE(table_name),FOREIGN KEY(table_name) REFERENCES gpkg_contents(table_name),FOREIGN KEY(srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id));`);
      const srs=db.prepare('INSERT INTO gpkg_spatial_ref_sys VALUES (?,?,?,?,?,?)');
      srs.run(['Undefined Cartesian SRS',-1,'NONE',-1,'undefined','Undefined Cartesian coordinate reference system']);
      srs.run(['Undefined geographic SRS',0,'NONE',0,'undefined','Undefined geographic coordinate reference system']);
      srs.run(['WGS 84 geodetic',4326,'EPSG',4326,'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]','Longitude, latitude in degrees']);srs.free();
      db.run('BEGIN');
      for(const {name,features,description} of datasets) {
        if(!features.length)continue;
        const props=[...new Set(features.flatMap(f=>Object.keys(f.properties||{})))];
        let pk='gpkg_fid';while(props.includes(pk))pk='_'+pk;
        let geom='geom';while(props.includes(geom)||geom===pk)geom='_'+geom;
        const types=props.map(p=>features.every(f=>f.properties[p]==null||typeof f.properties[p]==='number')?'REAL':'TEXT');
        db.run(`CREATE TABLE ${quote(name)} (${quote(pk)} INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,${quote(geom)} GEOMETRY${props.map((p,i)=>','+quote(p)+' '+types[i]).join('')})`);
        const box=root.Spatial.bounds(features.map(f=>f.geometry.coordinates));
        db.run('INSERT INTO gpkg_contents(table_name,data_type,identifier,description,min_x,min_y,max_x,max_y,srs_id) VALUES (?,?,?,?,?,?,?,?,?)',[name,'features',name,description||'',...box,4326]);
        const geometryTypes=new Set(features.map(f=>f.geometry.type.toUpperCase()));
        db.run('INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,?,?)',[name,geom,geometryTypes.size===1?[...geometryTypes][0]:'GEOMETRY',4326,0,0]);
        const stmt=db.prepare(`INSERT INTO ${quote(name)} (${[geom,...props].map(quote).join(',')}) VALUES (${[geom,...props].map(()=>'?').join(',')})`);
        for(const f of features)stmt.run([binaryGeometry(f.geometry),...props.map(p=>{const v=f.properties[p];return v==null?null:typeof v==='object'?JSON.stringify(v):typeof v==='boolean'?String(v):v;})]);
        stmt.free();
      }
      db.run('CREATE TABLE provenance (id INTEGER PRIMARY KEY,cle TEXT,valeur TEXT)');
      db.run("INSERT INTO gpkg_contents(table_name,data_type,identifier,description) VALUES ('provenance','attributes','provenance','Sources et traitements de cet export')");
      for(const [k,v] of Object.entries(provenance))db.run('INSERT INTO provenance(cle,valeur) VALUES (?,?)',[k,String(v)]);
      db.run('COMMIT');return db.export();
    } finally {db.close();}
  }
  root.GeoPackage={create,binaryGeometry};
  if(typeof module!=='undefined')module.exports=root.GeoPackage;
})(typeof window!=='undefined'?window:globalThis);
