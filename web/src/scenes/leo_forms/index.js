import { C, drawNight, post, paintFilm, drawForms } from '../leo_lib/leo.js';
export const scene={id:'leo_forms',bg:C.night,post,paint:paintFilm,draw(R,t,A){drawNight(R,A);drawForms(R,t+15,A);}};
