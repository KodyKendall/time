// Two fixed-length bones in y-down coordinates. Bend selects the elbow/knee side.
export function solveTwoBone(root, target, upper, lower, bend = 1) {
  if (root.length !== 2 || target.length !== 2 || ![...root, ...target, upper, lower].every(Number.isFinite) || upper <= 0 || lower <= 0 || (bend !== 1 && bend !== -1))
    throw new TypeError('IK requires finite points and positive bone lengths');
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const distance = Math.hypot(dx, dy);
  const d = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(upper + lower - 1e-6, distance));
  const ux = distance > 1e-8 ? dx / distance : 1, uy = distance > 1e-8 ? dy / distance : 0;
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { joint: [root[0] + ux * along - uy * height * bend,
    root[1] + uy * along + ux * height * bend],
    end: [root[0] + ux * d, root[1] + uy * d], reachable: Math.abs(d - distance) < 1e-5 };
}
