import assert from 'node:assert/strict';
import { drawingAt,svgAt,KEY_DRAWINGS,FPS,DURATION } from '../web/src/characters/wren/authored-drawings.js';
const first=drawingAt(0),feet=first.paths.filter(p=>p.group==='farBoot'||p.group==='nearBoot').map(p=>p.d);
const cmds=d=>d.match(/[MLCQZ]/g).join('');
for(let i=0;i<=FPS*DURATION;i++){
  const drawing=drawingAt(i/FPS),svg=svgAt(i/FPS);
  assert.equal(drawing.paths.length,first.paths.length);
  assert.deepEqual(drawing.paths.filter(p=>p.group==='farBoot'||p.group==='nearBoot').map(p=>p.d),feet,'boot drawings must stay planted');
  drawing.paths.forEach((p,j)=>{
    assert.equal(cmds(p.d),cmds(first.paths[j].d),'path correspondence must persist');
    assert.doesNotMatch(p.d,/NaN|Infinity/);
  });
  assert.doesNotMatch(svg,/<image\b|<use\b|\btransform=/,'frames must be expanded drawings, not transformed raster pieces');
  assert.ok(drawing.grip.every(Number.isFinite));
}
assert.equal(svgAt(0),svgAt(DURATION),'the final hold must restore the original drawing');
assert.notEqual(svgAt(0),svgAt(KEY_DRAWINGS.find(k=>k.id==='catch').at),'the catch must visibly redraw the character');
const catchTime=KEY_DRAWINGS.find(k=>k.id==='catch').at;
assert.notEqual(first.paths.find(p=>p.name==='eye-white').d,drawingAt(catchTime).paths.find(p=>p.name==='eye-white').d,'expression is drawn with the performance');
assert.deepEqual(drawingAt(2),drawingAt(2),'random-access drawing must be repeatable');
console.log(`Authored drawings passed: ${KEY_DRAWINGS.length} key poses, ${FPS*DURATION+1} complete frames, fixed boots, expression and final hold.`);
