// Gaju, drawn in code in the street's style: the Virasat Dak postman elephant, with a red jhool (the cloth
// on his back), a khaki mail satchel and a brass bell. He faces left. His legs, ear, trunk and eye are separate
// parts, so CSS can make him walk, flap, sway and blink (see "Gaju" in style.css).
// assets/gaju.svg is the same drawing as a file, for the places that use a plain <img>.
const INK = '#3a2420', SKIN = '#8f8bbd', SHADE = '#77729f', JHOOL = '#c8402a', GOLD = '#e9b84a', BAG = '#c9a66b';

const leg = (x, cls, fill) => `<g class="gj-leg ${cls}" style="transform-origin:${x}px 98px">
    <path d="M${x - 10},96 h20 v34 q0,6 -6,6 h-8 q-6,0 -6,-6 Z" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M${x - 7},134 q2,-4 4,0 M${x - 1},134 q2,-4 4,0 M${x + 5},134 q2,-4 4,0" stroke="#f4ead8" stroke-width="1.6" fill="none"/></g>`;

export function gajuSVG(extra = '') {
  return `<svg class="gaju-svg" viewBox="0 0 200 150" ${extra} aria-hidden="true">
  ${leg(152, 'b far', SHADE)}${leg(88, 'a far', SHADE)}
  <path class="gj-tail" style="transform-origin:166px 70px" d="M166,70 q12,10 10,26" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M172,94 l4,8 l-7,-3 Z" fill="${INK}"/>
  <path d="M68,72 Q70,36 116,36 Q166,36 170,76 Q172,108 142,112 L94,112 Q68,108 68,72 Z" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
  <g class="gj-jhool">
    <path d="M90,40 Q118,30 150,42 L152,96 Q120,104 92,96 Z" fill="${JHOOL}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M95,47 Q118,39 145,48 L146,90 Q120,97 97,90 Z" fill="none" stroke="${GOLD}" stroke-width="3"/>
    ${[[108, 60], [122, 56], [136, 60], [114, 76], [130, 76], [122, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#f4ead8" stroke="${GOLD}" stroke-width="1.4"/>`).join('')}
    ${[96, 106, 116, 126, 136, 146].map((x, i) => `<path d="M${x},${97 + (i % 2)} v7" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>`).join('')}
  </g>
  <g class="gj-bag">
    <path d="M100,40 L132,78" stroke="#7a5a32" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="124" y="70" width="28" height="24" rx="4" fill="${BAG}" stroke="${INK}" stroke-width="2.2"/>
    <path d="M124,74 h28 v7 q-14,6 -28,0 Z" fill="#b28f55" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="138" cy="80" r="2" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>
  </g>
  ${leg(140, 'a', SKIN)}${leg(80, 'b', SKIN)}
  <path class="gj-ear" style="transform-origin:82px 42px" d="M80,36 Q114,28 112,62 Q110,88 86,86 Q76,70 80,36 Z" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
  <path d="M86,44 Q104,42 104,62 Q102,78 90,78" fill="#b4a3c9" opacity=".7"/>
  <path d="M38,42 Q58,26 80,36 Q94,56 86,80 Q76,96 58,94 Q34,88 32,64 Q32,50 38,42 Z" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
  <path d="M52,36 l6,-7 l6,7 l-6,6 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>
  <g class="gj-trunk" style="transform-origin:50px 84px">
    <path d="M44,80 Q38,100 28,114 Q22,124 29,128 Q36,131 39,122 Q46,106 58,90" fill="${SKIN}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M34,104 q5,2 8,0 M30,113 q5,2 8,0" stroke="${INK}" stroke-width="1.4" fill="none" opacity=".6"/>
  </g>
  <path d="M54,88 q-6,9 -16,9 q9,-3 13,-11 Z" fill="#f4ead8" stroke="${INK}" stroke-width="1.6"/>
  <g class="gj-eye" style="transform-origin:51px 60px"><ellipse cx="51" cy="60" rx="3.4" ry="4" fill="${INK}"/><circle cx="52.2" cy="58.6" r="1.1" fill="#fff"/></g>
  <path d="M44,54 q7,-5 13,-1" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M68,92 v8" stroke="${INK}" stroke-width="1.6"/>
  <path class="gj-bell" style="transform-origin:68px 98px" d="M62,106 q0,-9 6,-9 q6,0 6,9 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>
</svg>`;
}
