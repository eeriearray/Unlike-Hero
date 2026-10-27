(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./data.js') : root.CrownData);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CrownTrack = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';
  const cache = new Map();
  function curve(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
  }
  function makeTrack(index = 0) {
    index = D.mod(index, D.TRACKS.length);
    if (cache.has(index)) return cache.get(index);
    const theme = D.TRACKS[index], control = theme.layout, count = 900, points = [], lengths = [0];
    for (let i = 0; i <= count; i++) {
      const u = i / count, q = u * control.length, k = Math.floor(q), t = q - k;
      const p = n => control[D.mod(n, control.length)];
      const twist = 1 + 0.06 * Math.sin(u * Math.PI * 4 + theme.phase);
      const x = curve(p(k-1)[0], p(k)[0], p(k+1)[0], p(k+2)[0], t) * theme.scale * twist;
      const z = curve(p(k-1)[1], p(k)[1], p(k+1)[1], p(k+2)[1], t) * theme.scale;
      let y = curve(p(k-1)[2]??6,p(k)[2]??6,p(k+1)[2]??6,p(k+2)[2]??6,t);
      for (const ramp of theme.ramps || [0.18, 0.49, 0.78]) if (u > ramp - 0.032 && u < ramp) y += (u - (ramp - 0.032)) / 0.032 * 4.3;
      points.push({ x, y, z });
      if (i) lengths.push(lengths[i-1] + Math.hypot(x - points[i-1].x, z - points[i-1].z));
    }
    // Close the spline exactly; the endpoint height must equal the starting road height.
    points[count] = { ...points[0] };
    const bounds = {minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const p of points){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minZ=Math.min(bounds.minZ,p.z);bounds.maxZ=Math.max(bounds.maxZ,p.z);}
    // On hairpins tighter than half the road width, a full-width lateral offset folds the road back over
    // itself. Limit how far each sample may reach toward the inside of the bend (sign of curvature).
    const segmentHeading = i => { const a = points[D.mod(i, count)], b = points[D.mod(i, count) + 1]; return Math.atan2(b.x - a.x, b.z - a.z); };
    // Lateral offsets turn smoothly through each vertex instead of jumping at segment joints.
    const normals = points.map((_, i) => { const a = segmentHeading(i - 1); return a + D.angle(segmentHeading(i) - a) / 2; });
    // Inner reach before consecutive edge vertices stop moving forward: lane * sin(turn) must stay below the segment length.
    const inner = [];
    for (let i = 0; i < count; i++) {
      const turn = D.angle(normals[i + 1] - normals[i]), span = lengths[i + 1] - lengths[i];
      inner.push(Math.abs(turn) > 1e-4 ? Math.sign(turn) * Math.max(2.5, 0.8 * span / Math.abs(Math.sin(turn))) : 0);
    }
    const laneLimit = inner.map((_, i) => {
      let pos = Infinity, neg = Infinity;
      for (let n = -12; n <= 12; n++) { const v = inner[D.mod(i + n, count)]; if (v > 0) pos = Math.min(pos, v); else if (v < 0) neg = Math.min(neg, -v); }
      return [pos, neg];
    });
    const track = { ...theme, index, count, points, lengths, bounds, normals, laneLimit, length: lengths[count], gates: 12 };
    cache.set(index, track); return track;
  }
  function sample(track, distance, lane = 0) {
    const s = D.mod(distance, track.length), ls = track.lengths;
    let low = 0, high = track.count;
    while (low + 1 < high) { const mid = (low + high) >> 1; if (ls[mid] <= s) low = mid; else high = mid; }
    const a = track.points[low], b = track.points[low+1], t = (s - ls[low]) / (ls[low+1] - ls[low]);
    const heading = Math.atan2(b.x - a.x, b.z - a.z), n0 = track.normals[low], normal = n0 + D.angle(track.normals[low+1] - n0)*t;
    lane = clampLane(track, low, lane);
    return { x: a.x + (b.x-a.x)*t + Math.cos(normal)*lane, y: a.y + (b.y-a.y)*t,
      z: a.z + (b.z-a.z)*t - Math.sin(normal)*lane, heading, segment: low, s };
  }
  function clampLane(track, segment, lane) {
    const limit = track.laneLimit?.[segment]; if (!limit) return lane;
    return lane > 0 ? Math.min(lane, limit[0]) : Math.max(lane, -limit[1]);
  }
  // Drivable half-width on the side of `lane` at a segment; narrower only on the inside of tight bends.
  function edgeAt(track, segment, lane) { return Math.abs(clampLane(track, segment, (lane >= 0 ? 1 : -1) * track.width / 2)); }
  function project(track, x, z, hint = null) {
    let best = null;
    const start = hint == null ? 0 : hint - 22, end = hint == null ? track.count : hint + 23;
    for (let n = start; n < end; n++) {
      const i = D.mod(n, track.count), a = track.points[i], b = track.points[i+1];
      const dx = b.x-a.x, dz = b.z-a.z, t = D.clamp(((x-a.x)*dx + (z-a.z)*dz)/(dx*dx+dz*dz), 0, 1);
      const px = a.x + dx*t, pz = a.z + dz*t, d2 = (x-px)**2 + (z-pz)**2;
      if (best && d2 >= best.d2) continue;
      const heading = Math.atan2(dx, dz);
      best = { x: px, y: a.y + (b.y-a.y)*t, z: pz, s: track.lengths[i] + (track.lengths[i+1]-track.lengths[i])*t,
        heading, lane: (x-px)*Math.cos(heading) - (z-pz)*Math.sin(heading), d2, segment: i };
    }
    return best;
  }
  function surfaceAt(track, s, lane) {
    const u = D.mod(s, track.length) / track.length;
    return mudPatches(track).some(p=>u>p.start&&u<p.end&&Math.abs(lane-p.lane)<p.width/2) ? 'mud' : 'stone';
  }
  const defaultMud = [{start:.27,end:.32,lane:-3,width:10},{start:.61,end:.65,lane:3,width:10}];
  function mudPatches(track) { return track.mud || defaultMud; }
  function inGap(track,s) { const u=D.mod(s,track.length)/track.length;return (track.gaps||[]).some(g=>u>g.start&&u<g.end); }
  function sectionAt(track,s) { const u=D.mod(s,track.length)/track.length;return (track.zones||[track.name])[Math.min(2,Math.floor(u*3))]||track.name; }
  function padPoses(track) { return (track.pads||[]).map((p,id)=>({...sample(track,p.u*track.length,p.lane),id,width:p.width})); }
  function hazardPose(track, time, index) {
    return sample(track, track.length * (index === 0 ? 0.37 : 0.87), Math.sin(time * 1.1 + index * 2) * (track.width / 2 - 1));
  }
  function boxPoses(track, battle = false) {
    if (battle) return Array.from({ length: 8 }, (_, i) => ({ x: Math.sin(i*Math.PI/4)*24, z: Math.cos(i*Math.PI/4)*24, y: 6 }));
    const out = [];
    for (const u of [.08, .24, .45, .59, .82, .95]) for (const lane of [-4, 0, 4]) out.push(sample(track, u*track.length, lane));
    return out;
  }
  return { makeTrack, sample, project, clampLane, edgeAt, surfaceAt, mudPatches, inGap, sectionAt, padPoses, hazardPose, boxPoses };
});
