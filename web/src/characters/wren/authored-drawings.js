// Complete vector drawings. These are authored contours, not sprite parts or an
// anatomical solver. Every key drawing is expanded to explicit canvas paths;
// the in-betweens interpolate corresponding contour points, with drawn accents.
export const W = 800, H = 900, FPS = 12, DURATION = 4;
const PATHS = [];
const add = (name, group, d, fill, stroke = '#344451', width = 2.2, opacity = 1) =>
  PATHS.push({ name, group, d, fill, stroke, width, opacity });

// Back scarf and hair: their curves are designed independently of the torso.
add('scarf-low','scarf','M 340 352 C 303 347 260 363 220 358 C 186 354 160 348 133 353 L 130 365 C 167 370 189 371 219 377 C 257 384 305 372 343 373 Z','url(#goldLow)','#a47d32',1.4);
add('scarf-high','scarf','M 336 346 C 296 338 259 326 220 328 C 181 330 158 318 134 313 L 128 326 C 157 339 184 345 218 342 C 266 340 294 361 333 363 Z','url(#gold)','#b58b3d',1.4);
add('scarf-thread1','scarf','M 147 319 C 176 333 194 335 219 334 M 150 358 C 181 363 197 368 220 371','none','#f4d185',1.5,0.7);
add('fringe1','scarf','M 132 314 L 123 323 M 135 317 L 127 326 M 139 318 L 133 328 M 131 355 L 123 367 M 136 356 L 132 369','none','#d1a753',1.8);

// Far leg and boot. Feet are fixed in all drawings; the trouser contours bend.
add('far-leg','farLeg','M 307 590 C 325 592 342 617 354 646 C 366 669 371 687 355 707 C 339 729 319 763 303 811 L 280 809 C 291 761 306 724 323 698 C 331 684 316 661 298 638 C 286 620 286 601 307 590 Z','url(#tightsFar)','#634b3f',1.8);
add('far-boot','farBoot','M 278 800 C 288 805 302 805 313 800 L 312 820 C 324 825 339 827 345 837 Q 347 846 340 850 L 264 850 Q 257 845 263 833 L 269 807 Q 271 801 278 800 Z','url(#boot)','#574636',2.1);
add('far-sole','farBoot','M 263 845 Q 286 848 312 846 Q 329 847 342 846','none','#4e4134',2.5);
add('far-cuff','farBoot','M 274 803 Q 292 813 311 803','none','#b3986a',2.6);

// Far sleeve is a continuous drawn contour, with a cuff and overlapping fingers.
add('far-sleeve','farArm','M 401 383 C 425 376 437 387 449 410 C 462 431 477 421 493 405 L 529 369 Q 542 365 550 378 C 536 397 520 417 502 435 C 482 453 459 461 444 448 C 430 434 418 420 410 404 Z','url(#coatShade)','#526a7d',1.9);
add('far-hand','farHand','M 539 371 L 551 360 Q 559 354 567 353 Q 577 347 582 353 L 585 358 Q 588 365 583 372 L 566 383 Q 556 388 547 380 Z','url(#skinShade)','#aa8068',1.3);

// Near leg. Its knee is drawn as one continuous bend, without a joint seam.
add('near-leg','nearLeg','M 407 592 C 428 590 439 611 446 633 L 474 686 Q 485 705 474 725 C 461 746 448 774 438 814 L 413 813 C 419 775 430 747 442 722 Q 450 707 438 692 L 400 641 C 391 619 388 600 407 592 Z','url(#tights)','#685142',1.8);
add('knee-fold','nearLeg','M 450 697 Q 465 703 474 703 M 423 761 Q 430 770 441 773','none','#705443',1.4,0.7);
add('near-boot','nearBoot','M 411 801 Q 425 808 441 802 L 441 824 Q 455 829 477 831 Q 491 833 493 843 Q 493 850 485 853 L 402 853 Q 394 851 398 837 L 404 809 Q 406 803 411 801 Z','url(#boot)','#574636',2.1);
add('near-cuff','nearBoot','M 409 804 Q 425 812 441 805','none','#baa071',2.7);
add('near-sole','nearBoot','M 399 848 Q 426 851 446 849 Q 469 852 490 847','none','#514335',2.7);
add('boot-stitch','nearBoot','M 435 823 Q 440 836 438 844 M 449 838 Q 466 837 478 840','none','#c0a070',1.2,0.5);

// Entire coat, with flared hem, collar, compressed folds and a painted pocket.
add('coat','coat','M 340 348 C 363 338 392 342 414 361 C 432 376 435 399 436 421 C 438 467 440 519 459 589 Q 465 608 448 616 C 407 635 329 638 281 616 Q 268 611 276 596 C 294 544 308 506 309 459 C 309 420 310 384 323 363 Q 329 354 340 348 Z','url(#coat)','#526c7f',2.4);
add('coat-shadow','coat','M 388 361 C 404 386 411 415 413 454 C 415 505 423 561 439 615 Q 453 612 458 605 C 438 535 438 474 436 422 C 435 394 427 373 414 361 Q 401 348 388 347 Z','url(#coatShade)','none',0,0.6);
add('coat-light','coat','M 329 382 C 321 425 324 467 316 505 C 309 544 291 581 289 606 C 298 613 309 615 319 616 C 318 578 332 544 338 505 C 344 457 333 419 342 381 Z','url(#coatLight)','none',0,0.32);
add('coat-seam','coat','M 390 380 C 389 429 393 480 404 536 Q 412 580 423 620','none','#64839a',1.8,0.75);
add('pocket','coat','M 358 513 Q 379 510 401 513 L 405 558 Q 405 573 386 579 Q 369 583 360 573 Z','url(#coatPocket)','#58778b',1.7);
add('pocket-rim','coat','M 359 516 Q 379 513 401 516','none','#aec2cd',1.2,0.8);
add('hem','coat','M 282 609 Q 322 626 371 626 Q 418 628 451 612','none','#718fa2',2.1,0.7);
add('fold1','coat','M 311 516 Q 320 543 309 569 M 324 577 Q 329 591 343 598 M 408 478 Q 420 493 417 508','none','#58778d',1.6,0.8);
add('buttons','coat','M 395 427 L 398 429 M 399 470 L 402 472 M 407 520 L 410 522','none','#435967',4,0.9);

// Neck, face and ear: detailed contours, not a procedural ellipse head.
add('neck','head','M 390 307 C 397 319 397 330 391 337 Q 412 348 429 337 L 420 314 Z','url(#skin)','#a7826d',1.4);
add('face','head','M 373 208 C 400 196 429 209 439 230 C 444 243 447 254 448 266 Q 451 273 459 276 Q 465 280 458 284 L 450 287 Q 450 297 454 303 Q 456 307 450 310 C 449 322 438 331 422 333 C 408 333 395 326 385 315 C 370 299 360 276 361 249 Q 361 224 373 208 Z','url(#skin)','#8e6857',1.6);
add('cheek','head','M 431 284 C 445 284 449 291 447 299 C 445 307 432 310 425 302 C 420 293 423 287 431 284 Z','#d8997f','none',0,0.25);
add('nose-light','head','M 448 266 Q 451 275 459 277','none','#fae5cb',1.8,0.8);
add('ear','head','M 377 271 C 386 265 395 272 395 284 C 395 296 388 302 381 298 C 373 294 372 280 377 271 Z','url(#skin)','#aa7d65',1.4);
add('ear-inner','head','M 380 279 Q 390 276 388 289 Q 382 286 383 293','none','#b6836a',1.5);
add('eye-white','head','M 429 258 Q 438 250 445 257 Q 444 267 431 266 Z','#faf0dd','#7e604f',1.2);
add('iris','head','M 440 255 C 443 255 444 258 443 263 Q 442 267 439 265 Q 437 260 440 255 Z','#513c2d','none',0);
add('eye-glint','head','M 441 256 L 441 258','none','#fff9e9',1.7);
add('upper-lid','head','M 428 257 Q 437 249 445 256','none','#5f4636',2.1);
add('brow','head','M 426 245 Q 435 239 442 242','none','#70503a',2.5);
add('mouth','head','M 440 309 Q 447 308 451 306','none','#a7655b',1.5);
add('lower-lip','head','M 444 312 Q 448 312 450 310','none','#f4ceb5',1.2);

// Hair wraps the skull and leaves the face visible; ponytail has drawn strands.
add('hair','head','M 378 282 C 365 269 360 255 360 240 C 385 246 399 234 407 212 Q 420 236 441 246 C 443 223 435 199 417 185 C 395 168 366 168 341 180 C 319 191 308 217 311 242 C 309 267 325 293 347 303 C 359 308 372 302 381 296 Z','url(#hair)','#594333',1.9);
add('hair-sheen','head','M 326 213 C 349 190 382 185 407 198 C 385 184 350 190 332 205 Z','#b18c60','none',0,0.28);
add('ponytail','pony','M 321 251 C 304 239 280 247 269 262 C 255 278 241 285 231 284 C 247 302 272 307 293 300 Q 318 291 327 269 Z','url(#hair)','#5b4434',1.8);
add('pony-strands','pony','M 308 259 Q 280 258 264 281 M 313 267 Q 290 286 259 292 M 278 295 Q 298 290 314 277','none','#98734d',1.3,0.7);
add('hair-strands','head','M 325 226 Q 337 198 366 189 M 337 238 Q 350 202 382 195 M 350 245 Q 367 215 393 205 M 320 255 Q 328 281 349 290','none','#99764e',1.35,0.65);
add('hair-tie','pony','M 315 251 Q 323 257 321 270','none','#7c9ca7',4.2);

add('collar-back','collar','M 335 338 Q 357 344 378 346 Q 411 345 427 360 Q 433 376 417 383 C 393 389 359 380 341 370 Q 327 355 335 338 Z','url(#gold)','#b28a3d',1.6);
add('collar-front','collar','M 346 355 Q 370 362 400 358 Q 419 356 425 367 Q 430 379 416 387 C 393 394 370 386 350 376 Q 338 365 346 355 Z','url(#gold)','#b68f41',1.6);
add('collar-thread','collar','M 350 361 Q 375 371 400 366 M 355 375 Q 379 386 410 382','none','#f1d694',1.4,0.8);

// Near sleeve: one flowing outline from shoulder through bent elbow to cuff.
add('near-sleeve','arm','M 408 375 C 426 366 442 377 449 394 C 456 413 469 436 479 429 C 496 418 512 393 531 366 Q 542 363 552 376 C 536 409 521 431 501 449 C 486 463 467 468 453 454 C 438 442 426 421 420 407 C 412 395 399 389 408 375 Z','url(#sleeve)','#526d80',2.1);
add('sleeve-light','arm','M 421 381 C 436 382 443 399 450 417 Q 457 437 468 443 Q 451 438 440 418 Q 429 397 420 391 Z','url(#coatLight)','none',0,0.45);
add('elbow-fold','arm','M 464 443 Q 480 441 492 431 M 475 451 Q 489 445 498 438','none','#6c8ba1',1.5,0.75);
add('cuff','arm','M 529 369 Q 540 369 550 379 L 555 369 Q 544 358 535 359 Z','url(#coatShade)','#617b8e',1.5);
add('hand','hand','M 546 366 Q 552 361 556 355 L 559 346 Q 563 340 567 342 Q 574 335 579 339 Q 584 336 588 341 Q 594 341 594 347 L 592 353 Q 598 357 594 361 L 585 368 Q 576 380 566 377 Q 557 375 551 375 Z','url(#skin)','#aa7f65',1.3);
add('thumb','hand','M 557 359 Q 565 354 575 356 Q 580 358 575 363 L 567 366','none','#b5846a',1.5);
add('fingers','hand','M 570 344 Q 576 349 583 350 M 578 340 Q 584 347 590 347 M 580 360 L 589 355 M 578 366 L 585 361','none','#ba8d72',1.05);
add('knuckle-light','hand','M 567 343 L 569 344 M 577 340 L 579 341','none','#f6dfbf',1.6,0.75);

const KEYS = [
  // Drawing offsets plus local contour edits. These are design decisions, not IK.
  { id:'hold',at:0,head:[0,0],pony:[0,0],coat:[0,0],arm:[0,0],hand:[0,0],farArm:[0,0],farHand:[0,0],scarf:[0,0],knee:0,hem:0,fold:0,brow:0 },
  { id:'notice',at:7/12,head:[3,-4],pony:[2,-2],coat:[0,0],arm:[2,-2],hand:[3,-4],farArm:[2,-2],farHand:[3,-4],scarf:[1,-1],knee:0,hem:0,fold:0,brow:-3 },
  { id:'anticipate',at:1,head:[8,0],pony:[5,-2],coat:[9,7],arm:[12,2],hand:[19,-8],farArm:[11,3],farHand:[17,-6],scarf:[5,2],knee:10,hem:5,fold:4,brow:-1 },
  { id:'pull',at:17/12,head:[-13,13],pony:[-6,8],coat:[-23,21],arm:[-27,12],hand:[-34,19],farArm:[-25,11],farHand:[-32,18],scarf:[-8,-5],knee:32,hem:-12,fold:16,brow:1 },
  { id:'catch',at:20/12,head:[-20,18],pony:[-23,6],coat:[-27,23],arm:[-32,16],hand:[-39,22],farArm:[-29,15],farHand:[-36,21],scarf:[-17,-15],knee:36,hem:-18,fold:20,brow:3 },
  { id:'release',at:28/12,head:[-11,10],pony:[-18,14],coat:[-13,11],arm:[-13,7],hand:[-17,10],farArm:[-12,7],farHand:[-15,9],scarf:[-18,8],knee:16,hem:8,fold:7,brow:-1 },
  { id:'settle',at:38/12,head:[1,-2],pony:[4,1],coat:[1,-1],arm:[1,-1],hand:[2,-1],farArm:[1,-1],farHand:[2,-1],scarf:[4,-2],knee:0,hem:2,fold:0,brow:-1 },
  { id:'hold-end',at:4,head:[0,0],pony:[0,0],coat:[0,0],arm:[0,0],hand:[0,0],farArm:[0,0],farHand:[0,0],scarf:[0,0],knee:0,hem:0,fold:0,brow:0 },
];
export const KEY_DRAWINGS = KEYS;
const tokens = d => d.match(/[MLCQZ]|-?\d+(?:\.\d+)?/g);
const parsed = PATHS.map(p=>({...p,tokens:tokens(p.d)}));
function expand(path,key) {
  const values=[];
  for(let i=0;i<path.tokens.length;i++) {
    const token=path.tokens[i];if(/[A-Z]/.test(token)){values.push(token);continue;}
    const x=Number(token),y=Number(path.tokens[++i]);
    let dx=0,dy=0;
    const shift=key[path.group];if(shift){dx=shift[0];dy=shift[1];}
    let px=x,py=y;
    if(path.group==='head'||path.group==='pony') {
      if(path.name!=='neck'&&path.group==='head'&&py>265)py=265+(py-265)*0.55;
      if(path.name==='neck'&&py<323)py-=18;
      if(['eye-white','iris','eye-glint','upper-lid'].includes(path.name)) {
        const eyeOpen=key.id==='pull'?0.75:key.id==='catch'?0.5:1;
        px=437+(px-437)*1.45;py=258+(py-258)*1.40*eyeOpen;
      }
      px=379+(px-379)*1.20;py=245+(py-245)*1.20+18;
    }
    if(path.group==='collar') {
      dx=key.head[0]*0.8+key.coat[0]*0.2;dy=key.coat[1];
    }
    if(path.group==='coat') {
      const u=Math.max(0,Math.min(1,(y-400)/230));
      dx+=key.hem*u*(x<355?-0.65:0.8)+key.fold*(u-0.5)*1.4;
      dy-=key.fold*u*(x<370?0.32:0.12);
    }
    if(path.group==='arm'||path.group==='farArm') {
      const u=Math.max(0,Math.min(1,(x-415)/140));
      const hand=key[path.group==='arm'?'hand':'farHand'];
      dx=dx*(1-u)+hand[0]*u;dy=dy*(1-u)+hand[1]*u;
      // Re-drawn elbow curvature carries the forearm closer to the torso.
      const bend=Math.exp(-(((x-476)/31)**2));
      dx-=key.fold*0.65*bend;dy+=key.fold*0.38*bend;
    }
    if(path.group==='farLeg'||path.group==='nearLeg') {
      const u=Math.max(0,Math.min(1,(y-610)/200));
      const weight=Math.sin(Math.PI*u);
      dx+=(path.group==='nearLeg'?0.72:0.48)*key.knee*weight;
      dy+=key.knee*0.65*weight;
      const hip=Math.max(0,1-(y-605)/105);
      dx+=key.coat[0]*hip;dy+=key.coat[1]*hip;
    }
    if(path.group==='scarf') {
      const u=Math.max(0,(335-x)/210);
      dy+=(key.pony[1]-key.head[1])*u*0.75;
      dx+=key.coat[0]*(1-u)*0.22;
    }
    if(path.name==='brow')dy+=key.brow;
    if(path.name==='mouth')dy+=key.brow*0.2;
    values.push(px+dx,py+dy);
  }
  return values;
}
const expanded=KEYS.map(key=>parsed.map(path=>({...path,values:expand(path,key)})));
export function drawingAt(t) {
  const time=Math.max(0,Math.min(DURATION,t));
  let i=KEYS.findIndex((key,j)=>j<KEYS.length-1&&time>=key.at&&time<KEYS[j+1].at);
  if(i<0)i=KEYS.length-2;
  const u=(time-KEYS[i].at)/(KEYS[i+1].at-KEYS[i].at);
  // Authored spacing: pull is quick; catch and release have softer ease.
  const k=i===2?1-(1-u)**2:u*u*(3-2*u);
  const paths=expanded[i].map((path,j)=>({...path,d:path.values.map((v,n)=>typeof v==='number'?(v+(expanded[i+1][j].values[n]-v)*k).toFixed(2):v).join(' ')}));
  const grip=[589+KEYS[i].hand[0]+(KEYS[i+1].hand[0]-KEYS[i].hand[0])*k,
    346+KEYS[i].hand[1]+(KEYS[i+1].hand[1]-KEYS[i].hand[1])*k];
  return {paths,grip,key:KEYS[i].id};
}
const DEFINITIONS=`
<linearGradient id="coat" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#89a9bd"/><stop offset=".45" stop-color="#7d9db2"/><stop offset="1" stop-color="#5b7c94"/></linearGradient>
<linearGradient id="coatShade"><stop stop-color="#708da2"/><stop offset="1" stop-color="#46657e"/></linearGradient>
<linearGradient id="coatLight"><stop stop-color="#c6d4da"/><stop offset="1" stop-color="#a6bac7" stop-opacity=".25"/></linearGradient>
<linearGradient id="coatPocket"><stop stop-color="#82a0b3"/><stop offset="1" stop-color="#66869b"/></linearGradient>
<linearGradient id="sleeve" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9eb9c8"/><stop offset=".55" stop-color="#83a1b6"/><stop offset="1" stop-color="#587a94"/></linearGradient>
<linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8e6cc"/><stop offset=".65" stop-color="#ebc9a8"/><stop offset="1" stop-color="#d9ae8d"/></linearGradient>
<linearGradient id="skinShade"><stop stop-color="#e0bb99"/><stop offset="1" stop-color="#c49b7f"/></linearGradient>
<linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8c6a47"/><stop offset=".6" stop-color="#745537"/><stop offset="1" stop-color="#5c4330"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ecd193"/><stop offset=".5" stop-color="#e1bc6d"/><stop offset="1" stop-color="#ca9c48"/></linearGradient>
<linearGradient id="goldLow"><stop stop-color="#d8b164"/><stop offset="1" stop-color="#b48a40"/></linearGradient>
<linearGradient id="tights"><stop stop-color="#937055"/><stop offset="1" stop-color="#75533e"/></linearGradient>
<linearGradient id="tightsFar"><stop stop-color="#7c5e4b"/><stop offset="1" stop-color="#624a3c"/></linearGradient>
<linearGradient id="boot" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b49b71"/><stop offset="1" stop-color="#89724f"/></linearGradient>
<filter id="pigment" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency=".19" numOctaves="3" seed="41" result="grain"/>
 <feColorMatrix in="grain" type="saturate" values="0" result="gray"/>
 <feComponentTransfer in="gray" result="faint"><feFuncA type="linear" slope=".15"/></feComponentTransfer>
 <feComposite in="faint" in2="SourceGraphic" operator="in" result="texture"/>
 <feBlend in="SourceGraphic" in2="texture" mode="soft-light"/>
</filter>`;
export function svgAt(t,{debug=false}={}) {
  const drawing=drawingAt(t);
  const paths=drawing.paths.map(p=>`<path d="${p.d}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.width}" opacity="${p.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n');
  // Collar is drawn after the neck and before the sleeve, with matching complete-frame contours.
  const y=drawing.grip[1];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFINITIONS}</defs><g filter="url(#pigment)">${paths}</g>${debug?`<circle cx="${drawing.grip[0]}" cy="${y}" r="3" fill="red"/>`:''}</svg>`;
}
