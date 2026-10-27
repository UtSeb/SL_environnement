/* Geographic clipping of 2D GeoJSON lines by polygon/multipolygon masks. */
(function(root) {
  'use strict';
  const EPS = 1e-10, CELL = .1;
  const same = (a,b) => Math.abs(a[0]-b[0]) < EPS && Math.abs(a[1]-b[1]) < EPS;
  function bounds(coords, out=[Infinity,Infinity,-Infinity,-Infinity]) {
    if (typeof coords[0] === 'number') {out[0]=Math.min(out[0],coords[0]);out[1]=Math.min(out[1],coords[1]);out[2]=Math.max(out[2],coords[0]);out[3]=Math.max(out[3],coords[1]);}
    else coords.forEach(c=>bounds(c,out));
    return out;
  }
  const overlap = (a,b) => a[0]<=b[2]+EPS && a[2]+EPS>=b[0] && a[1]<=b[3]+EPS && a[3]+EPS>=b[1];
  function onSegment(p,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1];
    if (same(a,b)) return same(p,a);
    return Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0])) <= EPS*Math.max(1,Math.hypot(dx,dy)) && overlap(bounds([a,b]),[p[0],p[1],p[0],p[1]]);
  }
  // 0 outside, 1 inside, 2 boundary; boundaries are included in the mask.
  function prepareRing(ring) {
    const rows=new Map(), box=bounds(ring);
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const edge={a:ring[j],b:ring[i]};
      for(let y=Math.floor(Math.min(edge.a[1],edge.b[1])/CELL);y<=Math.floor(Math.max(edge.a[1],edge.b[1])/CELL);y++) {
        if(!rows.has(y))rows.set(y,[]);rows.get(y).push(edge);
      }
    }
    return {rows,box};
  }
  function inRing(p,ring) {
    if(!overlap(ring.box,[p[0],p[1],p[0],p[1]]))return 0;
    let inside=false;
    const candidates=new Set();
    for(const y of [Math.floor((p[1]-EPS)/CELL),Math.floor(p[1]/CELL),Math.floor((p[1]+EPS)/CELL)])
      (ring.rows.get(y)||[]).forEach(e=>candidates.add(e));
    for(const {a,b} of candidates) {
      if(onSegment(p,a,b)) return 2;
      if ((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside?1:0;
  }
  function prepareMask(fc) {
    const polygons=[],edges=[],grid=new Map();
    for(const f of fc.features) {
      if(!f.geometry) continue;
      const g=f.geometry;
      if(!['Polygon','MultiPolygon'].includes(g.type)) throw Error('Un périmètre polygonal est nécessaire.');
      for(const rings of (g.type==='Polygon'?[g.coordinates]:g.coordinates)) {
        polygons.push({rings:rings.map(prepareRing),box:bounds(rings)});
        for(const ring of rings) for(let i=0;i<ring.length-1;i++) {
          const e={a:ring[i],b:ring[i+1],box:bounds([ring[i],ring[i+1]])};
          const index=edges.push(e)-1;
          for(let x=Math.floor(e.box[0]/CELL);x<=Math.floor(e.box[2]/CELL);x++)
            for(let y=Math.floor(e.box[1]/CELL);y<=Math.floor(e.box[3]/CELL);y++) {
              const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(index);
            }
        }
      }
    }
    return {polygons,edges,grid,box:bounds(fc.features.filter(f=>f.geometry).map(f=>f.geometry.coordinates))};
  }
  function contains(mask,p) {
    return mask.polygons.some(({rings,box})=> {
      if(!overlap(box,[p[0],p[1],p[0],p[1]])) return false;
      const exterior=inRing(p,rings[0]);if(!exterior)return false;if(exterior===2)return true;
      for(const ring of rings.slice(1)){const status=inRing(p,ring);if(status===2)return true;if(status===1)return false;}
      return true;
    });
  }
  function clipLine(coords,mask) {
    const parts=[];let current=[];
    const flush=()=>{if(current.length>1)parts.push(current);current=[];};
    for(let i=0;i<coords.length-1;i++) {
      const a=coords[i],b=coords[i+1],box=bounds([a,b]);
      if(same(a,b))continue;
      if(!overlap(box,mask.box)){flush();continue;}
      const ids=new Set();
      for(let x=Math.floor(box[0]/CELL);x<=Math.floor(box[2]/CELL);x++)
        for(let y=Math.floor(box[1]/CELL);y<=Math.floor(box[3]/CELL);y++)
          (mask.grid.get(x+','+y)||[]).forEach(id=>ids.add(id));
      const dx=b[0]-a[0],dy=b[1]-a[1],cuts=[0,1];
      for(const id of ids) {
        const e=mask.edges[id];if(!overlap(box,e.box))continue;
        const ex=e.b[0]-e.a[0],ey=e.b[1]-e.a[1],qx=e.a[0]-a[0],qy=e.a[1]-a[1],den=dx*ey-dy*ex;
        if(Math.abs(den)>1e-16) {
          const t=(qx*ey-qy*ex)/den,u=(qx*dy-qy*dx)/den;
          if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)cuts.push(Math.max(0,Math.min(1,t)));
        } else if(Math.abs(qx*dy-qy*dx)<1e-14) {
          for(const p of [e.a,e.b]){const t=Math.abs(dx)>=Math.abs(dy)?(p[0]-a[0])/dx:(p[1]-a[1])/dy;if(t>0&&t<1)cuts.push(t);}
        }
      }
      cuts.sort((x,y)=>x-y);const ts=cuts.filter((t,j)=>j===0||t-cuts[j-1]>EPS);
      const at=t=>[a[0]+t*dx,a[1]+t*dy];
      for(let j=0;j<ts.length-1;j++) {
        if(contains(mask,at((ts[j]+ts[j+1])/2))) {
          const start=at(ts[j]),end=at(ts[j+1]);
          if(current.length&&!same(current[current.length-1],start))flush();
          if(!current.length)current.push(start);current.push(end);
        } else flush();
      }
    }
    flush();return parts;
  }
  function lengthKm(geometry) {
    const lines=geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;
    let total=0;const rad=Math.PI/180;
    for(const line of lines)for(let i=1;i<line.length;i++) {
      const a=line[i-1],b=line[i],dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad;
      const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;
      total+=6371.0088*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
    }
    return total;
  }
  function clipFeature(feature,mask) {
    const g=feature.geometry;if(!g)return null;
    if(!['LineString','MultiLineString'].includes(g.type))throw Error('Seules les lignes sont prises en charge dans cette première analyse.');
    if(!overlap(bounds(g.coordinates),mask.box))return null;
    const lines=g.type==='LineString'?[g.coordinates]:g.coordinates;
    const coordinates=lines.flatMap(line=>clipLine(line,mask));if(!coordinates.length)return null;
    const geometry={type:'MultiLineString',coordinates};
    return {type:'Feature',properties:{...feature.properties,longueur_km:Math.round(lengthKm(geometry)*1000)/1000},geometry};
  }
  root.Spatial={bounds,prepareMask,contains,clipFeature,lengthKm};
  if(typeof module!=='undefined')module.exports=root.Spatial;
})(typeof window!=='undefined'?window:globalThis);
