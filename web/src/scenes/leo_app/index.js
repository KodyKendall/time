import { C, drawNight, post, paintFilm, drawAppTime } from '../leo_lib/leo.js';
export const scene={id:'leo_app',bg:C.night,post,paint:paintFilm,draw(R,t,A){drawNight(R,A);drawAppTime(R,t+30,A);}};
