/* CSS icosahedron: twenty actual triangular faces. The engine's result is passed
 * through unchanged; only its presentation is replaced. No physics or RNG here. */
(function (g) {
  'use strict';
  var A = g.HollowArt, original = A.die, phi = (1 + Math.sqrt(5)) / 2;
  var vertices = [[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]];
  var faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  function sub(a,b) { return a.map(function (v,i) { return v-b[i]; }); }
  function dot(a,b) { return a.reduce(function (sum,v,i) { return sum+v*b[i]; },0); }
  function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
  function unit(v) { var n=Math.hypot.apply(null,v); return v.map(function (x) { return x/n; }); }
  var first=faces[0].map(function (i) { return vertices[i]; });
  var normal=unit(cross(sub(first[1],first[0]),sub(first[2],first[0]))), target=[0,0,1];
  var axis=unit(cross(normal,target)), cos=dot(normal,target), sin=Math.sqrt(1-cos*cos);
  function orient(v) {
    var ax=cross(axis,v), dp=dot(axis,v);
    return v.map(function (x,i) { return (x*cos+ax[i]*sin+axis[i]*dp*(1-cos))*24; });
  }
  var rotated=vertices.map(orient), apex=rotated[faces[0][0]], theta=-Math.PI/2-Math.atan2(apex[1],apex[0]);
  rotated=rotated.map(function (v) { return [v[0]*Math.cos(theta)-v[1]*Math.sin(theta),v[0]*Math.sin(theta)+v[1]*Math.cos(theta),v[2]]; });
  var matrices=faces.map(function (face) {
    var p=[face[0],face[2],face[1]].map(function (i) { return rotated[i]; });
    var u=sub(p[2],p[1]).map(function (x) { return x/100; });
    var v=p[0].map(function (x,i) { return ((p[1][i]+p[2][i])/2-x)/86.60254; });
    var n=unit(cross(u,v)), t=p[0].map(function (x,i) { return x-50*u[i]; });
    return [u[0],u[1],u[2],0,v[0],v[1],v[2],0,n[0],n[1],n[2],0,t[0],t[1],t[2],1].map(function (x) { return x.toFixed(6); }).join(',');
  });
  A.die = function (n, tier) {
    var tone=['crit','fumble','fail','ok'].includes(tier)?tier:'ok';
    var remaining = Array.from({ length: 20 }, function (_, i) { return i + 1; }).filter(function (v) { return v !== Number(n); });
    var poly=matrices.map(function (matrix,i) {
      var number=i===0?A.esc(n):String(remaining[((i-1)*7)%remaining.length]);
      return '<span class="d20-face face-' + i + '" style="transform:matrix3d(' + matrix + ');--facet:' + (.2+(i%5)*.12) + '">' +
        '<svg viewBox="0 0 100 87" aria-hidden="true"><path d="M50 1L1 86h98Z"/><text x="50" y="64" text-anchor="middle">' + number + '</text></svg></span>';
    }).join('');
    return '<span class="physical-d20 tone-' + tone + '" aria-hidden="true"><span class="d20-solid">' + poly + '</span><span class="d20-legacy">' + original(n,tier) + '</span></span>';
  };
})(window);
