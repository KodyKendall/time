// audio/scores/orpheus_cancan.mjs — Jacques Offenbach, "Galop infernal" (the Can-Can)
// from Orphée aux enfers (La belle Hélène), Act II no. 15, 1858; revised 1874.
// Public domain. Orchestral setting: flute lead, saxes, brass, pizzicato strings,
// upright bass, piano, timpani and a can-can drum kit.
//
// SOURCE OF THE NOTES — the melody is Offenbach's, note for note
//   Primary, machine-readable: the LilyPond-engraved edition of the number, as MIDI:
//     https://www.flutetunes.com/tunes/offenbach-orphee-aux-enfers-galop-infernal.mid
//     (its engraved score, LilyPond 2.14.2, same edition:
//      https://www.flutetunes.com/tunes/offenbach-orphee-aux-enfers-galop-infernal.pdf)
//   Independent public-domain check: Bote & Bock plate 10779, "Galop infernal" from
//   Orpheus in der Unterwelt, 5 pp., via the IMSLP mirror on the Internet Archive:
//     https://archive.org/download/imslp-aux-enfers-offenbach-jacques/
//       PMLP24816-Offenbach_Orpheus_in_der_Unterwelt_Galop_infernal_BB_vs.pdf
//   Bars 1-8 were compared note by note between the two and agree exactly (D major,
//   2/4): A4 E5 E5 F#5(+grace) | E5 D5 D5 | F#5 G5 B5 D6 | B5 B5 A5 |
//   A5 B5 C#5 C#5 | B5 A5 D5 D5 F#5(+grace) G#5(+grace) | F#5 E5 F#5 E5 G#5(+grace) |
//   F#5 E5 F#5. Staff positions in the scan were measured against its own staff lines
//   at 600 dpi to confirm each notehead.
//
//   The MIDI is 384 ticks per quarter, 2/4, 2 sharps (D major), one constant tempo of
//   375000 us/quarter = the score's own "Allegretto moderato (quarter = 160)". Onsets and
//   written durations in MELODY are taken from it verbatim: nothing is quantised.
//
// WHICH CHOICES ARE MINE (everything except the pitches/onsets/durations in MELODY)
//   1. Orchestration. The source is a solo flute line, so every other part is my
//      arrangement: flute lead, octave piccolo doubling in the ff passages, tenor-sax
//      shadow an octave below, alto-sax chord stabs, trumpet stabs, brass pad, pizzicato
//      strings, upright bass, piano accents, timpani.
//   2. Accompaniment. The oom-pah (bass root on 1 and 2, chord stabs on the offbeats)
//      and the drum pattern are mine; the source carries no accompaniment.
//   3. Harmony. CHORD[] is one chord per bar, analysed by me from the melody
//      (D / A7 through the theme, G - C - D7 in the middle section). Not transcribed.
//   4. Staccato shortening. SHORTEN trims the written durations, because a LilyPond MIDI
//      keeps written values and a can-can needs them clipped. Grace notes are left alone.
//   5. Velocity mapping. The source MIDI is a flat v68 on every note, so VEL maps it into
//      a playable range and DYN[] supplies the printed dynamics.
//   6. Dynamics (DYN[]) are mine; the tempo plan is the score's own, constant quarter=160.
//
//   node audio/render.mjs audio/scores/orpheus_cancan.mjs audio/build/orpheus_cancan.wav
import { midi as N, chord, tempoMap, humanizer, DRUMS } from '../lib/music.mjs';
import { inst } from '../lib/instruments.mjs';

const PPQ = 384;                      // MIDI ticks per quarter note
const BAR = PPQ * 2;                  // 2/4
const BARS = 145;                     // bars as written in the source (repeats included)

const tm = tempoMap([{ beat: 0, bpm: 160 }], { beatsPerBar: 2 });
const sec = (tick) => tm.beat(tick / PPQ);
const barTick = (bar) => bar * BAR;   // bar is 0-based

// LilyPond velocity -> playable velocity, before DYN.
const VEL = (v) => Math.max(30, Math.min(120, Math.round(v * 1.28)));

// written duration -> sounding duration (my staccato table).
const SHORTEN = [
  [96, 0.62],     // 16ths
  [192, 0.70],    // 8ths
  [288, 0.78],    // dotted 8ths
  [384, 0.84],    // quarters
  [576, 0.88],    // dotted quarters
  [768, 0.92],    // halves
  [1e9, 0.96],    // longer
];
function sounding(ticks) {
  if (ticks <= 64) return Math.max(18, Math.round(ticks));    // grace notes stay tiny
  for (const [lim, f] of SHORTEN) if (ticks <= lim) return Math.max(30, Math.round(ticks * f));
  return ticks;
}

// ---- melody: [tick, midiPitch, writtenDurationInTicks] — Offenbach's, verbatim --
const MELODY = [
  [192, 69, 192], [384, 76, 192], [576, 76, 192], [724, 78, 148], [767, 78, 43], [960, 76, 192], [1152, 74, 192], [1344, 74, 192], [1536, 78, 192],
  [1728, 79, 192], [1920, 83, 192], [2112, 86, 192], [2304, 83, 192], [2496, 83, 192], [2688, 81, 192], [3072, 81, 384], [3264, 83, 192], [3456, 73, 192],
  [3648, 73, 192], [3840, 83, 192], [4032, 81, 192], [4224, 74, 192], [4416, 74, 192], [4564, 78, 148], [4607, 80, 43], [4800, 78, 192], [4992, 76, 192],
  [5184, 78, 192], [5332, 76, 148], [5375, 80, 43], [5568, 78, 192], [5760, 76, 192], [5952, 78, 192], [6144, 76, 192], [6336, 69, 192], [6528, 76, 192],
  [6720, 76, 192], [6868, 78, 148], [6911, 78, 43], [7104, 76, 192], [7296, 74, 192], [7488, 74, 192], [7680, 78, 192], [7872, 79, 192], [8064, 83, 192],
  [8256, 86, 192], [8448, 83, 192], [8640, 83, 192], [8832, 81, 192], [9216, 81, 384], [9408, 83, 192], [9600, 73, 192], [9792, 73, 192], [9984, 83, 192],
  [10176, 81, 192], [10368, 74, 192], [10560, 74, 192], [10708, 78, 148], [10751, 80, 43], [10944, 78, 192], [11136, 76, 192], [11328, 78, 192],
  [11520, 76, 192], [11712, 76, 192], [11904, 74, 192], [12288, 74, 384], [12672, 90, 384], [13056, 86, 384], [13440, 83, 384], [13824, 81, 384],
  [14016, 81, 192], [14208, 76, 192], [14400, 78, 192], [14592, 79, 192], [14784, 78, 192], [14976, 76, 192], [15360, 74, 384], [15744, 90, 384],
  [16128, 86, 384], [16512, 83, 384], [16896, 81, 384], [17088, 80, 192], [17280, 81, 192], [17472, 83, 192], [17664, 85, 192], [17856, 88, 192],
  [18048, 86, 192], [18432, 86, 384], [18816, 90, 384], [19200, 86, 384], [19584, 83, 384], [19968, 81, 384], [20160, 81, 192], [20352, 76, 192],
  [20544, 78, 192], [20736, 79, 192], [20928, 78, 192], [21120, 76, 192], [21504, 74, 384], [21888, 90, 384], [22272, 86, 384], [22656, 83, 384],
  [23040, 81, 384], [23232, 80, 192], [23424, 81, 192], [23616, 83, 192], [23808, 85, 192], [24000, 86, 192], [24192, 81, 192], [24384, 85, 192],
  [24576, 81, 192], [24768, 86, 192], [24960, 81, 192], [25152, 85, 192], [25344, 81, 192], [25536, 86, 192], [25728, 81, 192], [25920, 85, 192],
  [26112, 81, 192], [26304, 86, 192], [26496, 81, 192], [26688, 85, 192], [26880, 81, 192], [27168, 86, 288], [27264, 74, 96], [27552, 74, 288],
  [27648, 74, 96], [27936, 74, 288], [28032, 74, 96], [28320, 74, 288], [28416, 74, 96], [28704, 74, 288], [28800, 74, 96], [29088, 74, 288],
  [29184, 74, 96], [29472, 74, 288], [29568, 74, 96], [29952, 62, 384], [30720, 67, 768], [30912, 69, 192], [31104, 72, 192], [31296, 71, 192],
  [31488, 69, 192], [31872, 74, 384], [32256, 74, 384], [32448, 74, 192], [32640, 76, 192], [32832, 71, 192], [33024, 72, 192], [33408, 69, 384],
  [33792, 69, 384], [33984, 69, 192], [34176, 72, 192], [34368, 71, 192], [34560, 69, 192], [34752, 67, 192], [34944, 79, 192], [35136, 78, 192],
  [35328, 76, 192], [35520, 74, 192], [35712, 72, 192], [35904, 71, 192], [36096, 69, 192], [36864, 67, 768], [37056, 69, 192], [37248, 72, 192],
  [37440, 71, 192], [37632, 69, 192], [38016, 74, 384], [38400, 74, 384], [38592, 74, 192], [38784, 76, 192], [38976, 71, 192], [39168, 72, 192],
  [39552, 69, 384], [39936, 69, 384], [40128, 69, 192], [40320, 72, 192], [40512, 71, 192], [40704, 69, 192], [40896, 67, 192], [41088, 74, 192],
  [41280, 69, 192], [41472, 71, 192], [41856, 67, 384], [42240, 62, 384], [43008, 67, 768], [43200, 69, 192], [43392, 72, 192], [43584, 71, 192],
  [43776, 69, 192], [44160, 74, 384], [44544, 74, 384], [44736, 74, 192], [44928, 76, 192], [45120, 71, 192], [45312, 72, 192], [45696, 69, 384],
  [46080, 69, 384], [46272, 69, 192], [46464, 72, 192], [46656, 71, 192], [46848, 69, 192], [47040, 67, 192], [47232, 79, 192], [47424, 78, 192],
  [47616, 76, 192], [47808, 74, 192], [48000, 72, 192], [48192, 71, 192], [48384, 69, 192], [49152, 67, 768], [49344, 69, 192], [49536, 72, 192],
  [49728, 71, 192], [49920, 69, 192], [50304, 74, 384], [50688, 74, 384], [50880, 74, 192], [51072, 76, 192], [51264, 71, 192], [51456, 72, 192],
  [51840, 69, 384], [52224, 69, 384], [52416, 69, 192], [52608, 72, 192], [52800, 71, 192], [52992, 69, 192], [53184, 67, 192], [53376, 74, 192],
  [53568, 69, 192], [53760, 71, 192], [54528, 67, 768], [54720, 69, 192], [54912, 76, 192], [55104, 76, 192], [55252, 78, 148], [55295, 78, 43],
  [55488, 76, 192], [55680, 74, 192], [55872, 74, 192], [56064, 78, 192], [56256, 79, 192], [56448, 83, 192], [56640, 86, 192], [56832, 83, 192],
  [57024, 83, 192], [57216, 81, 192], [57600, 81, 384], [57792, 83, 192], [57984, 73, 192], [58176, 73, 192], [58368, 83, 192], [58560, 81, 192],
  [58752, 74, 192], [58944, 74, 192], [59092, 78, 148], [59135, 80, 43], [59328, 78, 192], [59520, 76, 192], [59712, 78, 192], [59860, 76, 148],
  [59903, 80, 43], [60096, 78, 192], [60288, 76, 192], [60480, 78, 192], [60672, 76, 192], [60864, 69, 192], [61056, 76, 192], [61248, 76, 192],
  [61396, 78, 148], [61439, 78, 43], [61632, 76, 192], [61824, 74, 192], [62016, 74, 192], [62208, 78, 192], [62400, 79, 192], [62592, 83, 192],
  [62784, 86, 192], [62976, 83, 192], [63168, 83, 192], [63360, 81, 192], [63744, 81, 384], [63936, 83, 192], [64128, 81, 192], [64512, 81, 384],
  [64704, 83, 192], [64896, 81, 192], [65280, 81, 384], [65472, 83, 192], [65664, 81, 192], [66048, 81, 384], [66240, 83, 192], [66432, 81, 192],
  [66816, 81, 384], [67008, 83, 192], [67200, 81, 192], [67584, 81, 384], [67776, 83, 192], [67968, 81, 192], [68352, 81, 384], [68544, 83, 192],
  [68736, 81, 192], [69120, 81, 384], [69312, 83, 192], [69504, 81, 192], [69696, 83, 192], [69888, 81, 192], [70080, 83, 192], [70272, 81, 192],
  [70464, 83, 192], [70656, 81, 192], [70848, 83, 192], [71040, 81, 192], [71424, 69, 384], [72192, 74, 768], [72384, 76, 192], [72576, 79, 192],
  [72768, 78, 192], [72960, 76, 192], [73344, 81, 384], [73728, 81, 384], [73920, 81, 192], [74112, 83, 192], [74304, 78, 192], [74496, 79, 192],
  [74880, 76, 384], [75264, 76, 384], [75456, 76, 192], [75648, 79, 192], [75840, 78, 192], [76032, 76, 192], [76224, 74, 192], [76416, 86, 192],
  [76608, 85, 192], [76800, 83, 192], [76992, 81, 192], [77184, 79, 192], [77376, 78, 192], [77568, 76, 192], [78336, 74, 768], [78528, 76, 192],
  [78720, 79, 192], [78912, 78, 192], [79104, 76, 192], [79488, 81, 384], [79872, 81, 384], [80064, 81, 192], [80256, 83, 192], [80448, 78, 192],
  [80640, 79, 192], [81024, 76, 384], [81408, 76, 384], [81600, 76, 192], [81792, 79, 192], [81984, 78, 192], [82176, 76, 192], [82368, 74, 192],
  [82560, 81, 192], [82752, 76, 192], [82944, 78, 192], [83328, 74, 384], [83712, 69, 384], [84480, 74, 768], [84672, 76, 192], [84864, 79, 192],
  [85056, 78, 192], [85248, 76, 192], [85632, 81, 384], [86016, 81, 384], [86208, 81, 192], [86400, 83, 192], [86592, 78, 192], [86784, 79, 192],
  [87168, 76, 384], [87552, 76, 384], [87744, 76, 192], [87936, 79, 192], [88128, 78, 192], [88320, 76, 192], [88512, 74, 192], [88704, 86, 192],
  [88896, 85, 192], [89088, 83, 192], [89280, 81, 192], [89472, 79, 192], [89664, 78, 192], [89856, 76, 192], [90624, 74, 768], [90816, 76, 192],
  [91008, 79, 192], [91200, 78, 192], [91392, 76, 192], [91776, 81, 384], [92160, 81, 384], [92352, 81, 192], [92544, 83, 192], [92736, 78, 192],
  [92928, 79, 192], [93312, 76, 384], [93696, 76, 384], [93888, 76, 192], [94080, 79, 192], [94272, 78, 192], [94464, 76, 192], [94848, 86, 384],
  [95232, 74, 384], [95616, 76, 384], [96000, 78, 384], [96192, 81, 192], [96384, 79, 192], [96576, 73, 192], [96768, 71, 192], [96960, 69, 192],
  [97152, 79, 192], [97344, 78, 192], [97536, 76, 192], [97920, 74, 384], [98304, 74, 384], [98688, 76, 384], [99072, 78, 384], [99264, 81, 192],
  [99456, 79, 192], [99648, 73, 192], [99840, 71, 192], [100032, 69, 192], [100224, 79, 192], [100416, 78, 192], [100608, 76, 192], [100800, 74, 192],
  [100992, 81, 192], [101184, 76, 192], [101376, 78, 192], [101568, 74, 192], [101760, 81, 192], [101952, 76, 192], [102144, 78, 192], [102336, 74, 192],
  [102528, 81, 192], [102720, 76, 192], [102912, 78, 192], [103104, 74, 192], [103296, 81, 192], [103488, 76, 192], [103680, 78, 192], [104448, 74, 768],
  [104832, 90, 384], [105216, 86, 384], [105600, 93, 384], [105984, 86, 384], [106368, 78, 384], [106752, 81, 384], [107136, 86, 384], [107904, 86, 384],
  [108672, 81, 384], [109440, 90, 384], [109920, 86, 96], [110016, 74, 96], [110112, 86, 96], [110208, 74, 96], [110304, 86, 96], [110400, 74, 96],
  [110496, 86, 96], [110592, 74, 96], [110976, 86, 384]
];

// ---- my chord per bar (1-based bar numbers in the comments) --------------------
const CHORD = [
  'D',           // bar 1
  'A7',          // bar 2
  'D',           // bar 3
  'A7',          // bar 4
  'A7',          // bar 5
  'A7',          // bar 6
  'A7',          // bar 7
  'D',           // bar 8
  'D',           // bar 9
  'A7',          // bar 10
  'D',           // bar 11
  'A7',          // bar 12
  'A7',          // bar 13
  'A7',          // bar 14
  'A7',          // bar 15
  'D',           // bar 16
  'D',           // bar 17
  'D',           // bar 18
  'A7',          // bar 19
  'A7',          // bar 20
  'D',           // bar 21
  'D',           // bar 22
  'A7',          // bar 23
  'A7',          // bar 24
  'D',           // bar 25
  'D',           // bar 26
  'A7',          // bar 27
  'A7',          // bar 28
  'D',           // bar 29
  'D',           // bar 30
  'A7',          // bar 31
  'D',           // bar 32
  'A7',          // bar 33
  'A7',          // bar 34
  'A7',          // bar 35
  'D',           // bar 36
  'D',           // bar 37
  'D',           // bar 38
  'D',           // bar 39
  'D',           // bar 40
  'G',           // bar 41
  'G',           // bar 42
  'D7',          // bar 43
  'C',           // bar 44
  'C',           // bar 45
  'D7',          // bar 46
  'C',           // bar 47
  'G7',          // bar 48
  'G',           // bar 49
  'G',           // bar 50
  'D7',          // bar 51
  'C',           // bar 52
  'C',           // bar 53
  'D7',          // bar 54
  'C',           // bar 55
  'D7',          // bar 56
  'G',           // bar 57
  'G',           // bar 58
  'D7',          // bar 59
  'C',           // bar 60
  'C',           // bar 61
  'D7',          // bar 62
  'C',           // bar 63
  'G7',          // bar 64
  'G',           // bar 65
  'G',           // bar 66
  'D7',          // bar 67
  'C',           // bar 68
  'C',           // bar 69
  'D7',          // bar 70
  'G7',          // bar 71
  'D',           // bar 72
  'A7',          // bar 73
  'D',           // bar 74
  'A7',          // bar 75
  'A7',          // bar 76
  'A7',          // bar 77
  'A7',          // bar 78
  'A7',          // bar 79
  'D',           // bar 80
  'A7',          // bar 81
  'D',           // bar 82
  'A7',          // bar 83
  'A7',          // bar 84
  'A7',          // bar 85
  'A7',          // bar 86
  'A7',          // bar 87
  'A7',          // bar 88
  'A7',          // bar 89
  'A7',          // bar 90
  'A7',          // bar 91
  'A7',          // bar 92
  'A7',          // bar 93
  'A7',          // bar 94
  'D',           // bar 95
  'A7',          // bar 96
  'A7',          // bar 97
  'D7',          // bar 98
  'D',           // bar 99
  'A7',          // bar 100
  'A7',          // bar 101
  'A7',          // bar 102
  'D',           // bar 103
  'A7',          // bar 104
  'A7',          // bar 105
  'D7',          // bar 106
  'D',           // bar 107
  'A7',          // bar 108
  'D',           // bar 109
  'D',           // bar 110
  'D',           // bar 111
  'A7',          // bar 112
  'A7',          // bar 113
  'D7',          // bar 114
  'D',           // bar 115
  'A7',          // bar 116
  'A7',          // bar 117
  'A7',          // bar 118
  'D',           // bar 119
  'A7',          // bar 120
  'A7',          // bar 121
  'D7',          // bar 122
  'D',           // bar 123
  'D',           // bar 124
  'D',           // bar 125
  'A7',          // bar 126
  'A7',          // bar 127
  'D',           // bar 128
  'D',           // bar 129
  'A7',          // bar 130
  'A7',          // bar 131
  'D',           // bar 132
  'D',           // bar 133
  'D',           // bar 134
  'D',           // bar 135
  'D',           // bar 136
  'D',           // bar 137
  'D',           // bar 138
  'D',           // bar 139
  'D',           // bar 140
  'D',           // bar 141
  'D',           // bar 142
  'D',           // bar 143
  'D',           // bar 144
  'D',           // bar 145
];

// ---- my dynamic plan, dB per bar ------------------------------------------------
const DYN = [-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,-14,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,-12,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-8,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,7,7,7,7,7,7,7,7,7,7,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,8,8,8,8,8,8,8,8,8];

// per-bar helpers ---------------------------------------------------------------
const dyn = (bar) => DYN[bar] ?? 0;
const hum = humanizer(11, { time: 0.004, vel: 4 });

function voicing(sym, center, spread = false) {
  return chord(sym, { voicing: spread ? 'spread' : 'close', center });
}
function rootPitch(sym, octave = 2) {
  return chord(sym, { bass: true, bassOctave: octave })[0];
}

export default function orpheusCanCan() {
  // ---------------- lead: flute, exactly the source melody ----------------------
  const flute = [];
  for (const [tick, pitch, dur] of MELODY) {
    const bar = Math.floor(tick / BAR);
    const secs = (dur / PPQ) * 0.375;
    flute.push({
      t: sec(tick),
      d: Math.max(0.05, secs * (sounding(dur) / dur)),
      p: pitch,
      v: Math.max(34, Math.min(120, VEL(68) + dyn(bar) * 2 + (dur >= 384 ? 3 : 0))),
    });
  }

  const piccolo = [];
  const tenorsax = [];
  const loud = (b) => (b >= 16 && b <= 18) || (b >= 35 && b <= 38) || (b >= 83 && b <= 92) || b >= 136;
  const body = (b) => (b >= 18 && b <= 34) || (b >= 94 && b <= 124);
  for (const [tick, pitch, dur] of MELODY) {
    const bar = Math.floor(tick / BAR);
    const d = Math.max(0.05, (dur / PPQ) * 0.375 * (sounding(dur) / dur));
    if (loud(bar) && pitch + 12 <= 100) piccolo.push({ t: sec(tick), d: d * 0.9, p: pitch + 12, v: 62 + dyn(bar) });
    if (body(bar) && pitch - 12 >= 50) tenorsax.push({ t: sec(tick), d: d * 0.95, p: pitch - 12, v: 70 + dyn(bar) });
  }

  // ---------------- accompaniment: the galop oom-pah -----------------------------
  const bass = [], pizz = [], saxstab = [], tutes = [], pads = [], keys = [];
  const crashBars = new Set([0, 16, 35, 40, 48, 56, 64, 71, 79, 83, 94, 102, 110, 118, 125, 136, 144]);
  const timpBars = new Set([16, 18, 20, 22, 24, 26, 28, 30, 35, 39, 40, 48, 56, 64, 71, 83, 94, 102, 110, 118, 125, 136]);
  const timpPitch = { D: 38, A7: 45, G: 43, G7: 43, C: 36, D7: 38 };

  for (let bar = 0; bar < BARS; bar++) {
    const sym = CHORD[bar];
    const d = dyn(bar);
    const t0 = barTick(bar);
    const root = rootPitch(sym, 2);
    const fifth = root + 7;
    const mid = voicing(sym, 64);
    const low = voicing(sym, 55);
    const wide = voicing(sym, 62, true);

    bass.push({ t: sec(t0), d: 0.19, p: root, v: 92 + d });
    bass.push({ t: sec(t0 + PPQ / 2), d: 0.1, p: root + 12, v: 66 + d });
    bass.push({ t: sec(t0 + PPQ), d: 0.19, p: fifth, v: 86 + d });
    bass.push({ t: sec(t0 + PPQ + PPQ / 2), d: 0.1, p: fifth + 12, v: 62 + d });

    for (const off of [0, PPQ / 2, PPQ, PPQ + PPQ / 2]) {
      const strong = off === 0 || off === PPQ;
      const tones = strong ? low : mid;
      tones.forEach((p, i) => pizz.push({
        t: sec(t0 + off) + i * 0.006, d: 0.16, p, v: (strong ? 74 : 62) + d,
      }));
    }

    for (const off of [PPQ / 2, PPQ + PPQ / 2]) {
      low.slice(1).forEach((p, i) => saxstab.push({
        t: sec(t0 + off) + i * 0.004, d: 0.15, p: p + 12, v: 74 + d,
      }));
      wide.forEach((p, i) => tutes.push({
        t: sec(t0 + off) + i * 0.003, d: 0.14, p: Math.min(p + 12, 86), v: 66 + d,
      }));
    }
    if (bar % 2 === 1) wide.forEach((p, i) => tutes.push({
      t: sec(t0 + PPQ) + i * 0.005, d: 0.26, p: Math.min(p + 12, 88), v: 78 + d,
    }));

    if (bar >= 40 && bar <= 70) wide.forEach((p, i) => pads.push({
      t: sec(t0) + i * 0.02, d: 0.74, p, v: 50 + d,
    }));

    if (bar % 4 === 0) voicing(sym, 60).forEach((p, i) => keys.push({
      t: sec(t0) + i * 0.01, d: 0.3, p, v: 62 + d,
    }));
  }

  // ---------------- drums: the can-can groove -----------------------------------
  const drums = [];
  for (let bar = 0; bar < BARS; bar++) {
    const d = dyn(bar);
    const t0 = barTick(bar);
    const hot = d >= 4;
    drums.push({ t: sec(t0), d: 0.16, p: DRUMS.kick, v: 104 + d });
    drums.push({ t: sec(t0 + PPQ / 2), d: 0.1, p: DRUMS.hhClosed, v: (bar % 2 ? 52 : 66) + d });
    drums.push({ t: sec(t0 + PPQ), d: 0.16, p: DRUMS.kick, v: 96 + d });
    drums.push({ t: sec(t0 + PPQ), d: 0.14, p: DRUMS.snare, v: 100 + d });
    drums.push({ t: sec(t0 + PPQ + PPQ / 2), d: 0.1, p: DRUMS.hhClosed, v: (bar % 2 ? 50 : 62) + d });
    if (bar % 8 === 4) drums.push({ t: sec(t0 + PPQ / 2), d: 0.1, p: DRUMS.snare, v: 40 + d });
    if (hot) {
      for (let i = 0; i < 8; i++) drums.push({ t: sec(t0 + i * PPQ / 4), d: 0.07, p: DRUMS.tambourine, v: 46 + d - i });
    }
    if (crashBars.has(bar)) drums.push({ t: sec(t0), d: 1.6, p: DRUMS.crash, v: 74 + d });
  }

  const timp = [];
  for (const bar of timpBars) {
    const p = timpPitch[CHORD[bar].split('/')[0]];
    if (p === undefined) continue;
    timp.push({ t: sec(barTick(bar)), d: 0.55, p, v: 74 + dyn(bar) });
  }

  const lastTick = MELODY[MELODY.length - 1];
  const duration = sec(lastTick[0] + lastTick[2] / PPQ) + 2.6;

  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
  const H = (notes) => notes.map(hum);

  const tracks = [
    { id: 'flute', ...gm(73), notes: H(flute), gain: 1.5, pan: 0.12, reverb: 0.3, eq: [{ type: 'hp', freq: 300 }] },
    { id: 'piccolo', ...gm(73), notes: H(piccolo), gain: -4, pan: 0.3, reverb: 0.34, eq: [{ type: 'hp', freq: 700 }] },
    { id: 'tenorsax', ...gm(66), notes: H(tenorsax), gain: -6, pan: -0.18, reverb: 0.3, eq: [{ type: 'hp', freq: 180 }] },
    { id: 'saxstab', ...gm(65), notes: H(saxstab), gain: -7, pan: 0.22, reverb: 0.24 },
    { id: 'trumpets', ...gm(56), notes: H(tutes), gain: -6, pan: -0.05, reverb: 0.3 },
    { id: 'brasspad', ...gm(61), notes: H(pads), gain: -13, pan: 0, width: 1, reverb: 0.5, eq: [{ type: 'hp', freq: 140 }] },
    { id: 'pizz', ...gm(45), notes: H(pizz), gain: -10, pan: -0.1, width: 0.8, reverb: 0.32 },
    { id: 'bass', ...gm(33), notes: H(bass), gain: -5, pan: 0, reverb: 0.14 },
    { id: 'piano', ...gm(0), notes: H(keys), gain: -10, pan: -0.25, reverb: 0.3, eq: [{ type: 'hp', freq: 90 }] },
    { id: 'timp', ...gm(47), notes: timp, gain: -8, pan: 0, reverb: 0.4 },
    { id: 'drums', ...{ sf: 'gm', program: 0, drums: true }, notes: drums, gain: -8, pan: 0, reverb: 0.14 },
  ];

  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(),
    tracks,
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.2, predelay: 0.014, return: 'music' } },
      master: { targetLUFS: -16, ceiling: -1, fadeOut: 2.0 },
    },
  };
}
