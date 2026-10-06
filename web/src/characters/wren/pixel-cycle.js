import { createClip } from '../../animation/clip.js';
import { evaluatePullRig } from './articulated.js';
import { M } from '../../engine/math.js';

export const CYCLE_FRAMES = 24, CYCLE_FPS = 12;
export const cycleFrame = t => ((Math.floor((t + 1e-7) * CYCLE_FPS) % CYCLE_FRAMES) + CYCLE_FRAMES) % CYCLE_FRAMES;
export function createPixelCycle() {
  const base = { hipX: 0, crouch: 0, lean: 0, head: -0.025, gripX: 125, gripY: -345, scarf: 0, breath: 0 };
  return createClip(base, [
    { at: 0.25, pose: { head: -0.09 } },
    { at: 0.5, pose: { hipX: 6, crouch: 7, lean: 0.065, gripX: 136, gripY: -352 } },
    { at: 0.85, pose: { hipX: -13, crouch: 20, lean: -0.16, gripX: 105, gripY: -330 }, ease: 'power2.out' },
    { at: 1.0, pose: { head: 0.035, scarf: 0.19 } },
    { at: 1.2, pose: { hipX: -9, crouch: 15, lean: -0.09, scarf: -0.055 } },
    { at: 1.6, pose: { hipX: -2, crouch: 3, lean: -0.02, head: -0.04, gripX: 121, gripY: -341, scarf: 0.02 } },
    { at: 23 / 12, pose: base },
  ]);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const capsule = (p, a, b, r0, r1 = r0) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy) - mix(r0, r1, u);
};
const ellipse = (p, center, rx, ry) => (Math.hypot((p[0] - center[0]) / rx, (p[1] - center[1]) / ry) - 1) * Math.min(rx, ry);
function polygon(p, points) {
  let inside = false, d = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    d = Math.min(d, capsule(p, a, b, 0));
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? -d : d;
}

// Literal RGBA painting: every covered pixel is shaded from continuous contours,
// lighting and stable pigment variation. No image parts, sprite rotations or
// Canvas shape drawing. IK supplies only anatomical points, not raster artwork.
export function paintPixelCharacter(pose, { w = 320, h = 400, scale = 0.8 } = {}) {
  const rig = evaluatePullRig(pose), data = new Uint8ClampedArray(w * h * 4);
  const origin = [w / 2, h - 34];
  // Child proportions: broad coat/head and shorter legs, while preserving soles.
  const warpY = y => y > -180 ? y * 0.70 : y + 54;
  const unwarpY = y => y > -126 ? y / 0.70 : y - 54;
  const warp = p => [p[0] * 1.25, warpY(p[1])];
  const shapes = [];
  const shape = (bounds, sdf, color, detail = false) => shapes.push({ bounds, sdf, color, detail });
  const line = (a, b, ra, rb, color, detail = false) => {
    const r = Math.max(ra, rb) + 2;
    shape([Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r], p => capsule(p, a, b, ra, rb), color, detail);
  };
  const oval = (center, rx, ry, color, detail = false) => shape([center[0]-rx-2, center[1]-ry-2, center[0]+rx+2, center[1]+ry+2], p => ellipse(p, center, rx, ry), color, detail);
  const path = (points, color) => shape([Math.min(...points.map(p=>p[0]))-2, Math.min(...points.map(p=>p[1]))-2, Math.max(...points.map(p=>p[0]))+2, Math.max(...points.map(p=>p[1]))+2], p => polygon(p, points), color);
  const blue = [84, 134, 162], darkBlue = [61, 100, 126], brown = [107, 72, 48], yellow = [218, 172, 73];
  const leg = (i, color) => {
    const L = rig.legs[i];
    line(L.root, L.joint, 15, 12, color); line(L.joint, L.end, 12, 10, color);
    line([L.foot[0] + 1, -27], [L.foot[0] + 3, -10], 12, 13, [93, 69, 43]);
    line([L.foot[0] - 8, -8], [L.foot[0] + 27, -8], 9, 8, [102, 75, 44]);
    line([L.foot[0] - 14, -1], [L.foot[0] + 32, -1], 2, 2, [65, 49, 33], true);
  };
  leg(0, [83, 58, 42]);
  line(rig.farShoulder, rig.farArm.joint, 18, 15, darkBlue);
  line(rig.farArm.joint, rig.farArm.end, 15, 12, darkBlue);
  leg(1, brown);
  // Scarf follows a curved continuous band, reshaped for each drawing.
  const collar = M.apply(rig.torso, 48, 30);
  let last = collar;
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    const next = [collar[0] - 145*u, collar[1] + 12*Math.sin(u*4 + pose.scarf*3)*u - pose.scarf*65*u];
    line(last, next, 10*(1-u*0.45), 9*(1-u*0.45), yellow);
    line([last[0],last[1]+10*(u-0.1)],[next[0],next[1]+10*u],7,5,[205,151,58]);
    last=next;
  }
  // Body silhouette changes as a whole, including hem flare and compressed folds.
  const body = [[34,45],[65,35],[86,50],[94,87],[101,183],[90,193],[34,190],[17,182],[27,98]]
    .map(([x,y])=>M.apply(rig.torso,x+(y>140?pose.crouch*0.09:0),y));
  path(body, blue);
  line(M.apply(rig.torso,74,78),M.apply(rig.torso,86,177),1,1,[62,108,138],true);
  const pocket = [[63,133],[83,132],[85,166],[66,167]].map(p=>M.apply(rig.torso,...p));
  path(pocket,[77,125,151]);
  for(let i=0;i<3;i++)line(M.apply(rig.torso,38+i*7,163),M.apply(rig.torso,65+i*5,173-pose.crouch*0.22),0.7,0.4,[68,114,142],true);
  // Local head coordinates allow jaw, nose, eye and hair to react together.
  const H = p => M.apply(rig.head,...p);
  path([[62,17],[78,25],[87,39],[91,48],[99,55],[89,60],[89,68],[81,78],[65,81],[53,66],[52,38]].map(H),[220,172,132]);
  oval(H([37,36]),35,34,[92,59,38]);
  oval(H([17,63]),23,15,[83,53,36]);
  path([[72,10],[84,22],[86,37],[76,43],[69,56],[60,38]].map(H),[94,60,38]);
  oval(H([68,58]),7,9,[210,150,115]);
  oval(H([69,59]),3,5,[183,120,91],true);
  path([[86,49],[98,55],[88,60]].map(H),[224,177,136]);
  oval(H([86,48]),3.3,4.5,[237,224,198],true);
  oval(H([87,48]),1.8,3.5,[52,40,32],true);
  line(H([82,41]),H([88,42]),0.9,0.6,[65,43,31],true);
  line(H([86,68]),H([92,67]),0.8,0.5,[148,92,74],true);
  for(let i=0;i<5;i++)line(H([17+i*7,16]),H([31+i*6,29]),0.8,0.5,[117,77,45],true);
  // Collar covers the neck, not an exposed cutout seam.
  line(M.apply(rig.torso,39,34),M.apply(rig.torso,77,41),14,15,yellow);
  line(rig.shoulder, rig.arm.joint, 18, 15, blue);
  line(rig.arm.joint, rig.arm.end, 15, 11, blue);
  line(rig.arm.end,[rig.grip[0]-4,rig.grip[1]],9,10,[221,173,133]);
  for(let i=0;i<3;i++)line([rig.grip[0]-8,rig.grip[1]-6+i*4],[rig.grip[0]+1,rig.grip[1]-5+i*4],0.6,0.4,[160,111,83],true);

  for(const {bounds,sdf,color,detail} of shapes) {
    const x0=clamp(Math.floor(origin[0]+bounds[0]*1.25*scale),0,w-1), x1=clamp(Math.ceil(origin[0]+bounds[2]*1.25*scale),0,w-1);
    const y0=clamp(Math.floor(origin[1]+warpY(bounds[1])*scale),0,h-1), y1=clamp(Math.ceil(origin[1]+warpY(bounds[3])*scale),0,h-1);
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
      const p=[(x-origin[0])/(scale*1.25),unwarpY((y-origin[1])/scale)], d=sdf(p);
      const alpha=clamp(0.5-d*scale,0,1); if(!alpha)continue;
      const noise=((Math.imul(x+31,374761393)^Math.imul(y+19,668265263))>>>0)%256/255;
      const brush=0.035*Math.sin(p[0]*0.31+p[1]*0.09)+0.09*(noise-0.5);
      const depth=detail?1:clamp(-d/12,0,1);
      const light=detail?1:0.81+0.20*depth+brush+0.04*(1-(x-x0)/(x1-x0||1));
      const k=(y*w+x)*4, old=data[k+3]/255, out=alpha+old*(1-alpha);
      for(let c=0;c<3;c++)data[k+c]=(color[c]*light*alpha+data[k+c]*old*(1-alpha))/out;
      data[k+3]=out*255;
    }
  }
  return { w,h,data,grip:warp(rig.grip).map((v,i)=>origin[i]+v*scale), feet:rig.legs.map(L=>[origin[0]+L.foot[0]*1.25*scale,origin[1]]) };
}
