// Small flat illustrations for timeline events that have no photo yet, in the street's style
// (ink outlines, warm colours). Each is drawn in a 100 × 100 box. An event picks one by name
// (timeline_events.motif); unknown or empty names fall back to the city's stamp.
const INK = '#2b1d12';
const o = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;

export const MOTIFS = {
  // a walled city with a gate
  city: `<path d="M12,84 V46 h10 v-8 h8 v8 h10 v-8 h20 v8 h10 v-8 h8 v8 h10 V84 Z" fill="#e9b872" ${o}/>
    <path d="M40,84 V64 a10,10 0 0 1 20,0 V84 Z" fill="#7a3b1d" ${o}/>
    <path d="M44,38 V24 l6,-8 l6,8 V38" fill="#f4e3c3" ${o}/><circle cx="50" cy="12" r="2.5" fill="#d9442b"/>
    <path d="M18,58 h8 M74,58 h8 M18,70 h8 M74,70 h8" ${o}/>`,
  // crossed swords over a round shield
  battle: `<circle cx="50" cy="54" r="22" fill="#c0392b" ${o}/><circle cx="50" cy="54" r="13" fill="#f0c75a" ${o}/><circle cx="50" cy="54" r="4" fill="${INK}"/>
    <path d="M18,20 L78,84 M82,20 L22,84" stroke="#d9dde3" stroke-width="5" stroke-linecap="round"/>
    <path d="M18,20 L78,84 M82,20 L22,84" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M70,72 l12,-4 M30,72 l-12,-4" stroke="#8a5c10" stroke-width="5" stroke-linecap="round"/>`,
  // a white pavilion on an island in the lake
  island: `<path d="M6,76 Q50,64 94,76 V94 H6 Z" fill="#3d6fb6" ${o}/><path d="M14,84 q8,-4 16,0 M46,86 q8,-4 16,0 M70,82 q8,-4 16,0" stroke="#bcd4f2" stroke-width="2" fill="none"/>
    <ellipse cx="50" cy="72" rx="30" ry="6" fill="#7aa35a" ${o}/>
    <path d="M30,70 V50 h40 V70" fill="#f8f1e0" ${o}/><path d="M38,70 V58 a4,4 0 0 1 8,0 V70 M54,70 V58 a4,4 0 0 1 8,0 V70" fill="#7a3b1d" ${o}/>
    <path d="M28,50 Q50,20 72,50 Z" fill="#f8f1e0" ${o}/><path d="M50,30 V20" ${o}/><circle cx="50" cy="18" r="2.5" fill="#f0c75a"/>`,
  // a dam wall holding a lake, hills behind
  lake: `<path d="M4,56 L26,30 L44,48 L62,24 L96,56 Z" fill="#8fae6a" ${o}/>
    <rect x="4" y="54" width="92" height="22" fill="#3d6fb6" ${o}/><path d="M12,64 q8,-4 16,0 M40,62 q8,-4 16,0 M66,66 q8,-4 16,0" stroke="#bcd4f2" stroke-width="2" fill="none"/>
    <path d="M4,76 H96 V88 H4 Z" fill="#d8c4a0" ${o}/><path d="M16,76 V88 M30,76 V88 M44,76 V88 M58,76 V88 M72,76 V88 M86,76 V88" ${o}/>`,
  // a palace that seems to float on the water
  palace: `<path d="M4,78 H96 V94 H4 Z" fill="#3d6fb6" ${o}/><path d="M12,86 q8,-4 16,0 M44,88 q8,-4 16,0 M72,84 q8,-4 16,0" stroke="#bcd4f2" stroke-width="2" fill="none"/>
    <path d="M14,78 V44 H86 V78 Z" fill="#fbf4e4" ${o}/>
    ${[22, 36, 50, 64, 78].map((x) => `<path d="M${x - 4},78 V64 a4,4 0 0 1 8,0 V78" fill="#d98a5a" ${o}/><path d="M${x - 3},56 h6" ${o}/>`).join('')}
    <path d="M30,44 Q38,28 46,44 M54,44 Q62,28 70,44" fill="#fbf4e4" ${o}/><path d="M14,44 h72" ${o}/>`,
  // a palace on a hilltop under monsoon clouds
  clouds: `<path d="M4,90 Q30,52 50,56 Q72,52 96,90 Z" fill="#7d9a5c" ${o}/>
    <path d="M36,58 V42 h28 V58" fill="#f4e3c3" ${o}/><path d="M34,42 Q50,26 66,42 Z" fill="#f4e3c3" ${o}/><path d="M44,58 V50 h12 V58" fill="#7a3b1d" ${o}/>
    <path d="M16,24 a9,9 0 0 1 16,-4 a10,10 0 0 1 18,2 a8,8 0 0 1 4,14 H18 a7,7 0 0 1 -2,-12 Z" fill="#9aa5b8" ${o}/>
    <path d="M58,16 a8,8 0 0 1 14,-3 a9,9 0 0 1 16,4 a7,7 0 0 1 -2,13 H60 a6,6 0 0 1 -2,-14 Z" fill="#b6bfcd" ${o}/>
    <path d="M24,40 l-3,7 M34,40 l-3,7 M44,40 l-3,7 M68,32 l-3,7 M78,32 l-3,7" stroke="#3d6fb6" stroke-width="2.4" stroke-linecap="round"/>`,
  // a film clapperboard
  film: `<rect x="16" y="40" width="68" height="44" rx="4" fill="#2b2b2b" ${o}/>
    <path d="M16,40 L84,40 L80,24 L14,30 Z" fill="#f4f1ea" ${o}/>
    <path d="M24,29 L30,39 M38,27 L44,39 M52,26 L58,39 M66,25 L72,39" stroke="${INK}" stroke-width="5"/>
    <path d="M24,54 H76 M24,66 H60" stroke="#f0c75a" stroke-width="3" stroke-linecap="round"/><circle cx="70" cy="72" r="5" fill="#c0392b"/>`,
  // a tall sailing ship
  ship: `<path d="M4,82 Q50,74 96,82 V94 H4 Z" fill="#3d6fb6" ${o}/>
    <path d="M14,66 H86 L76,82 H24 Z" fill="#8a5a2b" ${o}/><path d="M24,72 h52" stroke="#f0c75a" stroke-width="2"/>
    <path d="M38,66 V14 M62,66 V22" ${o}/>
    <path d="M38,18 Q54,30 38,42 Z M38,44 Q56,54 38,62 Z M62,26 Q76,36 62,46 Z M62,48 Q78,56 62,64 Z" fill="#f8f1e0" ${o}/>
    <path d="M38,14 l12,4 l-12,4 Z" fill="#c0392b"/>`,
  // columns and a pediment
  museum: `<path d="M10,36 L50,14 L90,36 Z" fill="#f0e2c4" ${o}/><rect x="12" y="36" width="76" height="6" fill="#e2cfa6" ${o}/>
    ${[20, 34, 50, 66, 80].map((x) => `<rect x="${x - 4}" y="42" width="8" height="34" fill="#f8f1e0" ${o}/>`).join('')}
    <rect x="8" y="76" width="84" height="8" fill="#e2cfa6" ${o}/><rect x="4" y="84" width="92" height="6" fill="#cdb78a" ${o}/><circle cx="50" cy="28" r="3.5" fill="#c0392b"/>`,
  // a riverside temple with spires
  temple: `<path d="M4,86 H96 V94 H4 Z" fill="#3d6fb6" ${o}/>
    <path d="M18,86 V56 H82 V86 Z" fill="#f1e3c8" ${o}/>
    <path d="M38,56 Q50,14 62,56 Z" fill="#e8d2a8" ${o}/><path d="M22,56 Q30,34 38,56 Z M62,56 Q70,34 78,56 Z" fill="#e8d2a8" ${o}/>
    <path d="M50,26 V16 M30,40 V34 M70,40 V34" ${o}/><path d="M50,16 l8,3 l-8,3 Z" fill="#e8730c"/>
    <path d="M44,86 V70 a6,6 0 0 1 12,0 V86 Z M26,86 V72 h8 V86 M66,86 V72 h8 V86" fill="#a0402a" ${o}/>`,
  // an old tram on its rails
  tram: `<path d="M6,84 H94" stroke="${INK}" stroke-width="3"/><path d="M50,30 V14 M42,14 H58" ${o}/>
    <rect x="12" y="30" width="76" height="46" rx="6" fill="#e9c46a" ${o}/><rect x="12" y="58" width="76" height="18" fill="#3c8c5a" ${o}/>
    ${[22, 38, 54, 70].map((x) => `<rect x="${x - 4}" y="38" width="12" height="14" rx="2" fill="#dbe9f4" ${o}/>`).join('')}
    <circle cx="28" cy="80" r="5" fill="#555" ${o}/><circle cx="72" cy="80" r="5" fill="#555" ${o}/>`,
  // a crown on a cushion
  crown: `<path d="M20,70 L14,32 L32,50 L50,24 L68,50 L86,32 L80,70 Z" fill="#f0c75a" ${o}/>
    <circle cx="14" cy="30" r="4" fill="#f0c75a" ${o}/><circle cx="50" cy="22" r="4" fill="#f0c75a" ${o}/><circle cx="86" cy="30" r="4" fill="#f0c75a" ${o}/>
    <circle cx="50" cy="56" r="5" fill="#c0392b" ${o}/><circle cx="32" cy="60" r="3.5" fill="#3d6fb6"/><circle cx="68" cy="60" r="3.5" fill="#3c8c5a"/>
    <path d="M14,72 Q50,64 86,72 Q90,84 50,86 Q10,84 14,72 Z" fill="#9b2c3a" ${o}/>`,
  // a medal on a ribbon, and a quill
  medal: `<path d="M34,10 L50,44 L66,10 Z" fill="#3d6fb6" ${o}/><path d="M42,10 L50,28 L58,10" fill="#c0392b"/>
    <circle cx="50" cy="62" r="22" fill="#f0c75a" ${o}/><circle cx="50" cy="62" r="15" fill="none" stroke="#a07415" stroke-width="2"/>
    <path d="M44,64 q6,-12 12,0 q-6,6 -12,0" fill="#a07415"/>
    <path d="M78,30 Q94,46 82,70 L74,80" fill="#f8f1e0" ${o}/>`,
  // a cantilever bridge over the river
  bridge: `<path d="M4,78 H96 V94 H4 Z" fill="#3d6fb6" ${o}/>
    <path d="M10,62 H90" stroke="${INK}" stroke-width="4"/>
    <path d="M24,62 V30 M76,62 V30" stroke="#5b6a7a" stroke-width="5"/>
    <path d="M24,30 L4,62 M24,30 L50,62 M76,30 L50,62 M76,30 L96,62 M24,40 L76,40" stroke="#7d8b99" stroke-width="2.6" fill="none"/>
    <path d="M24,62 V78 M76,62 V78" stroke="${INK}" stroke-width="5"/>`,
  // a metro train coming out of a tunnel
  metro: `<path d="M8,86 V48 a42,30 0 0 1 84,0 V86 Z" fill="#5a4a42" ${o}/><path d="M18,86 V50 a32,22 0 0 1 64,0 V86 Z" fill="#1f1a17"/>
    <rect x="26" y="42" width="48" height="38" rx="8" fill="#e9eef3" ${o}/><rect x="32" y="48" width="36" height="14" rx="3" fill="#7fb2df" ${o}/>
    <path d="M26,68 H74" stroke="#8b3fa0" stroke-width="5"/><circle cx="36" cy="74" r="3" fill="#f0c75a"/><circle cx="64" cy="74" r="3" fill="#f0c75a"/>`,
  // a new name on a signboard
  sign: `<path d="M30,84 V54 M70,84 V54" stroke="${INK}" stroke-width="4"/>
    <rect x="12" y="20" width="76" height="36" rx="4" fill="#2f6b3a" ${o}/><rect x="17" y="25" width="66" height="26" rx="2" fill="none" stroke="#f4f1ea" stroke-width="1.6"/>
    <path d="M28,33 H72" stroke="#f4f1ea" stroke-width="3.5" stroke-linecap="round" opacity=".55"/><path d="M24,34 L76,31" stroke="#e8730c" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M30,44 H70" stroke="#f4f1ea" stroke-width="4" stroke-linecap="round"/>`,
  // a dhak drum with feathers, for Durga Puja
  drum: `<path d="M50,14 q-10,6 -8,20 M50,14 q10,6 8,20 M50,12 v22" stroke="#f4f1ea" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="40" rx="30" ry="9" fill="#f4e3c3" ${o}/>
    <path d="M20,40 V76 A30,9 0 0 0 80,76 V40" fill="#c0392b" ${o}/>
    <path d="M20,48 L36,84 M36,48 L52,85 M52,48 L66,84 M66,48 L80,76 M80,48 L64,85 M64,48 L48,85 M48,48 L34,84 M34,48 L20,74" stroke="#f0c75a" stroke-width="1.6"/>`,
};

export const MOTIF_NAMES = Object.keys(MOTIFS);
export const motifSVG = (name) => (MOTIFS[name] ? `<svg viewBox="0 0 100 100" aria-hidden="true">${MOTIFS[name]}</svg>` : '');
