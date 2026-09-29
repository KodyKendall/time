import { M, clamp, prog, lerp, ease, mixHex } from '../../engine/math.js';
export const C = { night:'#0B0620', ink2:'#120A33', ink3:'#1A1046', violet:'#6D4AFF', white:'#ffffff', ink:'#26382f', green:'#217346', dark:'#185c37', grey:'#e7ebe8', gold:'#d9ae51', eye:'#4592e9' };
export const DATA = [
 ['Roof repair','Hansen','Done','9/12','$4,200'],['Rewire','Miller','Open','9/13','$6,800'],
 ['Solar install','Patel','Done','9/14','$9,600'],['Inspection','Baker','Open','9/15','$850'],
 ['New kitchen','Wilson','Active','9/16','$7,500'],['Boiler service','Jones','Done','9/17','$1,200'],
 ['Shop lighting','Smith','Active','9/18','$5,300'],['Gate repair','Davis','Open','9/19','$3,000']
];
// Native surfaces keep paint bleed inside the artwork. Text is always P.text.
export function surface(P,name,w,h,fn) { return P.layer(name,{w,h,scale:1,seed:'leo/'+name},c=>c.native(p=>{p.noStroke();fn(p,c);})); }
export function label(P,text,size=26,color=C.ink,bold=false) {return P.text(text,{font:`${bold?600:400} ${size}px Arial`,color,pad:0,scale:1.5});}
export function put(R,L,x,y){R.layer(L,M.translate(x,y));}
export function box(p,x,y,w,h,color,r=0){
 p.noStroke();p.fill(color);p.rect(x,y,w,h,r);
 // Sparse, seeded paper fibres: bounded by each surface, never laid over text.
 if(w>30&&h>30){
  const green=color===C.green||color===C.dark;
  p.stroke(green?'#679775':'#d9ddd3');p.strokeWeight(.55);
  for(let i=0;i<Math.min(700,w*h/360);i++){
   const xx=x+3+p.random(w-12),yy=y+3+p.random(h-6);
   p.line(xx,yy,Math.min(x+w-3,xx+p.random(3,19)),yy+p.random(-.6,.6));
  }
 }p.noStroke();
}
function path(p,points,color){p.fill(color);p.noStroke();p.beginShape();for(const [x,y] of points)p.vertex(x,y);p.endShape(p.CLOSE);}
function bezier(p,fn,color,c){
 const pts=[];
 fn({vertex(x,y){pts.push([x,y]);},bezierVertex(ax,ay,bx,by,x,y){const [sx,sy]=pts[pts.length-1];for(let i=1;i<=20;i++){const t=i/20,u=1-t;pts.push([u*u*u*sx+3*u*u*t*ax+3*u*t*t*bx+t*t*t*x,u*u*u*sy+3*u*u*t*ay+3*u*t*t*by+t*t*t*y]);}}});
 path(p,pts,color);
 if(c){
  c.fillPoly(pts,'#e0e5db',{opacity:95,bleed:0,texture:.75,border:.15});
  c.hatchPoly(pts,{dist:9,angle:68,brushName:'gouache',color:'#f9faf2',weight:.65,rand:.25});
  c.hatchPoly(pts,{dist:13,angle:72,brushName:'dry',color:'#e3e8df',weight:.22,rand:.65});
  c.flush();path(p,pts,'#ffffffa0');
  c.strokePath(pts,'charcoal','#81918d',.32,0);
  c.flush();
 }
}
export const post=()=>({bloom:0,paper:.12,grain:0,vignette:0});
export const LEO={eye:[271.4,234.1,30.5]};
export function paintLeo(P){
 const neck=surface(P,'neck',500,560,(p,c)=>{
  bezier(p,p=>{p.vertex(97,490);p.vertex(97,180);p.bezierVertex(97,100,137,37,188,20);p.vertex(222,20);p.vertex(222,160);p.vertex(185,160);p.vertex(185,70);p.bezierVertex(149,101,135,140,135,180);p.vertex(135,250);p.bezierVertex(133,311,191,380,260,380);p.vertex(311,380);p.vertex(311,490);},C.white,c);
  // Original visible neck below jaw is 150px; 45px extension = 30%.
  // A continuous 65px dry-brush ending, no horizontal terminal edge.
  p.beginShape(p.TRIANGLES);
  for(const [x,y,a] of [[97,489,255],[311,489,255],[287,553,0],[97,489,255],[287,553,0],[110,553,0]]){p.fill(255,255,255,a);p.vertex(x,y);}
  p.endShape();
  p.stroke(226,230,222,85);p.strokeWeight(.65);
  for(let i=0;i<32;i++){const x=103+i*6.1;p.line(x,391+(i%5)*6,x+1,480+(i%7));}
 });
 const head=surface(P,'head',500,560,(p,c)=>{
  bezier(p,p=>{p.vertex(185,160);p.bezierVertex(220,148,264,144,302,160);p.bezierVertex(334,182,400,198,433,230);p.bezierVertex(456,258,456,304,434,320);p.bezierVertex(413,347,370,350,323,349);p.vertex(250,340);p.bezierVertex(203,347,168,293,165,247);p.bezierVertex(161,215,174,183,185,160);},C.white,c);
  c.fillPoly([[186,176],[178,209],[174,247],[187,285],[215,315],[245,326],[220,302],[202,266],[196,221],[205,177]],'#a8bbb7',{opacity:75,bleed:.015,texture:.8,border:.05});c.flush();
  p.stroke(224,229,221,75);p.strokeWeight(.7);for(let i=0;i<15;i++)p.line(211+i*10,286+(i%3)*5,222+i*10,308+(i%3)*4);
 });
 const ear=surface(P,'ear',500,560,(p,c)=>bezier(p,p=>{p.vertex(228,153);p.vertex(306,25);p.bezierVertex(334,44,332,115,308,161);p.bezierVertex(280,155,255,153,228,163);},C.white,c));
 const eye=P.layer('eye',{w:64,h:64,scale:1.5,seed:'leo/eye'},c=>{
  const rim=c.blob(32,32,29,29,{wobble:.025,n:32});
  c.washPoly(rim,C.eye);c.fillPoly(rim,'#246fc4',{opacity:155,bleed:0,texture:.8,border:.7});
  c.fillPoly(c.blob(27,25,19,18,{wobble:.06}), '#72b9ef',{opacity:125,bleed:.02,texture:.7});
  c.fillPoly(c.blob(23,21,5,4,{wobble:.08}), '#ffffff',{opacity:235,bleed:.02});
 });
 return {neck,head,ear,eye};
}
export function blinkAt(t,centers){return Math.max(0,...centers.map(c=>1-clamp(Math.abs(t-c)/.14)));}
export function drawLeo(R,A,{x=890,y=460,scale=1.38,bob=0,blink=0,twitch=0,showEye=true}={}){
 const m=M.place(x,y+bob,scale,0,255,260);
 R.layer(A.neck,m);R.layer(A.ear,M.mul(m,M.chain(M.translate(270,148),M.rotate(twitch),M.translate(-270,-148))));R.layer(A.head,m);
 if(showEye)R.layer(A.eye,M.mul(m,M.place(271.4,234.1,1,0,32,32,Math.max(.06,1-blink))));
}
export const SHEET={x:160,y:112,w:1600,h:850,gridY:330,rowH:55,xs:[220,630,940,1160,1390,1630,1760]};
export function paintLedger(P){
 const s=SHEET;
 const paper=surface(P,'sheet-paper',1920,1080,(p,c)=>{
  box(p,174,128,1600,850,'#05020f');box(p,s.x,s.y,s.w,s.h,'#ffffff');
  box(p,160,112,1600,66,C.dark);box(p,160,178,1600,72,C.green);
  box(p,160,250,1600,80,'#f4f6f4');box(p,160,330,1600,42,'#e9edea');
  box(p,160,372,60,550,'#edf0ed');box(p,160,922,1600,40,'#eef1ee');
  c.hatchPoly([[164,182],[1756,182],[1756,246],[164,246]],{dist:10,angle:0,brushName:'gouache',color:'#398558',weight:1.1,rand:.2});c.flush();
  box(p,295,264,1450,50,'#ffffff');box(p,174,264,110,50,'#ffffff');
  p.stroke('#ffffff');p.strokeWeight(2);p.noFill();p.rect(188,130,32,29);p.line(188,140,220,140);p.line(198,130,198,159);p.line(210,130,210,159);
 });
 const rules=surface(P,'sheet-rules',1920,1080,(p,c)=>{
  for(let r=0;r<10;r++)if(r%2===0)box(p,220,372+r*55,1540,55,'#fbfbf8');
  box(p,220,372,1540,55,'#edf4ee');box(p,220,867,1540,55,'#edf4ee');
  for(const [col,row] of [[2,2],[2,5],[4,9],[5,4]]){
   const x=s.xs[col],y=372+row*55;
   c.fillPoly([[x+3,y+3],[s.xs[col+1]-3,y+3],[s.xs[col+1]-3,y+52],[x+3,y+52]],col===4?'#d9ae51':'#9ec9ad',{opacity:55,bleed:0,texture:.65});
  }
  for(const x of s.xs)c.strokePath([[x,330],[x+.3,615],[x,922]],'pen','#b1bdb4',.55,0);
  for(let r=0;r<=10;r++)c.strokePath([[160,372+r*55],[950,372+r*55+.4],[1760,372+r*55]],'pen','#b1bdb4',.55,0);
 });
 const chrome=[['jobs.xlsx',242,128,30,'#ffffff',true],['File     Home     Insert     Page Layout     Formulas     Data     Review',190,196,26,'#ffffff'],['E10',192,275,25],['fx',312,275,25,C.green,true],['=SUM(E2:E9)',369,275,26],['Jobs',233,929,23,C.green,true]];
 const texts=chrome.map(([t,x,y,z,c,b])=>({L:label(P,t,z,c,b),x,y}));
 for(let i=0;i<6;i++)texts.push({L:label(P,'ABCDEF'[i],24),x:(s.xs[i]+s.xs[i+1])/2-8,y:335});
 for(let r=0;r<10;r++)texts.push({L:label(P,String(r+1),23),x:178,y:386+r*55});
 const values=[];const rows=[['Job','Client','Status','Date','Total'],...DATA,['Total','','','','$38,450']];
 rows.forEach((row,r)=>row.forEach((t,c)=>{if(!t)return;const L=label(P,t,27,C.ink,r===0||r===9);values.push({L,x:c>=3?s.xs[c+1]-20-L.w:s.xs[c]+18,y:383+r*55,r,c});}));
 return {paper,rules,texts,values};
}
// Marimba note times before 10 s: row r (0 = headers, 9 = total) STARTS on ROW_CUES[r].
export const ROW_CUES=[1.248,2.498,3.746,4.995,6.245,7.504,8.743,10.0,11.249,12.501];
const TICK=.3125; // pizzicato 8ths: the selection hops one cell per tick
export function drawLedger(R,A,t=8){
 R.layer(A.paper);
 const ink=prog(t,0,1.15);
 if(ink>0) R.layer(A.rules,M.id(),{mask:{type:'rect',x0:160,y0:330,x1:160+1600*ink,y1:923,soft:0}});
 A.texts.forEach(q=>put(R,q.L,q.x,q.y));
 let selected=null;
 A.values.forEach((q,i)=>{
  const cue=ROW_CUES[q.r]+q.c*.03;
  const on=prog(t,cue,cue+.08);
  if(on>0)R.layer(q.L,M.place(q.x,q.y+q.L.h/2,1,0,0,q.L.h/2,on));
 });
 let r=-1;for(let k=0;k<ROW_CUES.length;k++)if(t>=ROW_CUES[k])r=k;
 if(r>=0){
  const col=r===9?4:Math.floor((t-ROW_CUES[r])/TICK+1e-6)%5;
  selected={r,c:col};
 }
 if(selected){const x=SHEET.xs[selected.c],y=372+selected.r*55,w=SHEET.xs[selected.c+1]-x,h=55;
  R.rect(x,y,w,4,C.green);R.rect(x,y+h-4,w,4,C.green);R.rect(x,y,4,h,C.green);R.rect(x+w-4,y,4,h,C.green);R.rect(x+w-6,y+h-6,10,10,C.green);
 }
}
export const APP={x:680,y:185,w:1130,h:710};
export function paintApp(P){
 const parts=[];
 function part(name,w,h,fn,strings){return {bg:surface(P,name,w,h,(p,c)=>{fn(p);if(name==='app-chart'){for(let i=0;i<8;i++){const h=[44,71,54,89,66,103,84,112][i],x=65+i*100;c.hatchPoly([[x+2,158-h],[x+43,158-h],[x+43,158],[x+2,158]],{dist:5,angle:88,brushName:'dry',color:i===7?'#f0d18a':'#78a487',weight:.8,rand:.2});}}}),texts:strings.map(([t,x,y,z=26,c=C.ink,b=false])=>({L:label(P,t,z,c,b),x,y})),w,h};}
 parts.push(part('app-top',1130,142,p=>{
  box(p,0,0,1130,60,'#eceef0');box(p,0,59,1130,1,'#d5d9dc');
  [['#ee6a5f',22],['#f5bf4f',44],['#62c554',66]].forEach(([c,x])=>{p.fill(c);p.circle(x,30,13);});
  box(p,160,12,620,36,'#ffffff',18);
  p.fill('#6b7c72');p.rect(180,28,13,10,2);p.noFill();p.stroke('#6b7c72');p.strokeWeight(2);p.arc(186.5,28,9,11,p.PI,0);p.noStroke();
  box(p,0,60,1130,82,'#ffffff');box(p,0,140,1130,2,'#dce3dd');p.fill(C.green);p.circle(37,100,23);
  p.fill('#6f7f77');p.arc(930,99,24,26,p.PI,0);p.rect(918,99,24,8);p.circle(930,110,6);p.fill(C.gold);p.circle(939,90,7);
  p.fill(C.green);p.circle(1082,100,44);
 },[['←',94,13,26,'#8a969c'],['→',124,13,26,'#8a969c'],['jobs.llamapress.ai',203,15,23,'#3c4a44'],
   ['Jobs',61,80,34,C.dark,true],['Jamie',966,86,24,'#3c4a44'],['JH',1067,87,21,'#ffffff',true]]));
 parts.push(part('app-nav',210,628,p=>{box(p,0,0,210,628,'#f1f4f1');box(p,14,48,182,53,'#dfece2');box(p,209,0,1,628,'#dce3dd');},[['Overview',31,58,25,C.green,true],['All jobs',31,135,25],['Clients',31,212,25],['Reports',31,289,25]]));
 parts.push(part('app-stats',920,180,p=>{box(p,0,0,920,180,'#fafbf9');for(let i=0;i<3;i++){box(p,22+i*298,23,276,135,'#dce3dd',5);box(p,23+i*298,24,274,133,'#ffffff',5);box(p,23+i*298,24,4,133,i===1?C.gold:C.green);}},[['Open jobs',43,42,24],['12',43,80,44,C.dark,true],['This month',341,42,24],['$38,450',341,83,38,C.dark,true],['Done',639,42,24],['31',639,80,44,C.dark,true]]));
 parts.push(part('app-chart',920,192,p=>{box(p,0,0,920,192,'#fafbf9');box(p,22,0,876,183,'#ffffff');p.stroke('#e5ebe5');p.strokeWeight(1);for(let j=0;j<3;j++)p.line(48,75+j*42,874,75+j*42);for(let i=0;i<8;i++)box(p,65+i*100,158-[44,71,54,89,66,103,84,112][i],45,[44,71,54,89,66,103,84,112][i],i===7?C.gold:C.green);},[['Revenue',43,6,25,C.dark,true],['September',733,8,22,'#617368']]));
 parts.push(part('app-list',920,256,p=>{box(p,0,0,920,256,'#fafbf9');box(p,22,0,876,242,'#ffffff');for(let r=0;r<3;r++){box(p,42,88+r*52,834,1,'#e4e9e4');box(p,730,57+r*52,123,35,r===1?'#f5ecd6':'#e1eee4',17);}},[['Recent jobs',43,9,26,C.dark,true],...DATA.slice(0,3).flatMap((row,r)=>[['✓',43,60+r*52,26,C.green,true],[row[0],84,60+r*52,25],[row[1],328,60+r*52,24,'#617368'],[row[4],522,60+r*52,25],[row[2],752,59+r*52,23,C.dark]])]));
 parts.push(part('app-button',168,48,p=>box(p,0,0,168,48,C.green,5),[['+ New job',17,7,26,'#ffffff',true]]));
 return {parts,caption:label(P,'Leo · llamapress.ai',30,'#f3e6c8')};
}
export const PART_POS=[[680,125],[680,267],[890,267],[890,447],[890,639],[1594,833]];
export function drawPart(R,q,x,y,sx=1,sy=sx){R.with(M.chain(M.translate(x,y),M.scale(sx,sy)),()=>{R.layer(q.bg);q.texts.forEach(v=>put(R,v.L,v.x,v.y));});}
export function drawApp(R,A){A.parts.forEach((q,i)=>drawPart(R,q,...PART_POS[i]));}

// Shared assets and poses keep both sides of each hand-off identical.
function paintNight(P){
 return P.layer('leo-night',{w:1920,h:1080,scale:.65,seed:'leo/night'},c=>{
  c.washPoly([[0,0],[1920,0],[1920,1080],[0,1080]],C.night);
  // Mid band of the site's #0B0620 -> #120A33 -> #0B0620 gradient, painted as a soft wash.
  c.fillPoly([[0,300],[1920,260],[1920,820],[0,780]],C.ink2,{opacity:170,bleed:.12,texture:.6,border:.05});
  for(let i=0;i<7;i++){
   const x=120+i*290,y=220+(i%3)*280;
   c.fillPoly(c.blob(x,y,440,230,{n:24,wobble:.16}),i%2?C.ink3:'#1c1250',{opacity:60,bleed:.08,texture:.8,border:.1});
   c.hatchPoly(c.blob(x,y,330,130,{n:16,wobble:.13}),{dist:28,angle:12+i*9,brushName:'dry',color:'#23175e',weight:.5,rand:.8});
  }
  for(let i=0;i<27;i++){
   const x=c.r(35,1885),y=c.r(30,1050);
   c.line(x-2,y,x+2,y,'pastel','#b9aee6',.5);
  }
 });
}
export function drawNight(R,A){R.layer(A.night);R.glow(300,180,520,C.violet,.16);R.glow(1650,900,600,'#8B6BFF',.12);}
export function paintFilm(P){
 const A={night:paintNight(P),...paintLeo(P),...paintApp(P),ledger:paintLedger(P)};
 A.cell=surface(P,'carried-cell',220,56,p=>{box(p,0,0,220,56,'#ffffff');box(p,0,0,220,2,C.green);box(p,0,54,220,2,C.green);box(p,0,0,2,56,C.green);box(p,218,0,2,56,C.green);});
 A.talk=paintBubbles(P);
 A.captions=CAPTIONS.map(c=>({...c,L:P.text(c.text,{font:`${c.size}px Georgia, "DejaVu Serif", "Liberation Serif", serif`,color:'#f3eee2',pad:0,scale:1.5})}));
 A.cellLabels=['Jobs','Clients','$38,450','September','Roof repair','Hansen'].map(s=>label(P,s,25));
 return A;
}
export const BUBBLES=[[16.25,['Hmm.. this is an interesting','spreadsheet.']],[18.75,['Jobs, clients, status, totals.']],
 [21.25,['Your team needs an app for this.']]];
const BUBBLE_X=90,BUBBLE_Y0=300,BUBBLE_GAP=16,BUBBLE_OUT=[25.5,26.2];
function paintBubbles(P){
 let y=BUBBLE_Y0;
 const bubbles=BUBBLES.map(([t,lines],i)=>{
  const L=P.text(lines,{font:'400 25px Georgia, "DejaVu Serif", "Liberation Serif", serif',color:'#d2cee4',pad:0,scale:1.5,lineHeight:1.45});
  const w=Math.ceil(L.w+44),h=Math.ceil(L.h+30);
  const bg=surface(P,'bubble'+i,w,h,p=>{p.fill(13,13,26,238);p.stroke(139,92,246,110);p.strokeWeight(1.5);p.rect(1,1,w-2,h-2,16);});
  const b={t,L,bg,y,w,h};y+=h+BUBBLE_GAP;return b;
 });
 const ring=surface(P,'avatar-ring',60,60,p=>{p.fill(13,13,26,245);p.stroke(139,92,246,170);p.strokeWeight(2.5);p.circle(30,30,54);});
 return {bubbles,ring,leoName:label(P,'Leo',26,'#e8e5f2',true)};
}
function drawBubbles(R,t,A){
 const out=1-prog(t,...BUBBLE_OUT);if(out<=0||t<BUBBLES[0][0])return;
 const a0=prog(t,BUBBLES[0][0],BUBBLES[0][0]+.35);
 R.layer(A.talk.ring,M.translate(BUBBLE_X,BUBBLE_Y0-78),{opacity:a0*out});
 drawLeo(R,A,{x:BUBBLE_X+30,y:BUBBLE_Y0-49,scale:.075*a0*out});
 R.layer(A.talk.leoName,M.translate(BUBBLE_X+72,BUBBLE_Y0-64),{opacity:a0*out});
 A.talk.bubbles.forEach(b=>{
  const a=prog(t,b.t,b.t+.35);if(a<=0)return;
  const y=b.y+10*(1-ease.outCubic(a));
  R.layer(b.bg,M.translate(BUBBLE_X,y),{opacity:a*out});
  R.layer(b.L,M.translate(BUBBLE_X+22,y+15),{opacity:a*out});
 });
}
export const CAPTIONS=[
 {text:'Your spreadsheet.',size:46,cx:960,y:990,t0:.6,t1:13.3,t2:13.8},
 {text:'Leo reads it.',size:46,cx:960,y:990,t0:15.6,t1:25.5,t2:26.2},
 {text:'Leo builds your web app.',size:46,cx:1245,y:935,t0:30.6,t1:44.3,t2:44.9},
 {text:'Spreadsheet  →  web app.',size:60,cx:1245,y:925,t0:45,t1:48.6,t2:49.2},
];
export function drawCaptions(R,t,A){
 A.captions.forEach(c=>{
  const a=prog(t,c.t0,c.t0+.5)*(1-prog(t,c.t1,c.t2));if(a<=0)return;
  R.layer(c.L,M.translate(c.cx-c.L.w/2,c.y+8*(1-ease.outCubic(prog(t,c.t0,c.t0+.5)))),{opacity:a});
 });
}
export function pose(t){
 const u=prog(t,26.25,29.8);
 const drift=25*Math.sin((t-15)*Math.PI/2.5)*Math.sin(Math.PI*clamp((t-15)/11.25));
 return {x:lerp(890+drift,340,u),y:lerp(460,490,u),scale:lerp(1.38,1.13,u),bob:3*Math.sin((t-15)*Math.PI*2/.625)*(1-u),blink:blinkAt(t,[17.5,25,40,46.25]),twitch:t>=20&&t<=20.55?.045*Math.sin((t-20)/.55*Math.PI*2):0};
}
const FLOAT=[[1160,285],[1480,380],[1215,495],[1530,605],[1190,705],[1510,815]];
function cell(R,A,i,x,y,s=1){R.with(M.place(x,y,s,0,110,28),()=>{R.layer(A.cell);put(R,A.cellLabels[i],17,11);});}
export function drawForms(R,t,A){
 drawLeo(R,A,pose(t));
 drawBubbles(R,t,A);
 drawCaptions(R,t,A);
 for(let i=0;i<6;i++){
  const born=prog(t,22.65+i*.18,23.2+i*.18);if(born===0)continue;
  const u=prog(t,26.25+i*.08,29.8);
  const x=lerp(1340+(i%2)*285,FLOAT[i][0],u),y=lerp(310+Math.floor(i/2)*180,FLOAT[i][1],u);
  cell(R,A,i,x,y,born);
 }
}
// Only 18 short brush paths repaint during the morph; surfaces stay cached.
// Each rule's points flow into a section of the measured mascot contour.
const OUTLINE=[[97,489],[97,180],[105,120],[136,60],[188,20],[222,20],[222,160],[302,160],[306,25],[325,80],[308,151],[362,190],[433,230],[449,280],[434,320],[408,340],[323,349],[250,340],[195,320],[168,270],[165,230],[185,160],[185,70],[144,120],[135,180],[135,250],[152,310],[200,360],[260,380],[311,380],[311,489]];
export function drawSheet(R,t,A){
 if(t>=14.94){drawForms(R,15,A);return;}
 const fold=prog(t,13.747,14.6),form=prog(t,14.3,14.94,ease.outCubic);
 const ex=lerp(1690,912.632,prog(t,13.747,14.4)),ey=lerp(674.5,424.258,prog(t,13.747,14.4));
 if(fold===0)drawLedger(R,A.ledger,t);
 if(fold>0&&fold<1){
  R.with(M.place(ex,ey,1-fold,fold*.18,1690,674.5),()=>{R.layer(A.ledger.paper,M.id(),{warp:{type:'twirl',cx:1690,cy:674.5,radius:1800,angle:fold*3.8}});R.layer(A.ledger.rules,M.id(),{warp:{type:'twirl',cx:1690,cy:674.5,radius:1800,angle:fold*3.8}});const letterScale=1-prog(fold,0,.65);if(letterScale>0)[...A.ledger.texts,...A.ledger.values].forEach(q=>R.layer(q.L,M.place(q.x,q.y,letterScale,fold*1.5)));});
 }
 if(t>13.747&&t<14.94){
  const bend=prog(t,13.747,14.94);
  const L=R.dyn('flowing-rules',R.key(24),c=>{
   for(let j=0;j<18;j++){
    const pts=[];
    for(let k=0;k<=16;k++){
     const v=k/16,z=(j+v)*(OUTLINE.length-1)/18,n=Math.min(OUTLINE.length-2,Math.floor(z));
     const a=OUTLINE[n],b=OUTLINE[n+1],f=z-n;
     const gatherScale=lerp(1,form,prog(t,14.3,14.7));
     const ox=ex+(890+(lerp(a[0],b[0],f)-255)*1.38-912.632)*gatherScale,oy=ey+(460+(lerp(a[1],b[1],f)-260)*1.38-424.258)*gatherScale;
     const gx=j<11?220+1540*v:SHEET.xs[j-11],gy=j<11?372+j*55:330+592*v;
     const dx=gx-1690,dy=gy-674.5;
     const spin=Math.sin(bend*Math.PI)*2.5*(1-Math.min(1,Math.hypot(dx,dy)/2000));
     const wx=ex+dx*Math.cos(spin)-dy*Math.sin(spin),wy=ey+dx*Math.sin(spin)+dy*Math.cos(spin);
     pts.push([lerp(wx,ox,bend),lerp(wy,oy,bend),.6+Math.sin(v*Math.PI)*.4]);
    }
    c.strokePath(pts,'dry',mixHex('#b1bdb4',C.white,bend),Math.max(.02,(.22+Math.sin(bend*Math.PI)*.6)*(1-form)),.2);
   }
  },{w:1920,h:1080});
  R.layer(L);
 }
 if(form>0){
  // White strokes broaden into painted logo planes, anchored on the same eye.
  R.with(M.place(ex,ey,form,0,912.632,424.258),()=>drawLeo(R,A,{x:890,y:460,scale:1.38,showEye:false}));
 }
 if(t>=7.5&&form<1){const born=prog(t,7.5,7.62),blink=blinkAt(t,[8.125,9.688]);R.layer(A.eye,M.place(ex,ey,lerp(.56,1.38,form)*born,0,32,32,lerp(.56,1.38,form)*born*Math.max(.06,1-blink)));}
 drawCaptions(R,t,A);
}
export function drawAppTime(R,t,A){
 if(t>=49.94){drawLedger(R,A.ledger,0);return;}
 const fold=prog(t,48.7,49.5),unroll=prog(t,49.5,49.94);
 const gatherX=960,gatherY=540;
 if(fold<1){
  const lp=pose(t);R.with(M.place(lerp(lp.x,gatherX,fold),lerp(lp.y,gatherY,fold),1-fold,0,lp.x,lp.y),()=>drawLeo(R,A,lp));
  A.parts.forEach((q,i)=>{
   const u=prog(t,30+i*1.25,30+i*1.25+.65);
   const [tx,ty]=PART_POS[i];
   const cx=lerp(FLOAT[i][0],tx+q.w/2,u),cy=lerp(FLOAT[i][1],ty+q.h/2,u);
   const x=lerp(cx,gatherX,fold),y=lerp(cy,gatherY,fold);
   const w=lerp(220,q.w,u)*(1-fold)+220*fold,h=lerp(56,q.h,u)*(1-fold)+56*fold;
   // Source cell and app card are opposite faces of one unfolding surface.
   const turn=Math.abs(2*u-1);
   if(fold>0){
    if(i===0){
     const face=Math.abs(1-2*fold);
     if(fold<.5)drawPart(R,q,x-w/2,y-h*face/2,w/q.w,h/q.h*face);
     else R.with(M.place(x,y,w/1600,0,960,537,h/850*face),()=>drawLedger(R,A.ledger,0));
    }else{
     const tuck=1-prog(fold,0,.85);
     if(tuck>0)drawPart(R,q,x-w*tuck/2,y-h*tuck/2,w/q.w*tuck,h/q.h*tuck);
    }
   }else if(u<.5){R.with(M.place(x,y,1,0,110,28,turn),()=>{R.layer(A.cell);put(R,A.cellLabels[i],17,11);});}
   else drawPart(R,q,x-w/2,y-h*turn/2,w/q.w,h/q.h*turn);
  });
  drawCaptions(R,t,A);
  const cap=prog(t,45,45.85);if(cap>0)R.layer(A.caption,M.place(lerp(157,gatherX,fold),lerp(865,gatherY,fold),1-fold,0,0,0,cap*(1-fold)));
 }else{
  // A single carried cell unrolls into the exact opening sheet; no dissolve.
  const sx=lerp(220/1600,1,unroll),sy=lerp(56/850,1,unroll);
  R.with(M.place(960,lerp(540,537,unroll),sx,0,960,537,sy),()=>drawLedger(R,A.ledger,0));
 }
}
