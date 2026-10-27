"""Independent read of the actual SQLite/WKB file, optionally through GDAL/Fiona."""
import sqlite3, struct
p='/tmp/sl-demo-test.gpkg'
con=sqlite3.connect(p)
assert con.execute('pragma application_id').fetchone()[0] == 0x47504b47
assert con.execute('pragma user_version').fetchone()[0] == 10300
assert con.execute('pragma integrity_check').fetchone()[0] == 'ok'
assert not con.execute('pragma foreign_key_check').fetchall()
for table,geom,kind,srs,z,m in con.execute('select * from gpkg_geometry_columns'):
    assert srs == 4326 and z == 0 and m == 0
    count=0
    for blob, in con.execute(f'SELECT "{geom}" FROM "{table}"'):
        assert blob[:4] == b'GP\x00\x01'
        assert struct.unpack('<i',blob[4:8])[0] == 4326
        assert blob[8] == 1
        assert struct.unpack('<I',blob[9:13])[0] in (1,2,3,4,5,6)
        try:
            from shapely import wkb
            g=wkb.loads(blob[8:]);assert not g.is_empty;assert g.is_valid
        except ImportError:
            pass
        count+=1
    print(table,kind,count,'geometries read')
try:
    import fiona
    for name in ['cours_eau_decoupes','perimetre_analyse']:
        with fiona.open(p,layer=name) as src:
            assert src.crs.to_epsg()==4326
            assert len(src)>0
            print('GDAL/Fiona:',name,len(src),src.schema)
except ImportError:
    print('Fiona unavailable: SQLite and binary headers verified; GDAL not checked.')
print('Independent GeoPackage checks passed.')
