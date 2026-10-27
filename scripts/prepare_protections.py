"""Build territory intersections: python scripts/prepare_protections.py INPUT_DIRECTORY.
Requires Shapely >= 2. Original files are preserved verbatim; no simplification.
"""
import json,sys,shutil,pathlib
from shapely.geometry import shape,mapping
from shapely import make_valid,union_all
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1]); dest=root/'data/protections';dest.mkdir(parents=True,exist_ok=True)
labels=[('ZHR','Zones humides remarquables','Inventaires','#318a9e'),('ENS_geologiques','ENS géologiques','Espaces naturels sensibles','#b47b45'),('Biotope','Aires de protection de biotope','Protections réglementaires','#b84366'),('SL__Zone','Natura 2000 — ZSC','Natura 2000','#8164aa'),('Espace_Naturel','Espaces naturels sensibles','Espaces naturels sensibles','#c18532'),('ENS_superpose','ENS superposés','Espaces naturels sensibles','#9b7434'),('ENS_riviere','ENS rivières','Espaces naturels sensibles','#21928d'),('SIC','Natura 2000 — SIC (fichier fourni)','Natura 2000','#b16f9c'),('PNR','Parcs naturels régionaux','Parcs et paysages','#648b34'),('RNR','Réserves naturelles régionales','Protections réglementaires','#c94f4a'),('Paysage','Paysages remarquables','Parcs et paysages','#b29328'),('SL_znieff1','ZNIEFF de type 1','Inventaires','#3a945f'),('Sites_classes','Sites classés','Protections réglementaires','#c45c31'),('Reserves_biologiques','Réserves biologiques','Protections réglementaires','#8a4f38'),('Sites_inscrits','Sites inscrits','Parcs et paysages','#b89155'),('SL_znieff2','ZNIEFF de type 2','Inventaires','#83a851'),('ZICO','Zones importantes pour les oiseaux (ZICO)','Inventaires','#5693b0'),('ZNIEFF_1_ZE','ZNIEFF de type 1 — variante ZE V2','Inventaires','#28794b'),('ZPS','Natura 2000 — ZPS','Natura 2000','#9361b7'),('Chiros','Natura 2000 — ZSC chiroptères (points)','Natura 2000','#663e9d'),('ZNIEFF_2_ZE','ZNIEFF de type 2 — variante ZE','Inventaires','#497a39')]
territories={'sl':'Limites SL.geojson','sud54':'Plaque Sud54.geojson','meuse':'Plaque SudMeuse.geojson','vosges':'Plaque Vosges Ouest.geojson','sddv':'Plaque SDDV.geojson'}
masks={k:union_all([make_valid(shape(f['geometry'])) for f in json.loads((root/'data'/v).read_text())['features']]) for k,v in territories.items()}
manifest=[]
for i,(pattern,label,group,color) in enumerate(labels):
 files=[p for p in source.glob('*.geojson') if pattern in p.name];assert len(files)==1,(pattern,files)
 p=files[0];id=f'zonage_{i+1:02}';(dest/'sources').mkdir(exist_ok=True);shutil.copy2(p,dest/'sources'/p.name)
 fc=json.loads(p.read_text()); counts={};repairs=0
 prepared=[]
 for f in fc['features']:
  if not f['geometry']:continue
  g=shape(f['geometry']);repairs+=not g.is_valid;g=make_valid(g)
  prepared.append((f,g))
 for key,mask in masks.items():
  features=[]
  for f,g in prepared:
   clipped=g.intersection(mask)
   if not clipped.is_empty:features.append({**f,'geometry':mapping(clipped)})
  (dest/key).mkdir(exist_ok=True);(dest/key/(id+'.geojson')).write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
  counts[key]=len(features)
 manifest.append(dict(id=id,label=label,group=group,color=color,source=p.name,counts=counts,repaired=repairs))
(dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Prepared',len(manifest),'layers;',sum(x['counts']['sl'] for x in manifest),'features in SL')
