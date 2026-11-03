// The film behind a city's arrival: a muted, looping YouTube video of the city, embedded (never downloaded or
// re-hosted), starting at a random point each visit, with the video's title and channel credited at the side.
//
// It starts loading the moment a gate is picked (warmFilm), hidden, while Gaju walks there, so by the time the
// arch opens the video is already playing and the city opens straight onto it. It lives in its own layer just
// under the city view (#filmLayer), so it never has to move (moving a YouTube frame reloads it).
// The drawn city scene (hero.js) is the fallback: it shows if the video isn't playing yet when the city opens,
// and stays if YouTube is blocked, slow, or the video can't be embedded. Visitors who ask for less motion or
// less data get the drawing.
const FILMS = {
  kolkata: { id: 'tYY4WnfEEkY' },
  udaipur: { id: '-w5oRlHVZTE' },
};

const $ = (s) => document.querySelector(s);
let apiPromise = null;
let player = null;
let film = null;   // { city, id, ready: bool (playing, past YouTube's start-up overlays), shown: bool }
let mine = 0;      // which visit the current player belongs to, so a late callback from an old one does nothing
let ticker = 0;
let idleStop = 0;

const wantsFilm = () =>
  !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;

// Load YouTube's IFrame API once. Resolves to window.YT, or null if it can't load in time.
function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { apiPromise = null; resolve(null); };
    document.head.appendChild(s);
    setTimeout(() => resolve(window.YT?.Player ? window.YT : null), 12000);
  });
  return apiPromise;
}

function layer() {
  let el = $('#filmLayer');
  if (!el) {
    document.body.insertAdjacentHTML('beforeend',
      '<div class="film-layer" id="filmLayer" aria-hidden="true"><div class="film-box" id="filmBox"></div></div>');
    el = $('#filmLayer');
  }
  return el;
}

// Load YouTube's player script early (when the browser is idle after the page loads), so a city's film can
// start the moment its gate is picked.
export function preloadFilm() {
  if (!wantsFilm()) return;
  const go = () => loadApi();
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2000);
}

// Start the city's film, hidden, as soon as its gate is picked. Never waits.
export function warmFilm(cityId) {
  if (film?.city === cityId) return;
  stopFilm();
  const f = FILMS[cityId];
  if (!f || !wantsFilm()) return;
  const my = ++mine;
  film = { city: cityId, id: f.id, ready: false, shown: false };
  layer().classList.add('warming');
  const box = layer().querySelector('#filmBox');
  box.innerHTML = '<div id="filmPlayer"></div>';
  // if the visitor never reaches the city (they turned back), don't keep streaming a hidden video
  idleStop = setTimeout(() => { if (my === mine && !film?.shown) stopFilm(); }, 45000);
  loadApi().then((YT) => {
    if (!YT || my !== mine) return;
    let target = 0;
    const jump = (p) => {
      const d = p.getDuration() || 0;
      // somewhere between 5% and 85% of the way in, so it never lands on the intro or the end card
      target = d > 60 ? Math.floor(d * (0.05 + Math.random() * 0.8)) : 0;
      p.seekTo(target, true);
      p.playVideo();
    };
    // Ready = playing at the chosen point for 3.5 s, so YouTube's play/pause button and spinner, which it shows
    // for the first seconds of playback, have already come and gone while the video was hidden. Near the end it jumps to a new random point (hidden meanwhile)
    // instead of letting the video end and show YouTube's end screen.
    const tick = () => {
      if (my !== mine || !player?.getCurrentTime) return;
      const t = player.getCurrentTime(), d = player.getDuration() || 0;
      const playing = player.getPlayerState?.() === YT.PlayerState.PLAYING;
      if (d > 60 && t > d - 6) {
        film.ready = false;
        layer().classList.remove('playing');
        jump(player);
      } else if (!film.ready && playing && t > target + 3.5) {
        film.ready = true;
        layer().classList.add('playing');
        if (film.shown) reveal();
      }
    };
    player = new YT.Player('filmPlayer', {
      host: 'https://www.youtube-nocookie.com',
      videoId: film.id,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0, mute: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0,
        modestbranding: 1, origin: location.origin,
      },
      events: {
        onReady: (e) => {
          if (my !== mine) return;
          e.target.mute();
          e.target.getIframe()?.setAttribute('tabindex', '-1');
          e.target.getIframe()?.setAttribute('title', 'City film (background)');
          jump(e.target);
          clearInterval(ticker);
          ticker = setInterval(tick, 250);
        },
        onStateChange: (e) => {
          if (my !== mine) return;
          // a stall or pause hides it again until it is properly playing
          if (e.data === YT.PlayerState.ENDED) { film.ready = false; layer().classList.remove('playing'); jump(e.target); }
        },
        onError: () => { if (my === mine) stopFilm(); },
      },
    });
  });
}

// The city view opens: show the film if it's playing, else as soon as it is (the drawing shows meanwhile).
export function showFilm(cityId) {
  if (film?.city !== cityId) warmFilm(cityId);
  if (!film) return;
  film.shown = true;
  layer().classList.add('shown');
  if (film.ready) reveal();
}

// Put the film on screen: the city view turns see-through and the drawn scene fades out over it.
function reveal() {
  $('#city')?.classList.add('film-on');
  showCredit();
}

// While the arch opens, the film is clipped to the same arch as the city view.
export function clipFilm(path) {
  const el = $('#filmLayer');
  if (el) el.style.clipPath = path;
}

function showCredit() {
  const credit = $('#filmCredit');
  if (!credit || !player) return;
  const data = player.getVideoData?.() || {};
  const t = Math.floor(player.getCurrentTime?.() || 0);
  const a = document.createElement('a');
  a.href = `https://www.youtube.com/watch?v=${film.id}&t=${t}s`;
  a.target = '_blank';
  a.rel = 'noopener';
  const title = document.createElement('b');
  title.textContent = data.title || 'Watch on YouTube';
  a.append('Film: ', title);
  if (data.author) {
    const by = document.createElement('span');
    by.textContent = data.author;
    a.append(by);
  }
  credit.replaceChildren(a);
  credit.hidden = false;
}

// Fade the film out (the scroll has opened). The city view takes its own background back once it has.
export function fadeFilm() {
  const el = $('#filmLayer');
  if (!el || !film) return;
  el.classList.add('leaving');
  setTimeout(() => { if (el.classList.contains('leaving')) stopFilm(); }, 1300);
}

// Stop and remove the film (after it fades, or when the visitor goes back).
export function stopFilm() {
  mine++;
  film = null;
  clearInterval(ticker);
  clearTimeout(idleStop);
  const el = $('#filmLayer'), credit = $('#filmCredit');
  if (credit) credit.hidden = true;
  $('#city')?.classList.remove('film-on');
  try { player?.destroy(); } catch { /* already gone */ }
  player = null;
  if (el) {
    el.className = 'film-layer';
    el.style.clipPath = '';
    el.querySelector('#filmBox').innerHTML = '';
  }
}
