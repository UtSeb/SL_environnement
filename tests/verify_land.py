"""Independent GEOS / PROJ verification against the original supplied OCS file.
Run after land.test.cjs: python tests/verify_land.py ORIGINAL.geojson
"""
import json,sys,pathlib,sqlite3,hashlib
from shapely.geometry import shape
from shapely import union_all,wkb,STRtree,prepare
from shapely.ops import transform
from pyproj import Transformer
root=pathlib.Path(__file__).resolve().parents[1];original=pathlib.Path(sys.argv[1]);raw=original.read_bytes();manifest=json.loads((root/'data/foncier/manifest.json').read_text())
assert hashlib.sha256(raw).hexdigest()==manifest['source_sha256']
proof=json.loads(pathlib.Path('/tmp/land-proof.json').read_text());project=Transformer.from_crs(4326,2154,always_xy=True).transform
expected=project(6.184,48.69);assert max(abs(a-b) for a,b in zip(expected,proof['projected']))<1e-6,(expected,proof['projected'])
source=[shape(f['geometry']) for f in json.loads(raw)['features']];tree=STRtree(source)
# Validate the absence of source overlaps, independently of the browser engine.
for i,g in enumerate(source):
 for j in tree.query(g,predicate='intersects'):
  if j>i:assert g.intersection(source[j]).area<1e-12,(i,int(j),'overlap')
zone_parts=[shape(f['geometry']) for id in ['zonage_12','zonage_16'] for f in json.loads((root/'data/protections/sl'/(id+'.geojson')).read_text())['features']]
for g in zone_parts:prepare(g)
zone_tree=STRtree(zone_parts)
for sample in proof['scenarios']:
 mask=union_all([shape(f['geometry']) for f in sample['perimeter']['features']]);prepare(mask);total=0;crossed=0;count=0
 for i in tree.query(mask,predicate='intersects'):
  g=source[i] if mask.covers(source[i]) else source[i].intersection(mask)
  if not g.area:continue
  total+=transform(project,g).area/10000
  fragments=[]
  for z in zone_tree.query(g,predicate='intersects'):
   if zone_parts[z].covers(g):fragments=[g];break
   fragments.append(g.intersection(zone_parts[z]))
  x=union_all(fragments)
  if x.area>0:crossed+=transform(project,x).area/10000;count+=1
 assert abs(total-sample['stats']['totalHa'])<.001,(sample['key'],'total',total,sample['stats']['totalHa'])
 assert abs(crossed-sample['stats']['crossedHa'])<.001,(sample['key'],'cross',crossed,sample['stats']['crossedHa'])
 db=sqlite3.connect('/tmp/land-'+sample['key']+'.gpkg')
 for name, in db.execute('SELECT table_name FROM gpkg_geometry_columns'):
  for blob, in db.execute(f'SELECT geom FROM "{name}"'):
   g=wkb.loads(blob[8:]);assert g.is_valid and not g.is_empty,(sample['key'],name,'invalid export')
 print(sample['key'],round(total,4),'ha consommés ;',round(crossed,4),'ha croisés : GEOS / PROJ et GeoPackage vérifiés',flush=True)
