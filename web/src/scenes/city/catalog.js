// CITY — catalogue of building paintings. Each FRONT is a unique painted facade; SIDES are sparse
// walls (party / gable-end walls) used on building sides and backs.
export const STYLES = {
  brick: { wall: '#b8553b', wall2: '#983f2e', wallL: '#d06c4b', mortar: '#7e3528', trim: '#f0dab2', frame: '#f3e6c8', glass: '#1a2e3d', brick: true, awn: ['#d8452f', '#f3e6c8'] },
  ochre: { wall: '#e2a63c', wall2: '#c98f3a', wallL: '#f2c25e', trim: '#fbe6b8', frame: '#6e4020', glass: '#1c4650', shutters: '#2f7f78', awn: ['#d8452f', '#3cc7c6'] },
  plum: { wall: '#7d3b6a', wall2: '#622c55', wallL: '#98507f', trim: '#ecc98e', frame: '#ecc98e', glass: '#141f36', awn: ['#1f8a8a', '#f3e6c8'] },
  salmon: { wall: '#dc7f55', wall2: '#c3633e', wallL: '#ec9a72', trim: '#f6e2c0', frame: '#f6e2c0', glass: '#1b2136', shutters: '#3f7d5a', awn: ['#3f7d5a', '#f6e2c0'] },
  sand: { wall: '#e6c487', wall2: '#cda463', wallL: '#f3daa4', trim: '#fff1d4', frame: '#7c4e2e', glass: '#155f73', awn: ['#1f8a8a', '#fff1d4'] },
  rust: { wall: '#a73c2b', wall2: '#872e22', wallL: '#bf5238', mortar: '#62231a', trim: '#e9c98a', frame: '#e9c98a', glass: '#1b3142', brick: true, awn: ['#f2b544', '#16223a'] },
  teal: { wall: '#2f7f78', wall2: '#1f5f5a', wallL: '#4a9a90', trim: '#f3e6c8', frame: '#f3e6c8', glass: '#16223a', awn: ['#e8622c', '#f3e6c8'] },
  cream: { wall: '#ecdcb8', wall2: '#d2bd94', wallL: '#fbf0d6', trim: '#fffaf0', frame: '#5a3a2a', glass: '#1c4650', shutters: '#a63a2a', awn: ['#a63a2a', '#fffaf0'] },
  rose: { wall: '#d98a82', wall2: '#bf6c68', wallL: '#eca69c', trim: '#fff0dc', frame: '#fff0dc', glass: '#1b2136', awn: ['#16223a', '#fff0dc'] },
  slate: { wall: '#6a7fa0', wall2: '#52668a', wallL: '#8a9cba', trim: '#f3e6c8', frame: '#f3e6c8', glass: '#16223a', awn: ['#f2b544', '#16223a'] },
};

// bays x floors define the building footprint width (28 per bay) and height (40 + 30/floor)
export const FRONTS = [
  { bays: 4, floors: 5, style: 'brick', ground: 'shop', roof: 'cornice', win: 'arch', quoins: true, balconies: [2], ivy: true, main: true },
  { bays: 5, floors: 4, style: 'ochre', ground: 'arcade', roof: 'parapet', win: 'rect', pediment: true, laundry: true, main: true },
  { bays: 3, floors: 5, style: 'plum', ground: 'cafe', roof: 'gable', win: 'rect', balconies: [1, 3], main: true },
  { bays: 4, floors: 3, style: 'salmon', ground: 'plain', roof: 'dutch', win: 'rect', ivy: true, posters: true, village: true },
  { bays: 5, floors: 5, style: 'sand', ground: 'arcade', roof: 'mansard', win: 'pair', balconies: [2, 4], main: true },
  { bays: 4, floors: 4, style: 'teal', ground: 'shop', roof: 'cornice', win: 'rect', pediment: true, laundry: true, main: true },
  { bays: 3, floors: 3, style: 'cream', ground: 'plain', roof: 'gable', win: 'rect', ivy: true, village: true },
  { bays: 5, floors: 5, style: 'rust', ground: 'arcade', roof: 'parapet', win: 'arch', quoins: true, main: true },
  { bays: 3, floors: 2, style: 'salmon', ground: 'plain', roof: 'cornice', win: 'rect', posters: true, village: true, ivyRight: true, ivy: true },
  { bays: 3, floors: 4, style: 'rose', ground: 'shop', roof: 'dutch', win: 'rect', laundry: true, main: true },
  { bays: 4, floors: 5, style: 'plum', ground: 'arcade', roof: 'mansard', win: 'arch', balconies: [3], main: true },
  { bays: 4, floors: 3, style: 'slate', ground: 'plain', roof: 'cornice', win: 'rect', pediment: true, village: true, ivy: true },
];
export const SIDES = [
  { bays: 5, floors: 5, style: 'brick', ground: 'plain', roof: 'cornice', win: 'rect', sparse: true, pipe: true, laundry: true },
  { bays: 5, floors: 5, style: 'ochre', ground: 'plain', roof: 'cornice', win: 'rect', sparse: true, ivy: true },
  { bays: 5, floors: 5, style: 'salmon', ground: 'plain', roof: 'cornice', win: 'rect', sparse: true, laundry: true, pipeRight: true },
];
// the town hall across the end of the main street (the clock tower rises from its centre)
export const HALL_SPEC = { bays: 18, floors: 3, style: 'sand', ground: 'arcade', roof: 'parapet', win: 'arch', quoins: true, pediment: true, balconies: [1] };
// facade style -> side wall painting
export const SIDE_OF = { brick: 0, rust: 0, plum: 0, slate: 0, ochre: 1, sand: 1, cream: 1, teal: 1, salmon: 2, rose: 2 };
