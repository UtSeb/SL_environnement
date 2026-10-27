"""Independent GEOS comparison of browser intersections and GeoPackage geometries.
Run after administrative.test.cjs; requires Shapely 2.
"""
import json,sqlite3,pathlib
from shapely.geometry import shape
from shapely import wkb
root=pathlib.Path(__file__).resolve().parents[1]
outputs=json.loads(pathlib.Path('/tmp/admin-intersections.json').read_text())
for item in outputs:
 mask=shape(item['perimeter']['features'][0]['geometry'])
 for dataset in item['sets']:
  source=json.loads((root/'data/protections/sl'/(dataset['name']+'.geojson')).read_text())['features']
  expected=[shape(f['geometry']).intersection(mask) for f in source if shape(f['geometry']).intersects(mask)]
  # Surface boundary-only contacts are deliberately omitted by the browser engine.
  expected=[g for g in expected if not g.is_empty and (g.area>1e-15 or g.geom_type not in ('Polygon','MultiPolygon'))]
  actual=[shape(f['geometry']) for f in dataset['features']]
  # Check the aggregate measure independently, allowing sub-millimetre rounding.
  assert abs(sum(g.area for g in expected)-sum(g.area for g in actual))<1e-9,(item['name'],dataset['name'],'area')
  for g in actual:
   assert g.is_valid,(item['name'],dataset['name'],'invalid')
   outside=g.difference(mask.buffer(1e-8))
   assert outside.area<1e-12 and (g.area>0 or outside.is_empty),(item['name'],dataset['name'],'outside')
  if all(f['geometry']['type'] in ('LineString','MultiLineString') for f in source):
   assert abs(sum(g.length for g in expected)-sum(g.length for g in actual))<1e-8,(item['name'],dataset['name'],'length')
  if all(f['geometry']['type'] in ('Point','MultiPoint') for f in source):
   assert len(actual)==len(expected),(item['name'],dataset['name'],'points')
  for f in dataset['features']:
   assert any(f['properties']==sf['properties'] for sf in source),'attributes changed'
 db=sqlite3.connect('/tmp/admin-'+item['key']+'.gpkg')
 for table, in db.execute('SELECT table_name FROM gpkg_geometry_columns'):
  for blob, in db.execute(f'SELECT geom FROM "{table}"'):
   assert blob[:4]==b'GP\x00\x01'
   g=wkb.loads(blob[8:]);assert g.is_valid and not g.is_empty
 print(item['name'],': intersections GEOS et géométries GeoPackage vérifiées')
