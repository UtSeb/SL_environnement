"""Prepare OCS 2010–2021 surface intersections, preserving geometry precision.
Usage: PYTHONPATH=... python scripts/prepare_land.py supplied.geojson
Requires Shapely 2 and pyproj. Only polygon components contribute to area.
"""
import sys,json,pathlib,hashlib,math,collections
from shapely.geometry import shape,mapping
from shapely import STRtree,union_all,prepare
from shapely.ops import transform
from pyproj import Transformer
root=pathlib.Path(__file__).resolve().parents[1];source=pathlib.Path(sys.argv[1]);dest=root/'data/foncier';dest.mkdir(exist_ok=True)
raw=source.read_bytes();fc=json.loads(raw);defs=json.loads((root/'data/protections/manifest.json').read_text())
project=Transformer.from_crs(4326,2154,always_xy=True).transform
sl=union_all([shape(f['geometry']) for f in json.loads((root/'data/Limites SL.geojson').read_text())['features']]);prepare(sl)
def polygons(g):
 if g.geom_type in ('Polygon','MultiPolygon'):return g
 if g.geom_type=='GeometryCollection':return union_all([polygons(x) for x in g.geoms if x.geom_type in ('Polygon','MultiPolygon','GeometryCollection')])
 return None
zones=[];geoms=[]
for d in defs:
 fs=json.loads((root/'data/protections/sl'/(d['id']+'.geojson')).read_text())['features']
 for f in fs:
  g=polygons(shape(f['geometry']))
  if g is None or g.is_empty:continue
  p=f['properties'];name=next((str(p[k]) for k in ['NOM_SITE','SITENAME','NOM','nom_site','nom','CODE_ENS','ID_MNHN'] if p.get(k)),d['label'])
  zones.append({'layer':d['id'],'name':name});geoms.append(g)
for g in geoms:prepare(g)
tree=STRtree(geoms);tiles=collections.defaultdict(list);n=0;total=0;impacted=0;hits=0
allowed_before=set('133 134 211 212 221 222 231 232 311 312 313 314 315 321 322 323 331 332 334 411 412 511 512 513'.split());allowed_after=set('111 112 113 114 121 122 131 132 141 142 143 151 161 171'.split())
for i,f in enumerate(fc['features']):
 p=f['properties'];assert str(p['cod_10_n3']) in allowed_before and str(p['cod_21_n3']) in allowed_after
 g=shape(f['geometry']);assert g.is_valid
 if not sl.covers(g):g=polygons(g.intersection(sl))
 if g is None or g.is_empty or not g.area:continue
 ha=transform(project,g).area/10000
 props={'ocs_id':i+1,'source_id':p.get('id'),'source_couche':p.get('layer'),'cod_10_n3':p['cod_10_n3'],'lib_10_n3':p['lib_10_n3'],'cod_21_n3':p['cod_21_n3'],'lib_21_n3':p['lib_21_n3'],'surface_source_ha':p.get('surf_ha'),'surface_sl_ha':ha}
 pieces=[]
 for j in tree.query(g,predicate='intersects'):
  zone=geoms[j]
  if zone.covers(g):pieces.append([int(j),None]);continue
  part=polygons(g.intersection(zone))
  if part is not None and not part.is_empty and part.area>0:pieces.append([int(j),mapping(part)])
 record={'type':'Feature','properties':props,'geometry':mapping(g),'intersections':pieces}
 centroid=g.centroid;tile=(math.floor(centroid.x*2),math.floor(centroid.y*2));tiles[tile].append(record)
 n+=1;total+=ha;impacted+=bool(pieces);hits+=len(pieces)
 if i%3000==0:print(i,'/',len(fc['features']),'prepared',flush=True)
files=[];index=0
for tile,records in sorted(tiles.items()):
 batches=[];batch=[];size=0
 for r in records:
  encoded=json.dumps(r,ensure_ascii=False,separators=(',',':'));length=len(encoded.encode())
  if batch and size+length>2700000:batches.append(batch);batch=[];size=0
  batch.append(r);size+=length
 if batch:batches.append(batch)
 for batch in batches:
  index+=1;name=f'part-{index:03}.geojson';out=dest/name
  out.write_text(json.dumps({'type':'FeatureCollection','features':batch},ensure_ascii=False,separators=(',',':')))
  gs=[shape(r['geometry']) for r in batch];bbox=[min(g.bounds[0] for g in gs),min(g.bounds[1] for g in gs),max(g.bounds[2] for g in gs),max(g.bounds[3] for g in gs)]
  files.append({'file':name,'bbox':bbox,'count':len(batch),'bytes':out.stat().st_size})
manifest={'source':'OCS Grand Est','millesime':2021,'periode':[2010,2021],'source_file':source.name,'source_sha256':hashlib.sha256(raw).hexdigest(),'source_count':len(fc['features']),'count':n,'surface_sl_ha':total,'area_crs':'EPSG:2154','parts':files,'zones':zones,'layers':[{'id':d['id'],'label':d['label'],'group':d['group'],'source':d['source']} for d in defs if any(z['layer']==d['id'] for z in zones)],'method':'Règle de consommation fournie ; intersection au Sud-Lorraine et aux zonages fournis ; composantes surfaciques ; aucune simplification. Attributs utiles conservés ; chemins locaux et attributs 2019 exclus. Millésime des zonages non établi.'}
(dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Done:',n,'polygons;',total,'ha;',hits,'intersections;',index,'parts;',sum(x['bytes'] for x in files)/1e6,'MB',flush=True)
