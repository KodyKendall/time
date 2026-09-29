import { C, drawNight, post, paintFilm, drawSheet } from '../leo_lib/leo.js';
export const scene={id:'leo_sheet',bg:C.night,post,paint:paintFilm,draw(R,t,A){drawNight(R,A);drawSheet(R,t,A);}};
