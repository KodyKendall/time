import { mkdirSync,writeFileSync } from 'node:fs';
import { svgAt,KEY_DRAWINGS,FPS,DURATION } from '../web/src/characters/wren/authored-drawings.js';
const dir=new URL('../output/authored-study/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const key of KEY_DRAWINGS)writeFileSync(new URL(`key-${key.id}.svg`,dir),svgAt(key.at));
for(let i=0;i<=DURATION*FPS;i++)writeFileSync(new URL(`drawing-${String(i).padStart(2,'0')}.svg`,dir),svgAt(i/FPS));
writeFileSync(new URL('timing.json',dir),JSON.stringify({fps:FPS,duration:DURATION,keys:KEY_DRAWINGS},null,2)+'\n');
console.log(`Exported ${KEY_DRAWINGS.length} key drawings and ${DURATION*FPS+1} complete vector frames.`);
