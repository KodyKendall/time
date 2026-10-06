import { Film } from './engine/film.js';
import { M } from './engine/math.js';
import { svgAt, drawingAt, FPS, DURATION } from './characters/wren/authored-drawings.js';
import { kite as paintKite, X } from './scenes/tether/sketch.js';

export async function buildFilm() {
  const frames=await Promise.all(Array.from({length:DURATION*FPS+1},async(_,i)=>{
    const image=new Image();
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgAt(i/FPS));
    await image.decode();return image;
  }));
  const bg=new Image();bg.src='assets/tether/plates/bg1.png';await bg.decode();
  const scene={id:'wren-authored',paint(P){return {
    frames:frames.map(image=>P.image(image,{w:800,h:900})),
    bg:P.image(bg,{w:1920,h:1280}),
    kite:P.layer('kite',{w:120,h:180,scale:3},c=>{paintKite(c,X(60,70,1,0),1,{});c.flush();}),
  };},draw(R,t,A){
    const index=Math.min(frames.length-1,Math.max(0,Math.floor((t+1e-7)*FPS)));
    const drawing=drawingAt(index/FPS), matrix=M.place(665,880,0.95,0,379,853);
    R.layer(A.bg,M.translate(0,-100));
    R.layer(A.frames[index],matrix);
    const grip=M.apply(matrix,...drawing.grip);
    const tension=(589-drawing.grip[0])/40;
    const kite=[1360-15*tension,250-20*tension];
    const angle=Math.atan2(kite[1]-grip[1],kite[0]-grip[0]);
    R.rect(0,0,Math.hypot(kite[0]-grip[0],kite[1]-grip[1]),1.8,'#a39371',{m:M.place(...grip,1,angle)});
    const km=M.place(...kite,1.5,0.25+tension*0.2,60,70);
    R.layer(A.kite,km);
    let prev=M.apply(km,60,152);
    const root=prev;
    for(let i=1;i<=20;i++){
      const u=i/20,point=[root[0]-45*u+12*u*Math.sin(u*5-index/FPS*1.5),root[1]+140*u];
      R.rect(0,-1.5,Math.hypot(point[0]-prev[0],point[1]-prev[1])+0.2,3.5,'#be8b51',
        {m:M.place(...prev,1,Math.atan2(point[1]-prev[1],point[0]-prev[0]))});prev=point;
    }
  },blur:()=>1,post:()=>({bloom:0.005,exposure:1,sat:1,contrast:1,paper:0.18,grain:0.02,vignette:0.1})};
  // One action, then a final hold. No repeated artificial loop.
  return new Film({fps:24,duration:5,shots:[{id:'pull',scene,start:0,end:5}]});
}
