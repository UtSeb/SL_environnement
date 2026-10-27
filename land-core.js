/* Surface analysis in Lambert-93 (GRS80), with unions to avoid zone double counts. */
(function(root){
 'use strict';
 const P=typeof module!=='undefined'?require('./vendor/polygon-clipping.min.js'):root.polygonClipping;
 const S=typeof module!=='undefined'?require('./spatial.js'):root.Spatial;
 const rad=Math.PI/180,a=6378137,f=1/298.257222101,e=Math.sqrt(2*f-f*f);
 const iso=p=>Math.log(Math.tan(Math.PI/4+p/2)*Math.pow((1-e*Math.sin(p))/(1+e*Math.sin(p)),e/2));
 const m=p=>Math.cos(p)/Math.sqrt(1-e*e*Math.sin(p)**2);
 const p1=49*rad,p2=44*rad,n=Math.log(m(p1)/m(p2))/(iso(p2)-iso(p1)),c=a*m(p1)/n*Math.exp(n*iso(p1)),ys=6600000+c*Math.exp(-n*iso(46.5*rad));
 function project(p){const r=c*Math.exp(-n*iso(p[1]*rad)),theta=n*(p[0]-3)*rad;return [700000+r*Math.sin(theta),ys-r*Math.cos(theta)];}
 const polys=g=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
 function ringArea(ring){const origin=project(ring[0]);let prev=origin,total=0;for(let i=1;i<ring.length;i++){const p=project(ring[i]);total+=(prev[0]-origin[0])*(p[1]-origin[1])-(p[0]-origin[0])*(prev[1]-origin[1]);prev=p;}return Math.abs(total)/2;}
 function areaHa(g){return polys(g).reduce((sum,rings)=>sum+ringArea(rings[0])-rings.slice(1).reduce((s,r)=>s+ringArea(r),0),0)/10000;}
 const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
 function union(geometries){if(!geometries.length)return null;if(geometries.length===1)return geometries[0];return {type:'MultiPolygon',coordinates:P.union(...geometries.map(g=>g.coordinates))};}
 function compute(records,perimeter,ids,zones,whole=false,progress=()=>{}){
  const selected=new Set(ids),mask=perimeter.features.flatMap(f=>polys(f.geometry)),box=S.bounds(mask);
  const clip=g=>{if(!overlap(S.bounds(g.coordinates),box))return null;if(whole)return g;const coordinates=P.intersection(g.coordinates,mask);return coordinates.length?{type:'MultiPolygon',coordinates}:null;};
  const consumption=[],crossed=[],layerAreas={},byDestination={};let totalHa=0,crossedHa=0;
  for(let i=0;i<records.length;i++){
   const source=records[i],geometry=clip(source.geometry);if(!geometry)continue;
   const surface=areaHa(geometry);if(surface<=0)continue;
   const base={type:'Feature',geometry,properties:{...source.properties,surface_territoire_ha:surface}};consumption.push(base);totalHa+=surface;
   const pieces=[],names=new Set(),layers=new Map();let full=false;
   for(const [index,fragment] of source.intersections||[]){
    const z=zones[index];if(!selected.has(z.layer))continue;
    const piece=fragment===null?geometry:clip(fragment);if(!piece||areaHa(piece)<=0)continue;
    pieces.push(piece);if(fragment===null)full=true;names.add(z.name);
    if(!layers.has(z.layer))layers.set(z.layer,[]);layers.get(z.layer).push(piece);
   }
   if(pieces.length){
    const common=full?geometry:union(pieces),ha=areaHa(common);crossedHa+=ha;
    for(const [id,gs] of layers)layerAreas[id]=(layerAreas[id]||0)+areaHa(union(gs));
    const dest=source.properties.lib_21_n3||String(source.properties.cod_21_n3);byDestination[dest]=(byDestination[dest]||0)+ha;
    crossed.push({type:'Feature',geometry:common,properties:{...base.properties,surface_croisee_ha:ha,couches:[...layers.keys()].join(' ; '),espaces:[...names].join(' ; ')}});
   }
   if(i%1000===0)progress(i,records.length);
  }
  if(crossedHa>totalHa+1e-6)throw Error('Surface croisée supérieure à la consommation totale.');
  return {consumption:{type:'FeatureCollection',features:consumption},crossed:{type:'FeatureCollection',features:crossed},stats:{totalHa,crossedHa,percent:totalHa?100*crossedHa/totalHa:null,count:crossed.length,sourceCount:consumption.length,layerAreas,byDestination}};
 }
 root.LandCore={project,areaHa,compute,overlap,union};if(typeof module!=='undefined')module.exports=root.LandCore;
})(typeof self!=='undefined'?self:globalThis);
