// TIME — sound design, synced to picture cues (film seconds). Procedural events ('sfx') and library
// samples ('sample'); big hits live on the 'sfxBig' bus which gently ducks the music bus.
export function sfxTracks(S) {
  // categories -> separate stems (each normalised by the mixer, then set by the track gain below)
  const cat = { rise: [], boom: [], whoosh: [], sparkle: [], amb: [], detail: [] };
  const fx = cat.rise, big = cat.boom, amb = cat.amb;
  const E = (arr, t, f, params = {}, gain = 0, pan = 0) => {
    const target = arr === fx ? (f === 'whoosh' ? cat.whoosh : f === 'shimmer' ? cat.sparkle : f === 'rumble' ? cat.amb : cat.rise) : arr;
    target.push({ t, fx: f, params: { seed: Math.round(t * 1000), ...params }, gain, pan });
  };
  const smp = [];
  const P = (t, src, o = {}) => smp.push({ t, src, gain: o.gain ?? 0, pan: o.pan ?? 0, rate: o.rate ?? 1, dur: o.dur, fadeIn: o.fadeIn ?? 0.01, fadeOut: o.fadeOut ?? 0.3, loop: o.loop, reverse: o.reverse, offset: o.offset ?? 0, cat: o.cat ?? 'detail' });

  // ---------------------------------------------------------------- COSMOS 0–30
  E(fx, 0.35, 'riser', { dur: 2.15, from: 50, to: 900, noise: 0.7, voices: 4, detune: 25, pulse: 0.1 }, -6);
  E(fx, 0.0, 'rumble', { dur: 2.6, cutoff: 70, grit: 0.2 }, -8);
  P(1.1, 'whoosh_slow_02', { gain: -6, reverse: true, dur: 1.4, fadeIn: 0.6, cat: 'whoosh' }); // inhale into the bang
  E(big, 2.5, 'explosion', { dur: 5, debris: 0.6, space: 0.7 }, -4);
  E(big, 2.5, 'impact', { dur: 4, subHz: 42, drop: 0.6, noise: 0.5, tail: 1.4, click: 0.9, space: 0.6 }, -3);
  E(fx, 2.6, 'shimmer', { dur: 3.5, root: 1320, sparkle: 0.9, space: 0.6 }, -16, 0.2);
  E(fx, 2.7, 'rumble', { dur: 5, cutoff: 90, grit: 0.4 }, -16);
  P(4.3, 'whoosh_slow_01', { gain: -4, pan: -0.4, dur: 2.2, fadeOut: 0.6, cat: 'whoosh' }); // rays curl
  E(fx, 4.6, 'whoosh', { dur: 1.6, from: 180, to: 2400, panFrom: 0.7, panTo: -0.7, air: 0.6, tone: 0.2 }, -16);
  E(fx, 6.2, 'shimmer', { dur: 2.6, root: 1175, sparkle: 0.5, space: 0.5 }, -18, -0.1); // the atom forms
  // the two electrons fly off (9.05, 9.45)
  E(fx, 9.0, 'whoosh', { dur: 0.9, from: 400, to: 5200, panFrom: 0, panTo: 0.8, air: 0.7 }, -15);
  E(fx, 9.4, 'whoosh', { dur: 1.0, from: 350, to: 4800, panFrom: 0, panTo: -0.8, air: 0.7 }, -14);
  // 10.0 the first star ignites
  E(big, 9.98, 'impact', { dur: 3, subHz: 60, drop: 0.3, noise: 0.35, tail: 1.1, click: 0.4, space: 0.7 }, -9);
  E(fx, 10.0, 'shimmer', { dur: 3.2, root: 1568, sparkle: 0.8, space: 0.6 }, -15);
  // nebula star ignitions
  for (const [t, pan] of [[11.25, -0.3], [12.5, 0.35], [13.125, 0.1], [13.75, -0.5]]) P(t - 0.02, 'chime_glass_01', { gain: -4, pan, fadeOut: 1, cat: 'sparkle' });
  // gravity twirls the nebula (15–20): a slow swirling wind
  P(14.8, 'wind_synth_loop_01', { gain: 0, dur: 6.2, fadeIn: 2, fadeOut: 2.2, cat: 'amb' });
  E(fx, 15.2, 'whoosh', { dur: 4.6, from: 120, to: 1800, panFrom: -0.8, panTo: 0.8, air: 0.4, tone: 0.5 }, -20);
  // the galaxy is complete (20.0) and turns: soft glints as new stars flare in the arms
  E(fx, 19.95, 'shimmer', { dur: 3.5, root: 1397, sparkle: 0.6, space: 0.7 }, -15);
  for (const [t, pan] of [[20.7, 0.4], [21.9, -0.3], [23.0, 0.2], [24.2, -0.5], [25.3, 0.35], [26.4, -0.1]]) P(t, 'chime_glass_01', { gain: -10, pan, fadeOut: 1, cat: 'sparkle', rate: 1.25 });
  // the dive (27.5–30) and the soft landing on the star
  E(fx, 27.5, 'riser', { dur: 2.5, from: 180, to: 2600, noise: 0.55, voices: 5, detune: 20 }, -16);
  P(27.8, 'whoosh_air_01', { gain: -2, dur: 2.2, fadeOut: 0.4, cat: 'whoosh' });
  E(fx, 29.95, 'shimmer', { dur: 3.5, root: 1047, sparkle: 0.4, space: 0.7 }, -17);

  // ---------------------------------------------------------------- EARTH 30–52.5
  E(fx, 30.2, 'rumble', { dur: 6, cutoff: 160, grit: 0.55 }, -10);                  // the young Sun roars
  P(32.0, 'whoosh_slow_02', { gain: -8, dur: 3, fadeIn: 0.8, fadeOut: 1, pan: 0.3, cat: 'whoosh' }); // disk swirls
  for (const t of [35.6, 36.4, 37.0, 37.5, 38.3]) P(t, 'rock_impact_01', { gain: -14 - (t - 35) * 2, rate: 1.3, pan: (t % 1) - 0.5, cat: 'detail' });
  E(big, 37.5, 'impact', { dur: 2.5, subHz: 58, drop: 0.3, noise: 0.4, tail: 0.8, click: 0.5, space: 0.5 }, -10);
  // meteor strikes (38.75, 39.375) and the big impact (40.0), then the plunge toward the planet (40.6)
  for (const [t, s, g] of [[38.75, 'explosion_distant_01', -7], [39.375, 'explosion_distant_02', -6], [40.0, 'boom_low_01', -2]]) P(t - 0.02, s, { gain: g, cat: 'boom' });
  E(big, 40.0, 'impact', { dur: 3, subHz: 46, drop: 0.5, noise: 0.5, tail: 1.2, click: 0.6, space: 0.6 }, -8);
  P(40.35, 'whoosh_air_01', { gain: -8, dur: 1.6, fadeOut: 0.4, cat: 'whoosh' });
  P(39.5, 'fire_wildfire_loop_02', { gain: -8, dur: 4.5, fadeIn: 0.6, fadeOut: 1.5, cat: 'amb' }); // lava
  P(41.5, 'steam_hiss_01', { gain: -8, pan: -0.2, cat: 'detail' });
  // lightning (41.875, 42.5, 43.125)
  for (const [t, s, g, pan] of [[41.875, 'thunder_short_01', -8, -0.4], [42.5, 'thunder_02', -6, 0.2], [43.125, 'thunder_01', -9, 0.5]]) P(t - 0.03, s, { gain: g, pan, cat: 'amb' });
  P(42.0, 'rain_loop_01', { gain: -10, dur: 4.5, fadeIn: 1, fadeOut: 1.5, cat: 'amb' });
  P(43.8, 'ocean_waves_loop_01', { gain: -6, dur: 6.4, fadeIn: 1.2, fadeOut: 0.4, cat: 'amb' });
  E(fx, 45.0, 'shimmer', { dur: 3, root: 988, sparkle: 0.35, space: 0.7 }, -18);      // moonrise
  P(47.5, 'wind_soft_loop_01', { gain: -12, dur: 3, fadeIn: 1, fadeOut: 0.5, cat: 'amb' });
  P(49.3, 'ocean_wave_crash_01', { gain: -2, cat: 'boom' });                           // the lip lands (49.375)
  P(50.0, 'splash_big_01', { gain: -4, cat: 'boom' });
  P(50.2, 'bubbles_underwater_loop_01', { gain: -8, dur: 4.5, fadeIn: 0.3, fadeOut: 1.2, cat: 'amb' });
  P(50.4, 'bubbles_rise_01', { gain: -8, cat: 'detail' });
  // ---------------------------------------------------------------- SEA 52.5–70
  for (const t of [55.0, 56.25, 56.875, 57.5]) { P(t, 'bubble_pop_01', { gain: -6, pan: (t % 2) - 1, cat: 'detail' }); E(fx, t, 'blip', { freq: 880 + (t - 55) * 300, len: 0.05 }, -20); }
  P(52.6, 'bubbles_underwater_loop_01', { gain: -12, dur: 12.4, fadeIn: 0.5, fadeOut: 1, cat: 'amb' });
  E(fx, 59.8, 'whoosh', { dur: 0.8, from: 300, to: 3000, panFrom: -0.5, panTo: 0.6, air: 0.3 }, -16); // fish darts off
  P(59.98, 'bubbles_rise_01', { gain: -9, pan: -0.2, cat: 'detail' });                   // bubble burst
  P(64.6, 'ocean_shore_loop_01', { gain: -9, dur: 5.4, fadeIn: 0.8, fadeOut: 0.6, cat: 'amb' });
  for (const t of [66.25, 67.5]) P(t, 'splash_small_01', { gain: -8, pan: 0.2, cat: 'detail' });
  E(fx, 67.5, 'footstep', { surface: 'dirt', weight: 0.4, steps: 3, interval: 0.625 }, -18);
  P(69.7, 'heartbeat_single_01', { gain: -8, cat: 'detail' });                        // into the eye
  // ---------------------------------------------------------------- LAND 70–85
  P(70.0, 'nature_jungle_loop_01', { gain: -9, dur: 8, fadeIn: 0.5, fadeOut: 1.5, cat: 'amb' });
  // footfalls on every beat (73.125 … 76.25): heavy on the half notes, lighter in between
  for (const t of [73.75, 75.0, 76.25]) P(t - 0.02, `thud_giant_0${1 + (Math.round(t) % 3)}`, { gain: -3, cat: 'boom' });
  for (const t of [73.125, 74.375, 75.625]) P(t - 0.02, 'thud_giant_02', { gain: -11, rate: 1.1, cat: 'detail' });
  P(74.25, 'creature_roar_02', { gain: -15, rate: 1.7, pan: 0.55, cat: 'detail' }); // a pterosaur cries overhead
  for (const [t, pan] of [[76.62, 0.5], [76.78, 0.35], [76.9, 0.6], [77.05, 0.4]]) P(t, 'thud_giant_03', { gain: -16, rate: 1.9, pan, cat: 'detail' }); // the herd bolts
  E(fx, 76.2, 'riser', { dur: 1.3, from: 400, to: 3500, noise: 0.7, voices: 3 }, -12);
  E(fx, 76.4, 'whoosh', { dur: 1.1, from: 5000, to: 400, panFrom: 0.8, panTo: -0.2, air: 0.8 }, -10);  // meteor streak
  P(77.5, 'explosion_big_01', { gain: 0, cat: 'boom' });
  E(big, 77.5, 'impact', { dur: 5, subHz: 38, drop: 0.7, noise: 0.9, tail: 1.6, click: 1, space: 0.8 }, -2);
  E(fx, 78.6, 'whoosh', { dur: 1.6, from: 200, to: 2600, panFrom: 0.6, panTo: -0.8, air: 0.9, tone: 0.1 }, -8);  // shockwave
  P(78.8, 'wind_storm_interior_loop_01', { gain: -8, dur: 4, fadeIn: 0.3, fadeOut: 1.5, cat: 'amb' });
  P(79.6, 'fire_wildfire_loop_01', { gain: -6, dur: 5.6, fadeIn: 0.8, fadeOut: 2, cat: 'amb' });
  P(79.9, 'fire_roar_loop_01', { gain: -7, dur: 3.2, fadeIn: 0.15, fadeOut: 1.6, cat: 'amb' });    // the fire roars (80.0)
  for (const [t, g] of [[81.05, -13], [81.7, -15], [82.3, -16], [82.9, -18]]) P(t, 'rock_impact_01', { gain: g, rate: 0.62, pan: -0.1, cat: 'detail' }); // the carcass crumbles
  E(fx, 78.9, 'rumble', { dur: 6, cutoff: 80, grit: 0.4 }, -12);
  // ---------------------------------------------------------------- ANCESTORS 85–97.5
  P(82.5, 'wind_soft_loop_01', { gain: -10, dur: 7.5, fadeIn: 1.5, fadeOut: 1.5, cat: 'amb' });
  E(fx, 86.25, 'blip', { freq: 2400, len: 0.03, count: 2, interval: 0.07 }, -20);   // the mammal peeks out
  E(fx, 87.5, 'footstep', { surface: 'grass', weight: 0.15, steps: 6, interval: 0.09 }, -16); // scurry
  P(88.6, 'nature_forest_loop_01', { gain: -11, dur: 5, fadeIn: 1.5, fadeOut: 1.5, cat: 'amb' });
  E(fx, 93.7, 'whoosh', { dur: 0.9, from: 250, to: 1400, air: 0.3 }, -18);
  for (const t of [94.45, 94.75]) P(t - 0.01, 'fire_match_strike_01', { gain: -9, rate: 1.35, pan: 0.15, cat: 'detail' }); // flint strikes
  P(95.0, 'fire_ignite_01', { gain: -4, cat: 'detail' });
  P(95.2, 'fire_crackle_loop_01', { gain: -7, dur: 3.6, fadeIn: 0.2, fadeOut: 1.4, cat: 'amb' });
  E(fx, 96.25, 'shimmer', { dur: 2.5, root: 1760, sparkle: 0.7, space: 0.5 }, -16);    // sparks become stars
  // ---------------------------------------------------------------- HUNT 97.5–107.5
  P(97.5, 'wind_soft_loop_01', { gain: -12, dur: 5, fadeIn: 0.8, fadeOut: 1, cat: 'amb' });
  E(fx, 98.75, 'footstep', { surface: 'dirt', weight: 0.7, steps: 8, interval: 0.3125 }, -14);
  P(101.2, 'whoosh_02', { gain: -4, pan: 0.4, cat: 'whoosh' });                       // spear throw
  E(fx, 102.5, 'shimmer', { dur: 3, root: 1175, sparkle: 0.3, space: 0.6 }, -18);    // dawn
  P(102.8, 'nature_forest_loop_01', { gain: -12, dur: 4.7, fadeIn: 1.5, fadeOut: 1, cat: 'amb' });
  P(103.75, 'thud_heavy_01', { gain: -4, cat: 'boom' });                              // spear lands
  for (const [t, g] of [[103.85, -14], [104.0, -12], [104.13, -13], [104.3, -15]]) P(t, 'thud_giant_02', { gain: g, rate: 1.5, pan: 0.6, cat: 'detail' }); // mammoths bolt
  E(fx, 103.9, 'whoosh', { dur: 0.9, from: 110, to: 700, panFrom: -0.3, panTo: 0.5, air: 0.2, tone: 0.6 }, -14); // the first furrow rips out
  // ---------------------------------------------------------------- CITY 107.5–117.5
  P(107.6, 'crowd_murmur_loop_01', { gain: -16, dur: 3.5, fadeIn: 1, fadeOut: 1, cat: 'amb' });
  P(110.2, 'city_center_loop_01', { gain: -12, dur: 3, fadeIn: 1, fadeOut: 1, cat: 'amb' });
  P(111.0, 'steam_whistle_01', { gain: -14, pan: 0.5, cat: 'detail' });
  E(fx, 112.5, 'tick', { type: 'clock', count: 4, interval: 0.625 }, -10);
  E(fx, 115.0, 'tick', { type: 'clock', count: 4, interval: 0.3125 }, -10);
  E(fx, 116.016, 'tick', { type: 'clock', count: 3, interval: 0.078 }, -9);          // the hands whirl
  E(fx, 116.406, 'tick', { type: 'clock', count: 7, interval: 0.15625 }, -11);       // escapement as the dial opens
  P(113.75, 'clockwork_wind_01', { gain: -12, cat: 'detail' });
  P(116.25, 'machine_clunk_01', { gain: -4, cat: 'boom' });
  // ---------------------------------------------------------------- MACHINE 117.5–130
  P(117.5, 'factory_loop_01', { gain: -14, dur: 5.2, fadeIn: 0.4, fadeOut: 1, cat: 'amb' });
  for (const [t, s] of [[118.75, 'ratchet_01'], [119.375, 'ratchet_02']]) P(t - 0.01, s, { gain: -8, cat: 'detail' });
  E(fx, 119.6875, 'tick', { type: 'clock', count: 4, interval: 0.0833 }, -12);         // accelerating ticks
  for (const t of [120.625, 120.9375, 121.25]) P(t, 'data_blip_02', { gain: -14, rate: 0.8, cat: 'detail' }); // the arms seek
  P(120.8, 'steam_hiss_01', { gain: -14, pan: 0.4, rate: 0.8, cat: 'detail' });       // the old machinery winds down
  E(fx, 121.2, 'whoosh', { dur: 0.9, from: 300, to: 1800, panFrom: 0.5, panTo: -0.4, air: 0.5 }, -16); // tilt / fan
  E(fx, 122.4, 'whoosh', { dur: 1.2, from: 200, to: 2400, panFrom: -0.2, panTo: 0.2, air: 0.6 }, -15); // into the corridor
  P(119.4, 'steam_hiss_01', { gain: -12, pan: -0.4, cat: 'detail' });
  E(fx, 120.0, 'riser', { dur: 2.4, from: 120, to: 1600, noise: 0.2, voices: 3, detune: 8 }, -16); // platters spin up
  P(122.5, 'computer_data_loop_01', { gain: -14, dur: 7.5, fadeIn: 0.6, fadeOut: 1, cat: 'amb' });
  P(122.5, 'electric_hum_loop_01', { gain: -18, dur: 7.5, fadeIn: 0.6, fadeOut: 1, cat: 'amb' });
  for (const t of [123.1, 123.9, 124.6, 125.0, 125.3, 126.2, 127.0]) P(t, `data_blip_0${1 + (Math.round(t * 10) % 3)}`, { gain: -16, pan: ((t * 7) % 2) - 1, cat: 'detail' });
  P(125.0, 'computer_chatter_01', { gain: -14, cat: 'detail' });
  E(fx, 127.5, 'whoosh', { dur: 1.2, from: 150, to: 2200, panFrom: -0.3, panTo: 0.3, air: 0.4 }, -16);
  P(128.73, 'machine_clunk_01', { gain: -3, cat: 'boom' });                           // the aisle slams shut
  E(big, 128.75, 'impact', { dur: 2, subHz: 50, drop: 0.3, noise: 0.3, tail: 0.8, click: 0.8, space: 0.5 }, -10);
  // ---------------------------------------------------------------- MIND 130–145
  P(130.0, 'electric_buzz_loop_01', { gain: -20, dur: 5, fadeIn: 0.5, fadeOut: 1.5, cat: 'amb' });
  E(fx, 131.25, 'shimmer', { dur: 2.2, root: 1319, sparkle: 0.6, space: 0.5 }, -16);    // nodes lift off
  for (const t of [135.0, 136.25, 137.5]) { P(t, 'electric_zap_01', { gain: -16, cat: 'detail' }); E(fx, t, 'blip', { freq: 1568, count: 3, interval: 0.08, len: 0.04 }, -20); }
  P(138.75, 'typing_loop_01', { gain: -10, dur: 2.45, fadeIn: 0.05, fadeOut: 0.2, cat: 'detail' });
  P(141.25, 'typing_key_02', { gain: -4, cat: 'detail' });                            // play is pressed
  E(fx, 141.9, 'riser', { dur: 1.8, from: 300, to: 3000, noise: 0.6, voices: 3 }, -16);
  P(142.4, 'film_rewind_01', { gain: -16, dur: 2.4, fadeIn: 0.3, fadeOut: 1.2, cat: 'detail' }); // time rewinds → loop

  // level of each category relative to the music (stems are loudness-normalised first)
  const LEVEL = { rise: -9, boom: -1, whoosh: -8, sparkle: -12, amb: -14, detail: -12 };
  const out = [];
  for (const [k, events] of Object.entries(cat)) if (events.length) out.push({ id: `sfx_${k}`, type: 'sfx', bus: k === 'boom' ? 'sfxBig' : 'sfx', events, gain: LEVEL[k], reverb: k === 'sparkle' ? 0.2 : 0.06 });
  const byCat = {};
  for (const e of smp) (byCat[e.cat] ||= []).push(e);
  for (const [k, events] of Object.entries(byCat)) out.push({ id: `smp_${k}`, type: 'sample', bus: k === 'boom' ? 'sfxBig' : 'sfx', events, gain: LEVEL[k] ?? -12, reverb: 0.08 });
  return out;
}
