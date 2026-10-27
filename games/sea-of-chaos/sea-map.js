// The plunder sea. Coordinates are meters on the water plane (x, z); y is up.
// A heading `a` points along (sin a, cos a); starboard is (-cos a, sin a).
export const SEA = 150;        // radius of the playable circle
export const EDGE = 140;       // ships are pushed back inside this radius
export const BANK_RADIUS = 20; // sail inside your harbor ring to bank gold
export const GUARD_RADIUS = 36;// enemy harbor tower fires at raiders inside this

export const TEAMS = [
 { id: 0, name: 'Crimson', color: '#ff5d4f', dark: '#9a2a22', x: -110, z: 0, face: Math.PI / 2 },
 { id: 1, name: 'Azure', color: '#4cb8ff', dark: '#1f5f99', x: 110, z: 0, face: -Math.PI / 2 },
];

// Land masses. `harbor` islands sit behind each team's bank ring; the wreck is the
// treasure-rich landmark in the middle of the sea.
export const ISLANDS = [
 { x: -150, z: 0, r: 26, kind: 'harbor', team: 0 },
 { x: 150, z: 0, r: 26, kind: 'harbor', team: 1 },
 { x: 0, z: -66, r: 14, kind: 'palm' },
 { x: 0, z: 66, r: 14, kind: 'palm' },
 { x: -60, z: -42, r: 9, kind: 'rock' },
 { x: 60, z: 42, r: 9, kind: 'rock' },
 { x: -56, z: 56, r: 8, kind: 'palm' },
 { x: 56, z: -56, r: 8, kind: 'palm' },
 { x: 0, z: 0, r: 5, kind: 'wreck' },
];

export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const forward = a => ({ x: Math.sin(a), z: Math.cos(a) });
export const starboard = a => ({ x: -Math.cos(a), z: Math.sin(a) });

// Beaches run a little past an island's radius before they dip under the sea.
export const shoreRadius = i => i.kind === 'wreck' ? i.r : i.r * 1.1;

export function onLand(x, z, pad = 0) {
 for (const i of ISLANDS) if (Math.hypot(x - i.x, z - i.z) < i.r + pad) return i;
 return null;
}

// Pushes a ship out of land and back inside the sea. Returns true on impact.
export function collideSea(s) {
 let hit = false;
 for (const i of ISLANDS) {
  const dx = s.x - i.x, dz = s.z - i.z, d = Math.hypot(dx, dz), r = shoreRadius(i) + 3.2;
  if (d < r) { s.x = i.x + (d ? dx / d : 1) * r; s.z = i.z + (d ? dz / d : 0) * r; hit = true; }
 }
 const d = Math.hypot(s.x, s.z);
 if (d > EDGE) { s.x *= EDGE / d; s.z *= EDGE / d; hit = true; }
 if (hit) s.v *= 0.55;
 return hit;
}
