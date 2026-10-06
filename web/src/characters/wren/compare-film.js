import { Film } from '../../engine/film.js';
import { M } from '../../engine/math.js';
import { createPixelCycle, paintPixelCharacter, cycleFrame } from './pixel-cycle.js';
import { kite as paintKite, X } from '../../scenes/tether/sketch.js';
const cycle=createPixelCycle();
export async function buildComparison(mode='both') {
  const load=async src=>{const img=new Image();img.src=src;await img.decode();return img;};
  const bg=await load('assets/tether/plates/bg1.png');
  const drawn=await Promise.all(Array.from({length:24},(_,i)=>load(`assets/tether/drawn-cycle/pose-${String(i).padStart(2,'0')}.png`)));
  const response=await fetch('assets/tether/drawn-cycle/registration.json');
  if(!response.ok)throw new Error('Missing drawing registration');
  const metadata=await response.json();
  const pixel=Array.from({length:24},(_,i)=>{
    const frame=paintPixelCharacter(cycle.sample(i/12));
    const canvas=document.createElement('canvas');canvas.width=frame.w;canvas.height=frame.h;
    canvas.getContext('2d').putImageData(new ImageData(frame.data,frame.w,frame.h),0,0);
    return {...frame,canvas};
  });
  const sides=mode==='both'?['drawn','pixel']:[mode];
  const panelWidth=1920/sides.length;
  const scene={id:`wren-${mode}-comparison`,paint(P){
    return {
      bg:P.image(bg,{w:panelWidth,h:1280}),
      drawn:drawn.map(img=>P.image(img,{w:512,h:600})),
      pixel:pixel.map(frame=>P.image(frame.canvas,{w:448,h:560})),
      titles:sides.map(side=>P.text([side==='drawn'?'A · COMPLETE DRAWINGS':'B · PAINTED PIXEL BY PIXEL'],
        {font:'600 32px Georgia',color:'#24343b'})),
      kite:P.layer('kite',{w:120,h:180,scale:3},c=>{paintKite(c,X(60,70,1,0),1,{});c.flush();}),
    };
  },draw(R,t,A){
    const index=cycleFrame(t);
    sides.forEach((side,panel)=>{
      const offset=panel*panelWidth,center=offset+panelWidth*0.45;
      R.layer(A.bg,M.translate(offset,-100));
      let grip;
      if(side==='drawn'){
        const matrix=M.place(center,850,1,0,256,560);
        R.layer(A.drawn[index],matrix);
        grip=M.apply(matrix,...metadata[index].grip.map(v=>v*2));
      }else{
        const frame=pixel[index],matrix=M.place(center,850,1,0,224,(400-34)*1.4);
        R.layer(A.pixel[index],matrix);
        grip=M.apply(matrix,...frame.grip.map(v=>v*1.4));
      }
      const pose=cycle.sample(index/12);
      const kite=[offset+panelWidth*0.84,220-pose.crouch*0.8];
      const angle=Math.atan2(kite[1]-grip[1],kite[0]-grip[0]);
      R.rect(0,0,Math.hypot(kite[0]-grip[0],kite[1]-grip[1]),1.5,'#a08d68',{m:M.place(...grip,1,angle)});
      const km=M.place(...kite,0.9,0.25+pose.crouch*0.008,60,70);
      R.layer(A.kite,km);
      const tail=M.apply(km,60,152);
      R.rect(0,0,75,2,'#b87949',{m:M.place(...tail,1,1.8)});
      R.layer(A.titles[panel],M.translate(offset+40,40));
    });
    if(sides.length===2)R.rect(958,0,4,1080,'#354b50');
  },blur:()=>1,post:()=>({bloom:0,exposure:1,sat:1,contrast:1,paper:0.1,grain:0.01,vignette:0.08})};
  return new Film({fps:24,duration:6,shots:[{id:'cycle',scene,start:0,end:6}]});
}
