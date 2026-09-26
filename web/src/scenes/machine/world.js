// World layout of the machine segment (units: wu). The data-hall floor IS the die:
// die pixel (x, y)  <->  floor point X = x - 960, Z = 1080 - y   (Y = 0 is the floor).
// Racks stand on the die cells (100 x 100 footprints on a 120 grid). During the corridor the
// columns left of the aisle (i <= 7) are pushed left and the others right by s/2 each.
export const DIEW = { pitch: 120, inset: 10 };
export const WORLD = {
  k: 120 / 2800,     // wu per wall design unit (the factory wall is painted in "wall units")
  ZE: 1440,          // the end wall (factory -> server wall) plane
  H: 250,            // rack height
  spread: 280,       // aisle opening during the corridor (s)
  cols: [-7, 22],    // rack columns (die columns are 0..15)
  rows: [-2, 11],    // rack rows (die rows are 0..8; row -1, -2 lie beyond the die's top edge)
};
// Wall units -> world. The pivot gear centre (960, 540) sits at X = 0, Y = YG on the end wall.
export const WALL = {
  archW: 2160,       // arch opening width (wall units) - contains the whole pivot frame
  pitch: 2800,       // arch pitch = rack pitch (120 wu)
  spring: 380,       // spring line of the arch (y, wall units)
  floorY: 5020,      // floor level (y, wall units)
};
WORLD.YG = (WALL.floorY - 540) * WORLD.k;

// wall units -> world point on the end wall
export function wallToWorld(wx, wy) {
  return [(wx - 960) * WORLD.k, WORLD.YG - (wy - 540) * WORLD.k, WORLD.ZE];
}

// column shift for the aisle opening
export const colShift = (i, s) => (i <= 7 ? -s / 2 : s / 2);

// rack footprint (world) for grid cell (i, j) with spread s
export function rackBox(i, j, s) {
  const x0 = 120 * i - 950 + colShift(i, s), z0 = 1080 - 120 * j - 110;
  return { x0, x1: x0 + 100, z0, z1: z0 + 100 };
}
