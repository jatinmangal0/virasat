// The film behind a city's arrival: a muted, looping YouTube video of the city, embedded (never downloaded or
// re-hosted), starting at a random point each visit, with the video's title and channel credited at the side.
// The drawn city scene (hero.js) stays underneath: it shows while the video loads, and stays if YouTube is
// blocked, slow, or the video can't be embedded. Visitors who ask for less motion or less data get the drawing.
const FILMS = {
  kolkata: { id: 'tYY4WnfEEkY' },
  udaipur: { id: '-w5oRlHVZTE' },
};

const $ = (s) => document.querySelector(s);
let apiPromise = null;
let player = null;
let mine = 0; // which visit the current player belongs to, so a late callback from an old one does nothing

const wantsFilm = () =>
  !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;

// Load YouTube's IFrame API once. Resolves to window.YT, or null if it can't load in time.
export function loadFilmApi() {
  if (!wantsFilm()) return Promise.resolve(null);
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

// Start the city's film behind the arrival. Never waits: the drawing shows until the video is really playing.
export function startFilm(cityId) {
  stopFilm();
  const film = FILMS[cityId];
  const box = $('#cityFilm'), credit = $('#filmCredit');
  if (!film || !box || !wantsFilm()) return;
  const my = ++mine;
  box.innerHTML = '<div id="filmPlayer"></div>';
  credit.hidden = true;
  loadFilmApi().then((YT) => {
    if (!YT || my !== mine) return;
    let target = 0, shown = false;
    const pickStart = (p) => {
      const d = p.getDuration() || 0;
      // somewhere between 5% and 85% of the way in, so it never lands on the intro or the end card
      target = d > 60 ? Math.floor(d * (0.05 + Math.random() * 0.8)) : 0;
      p.seekTo(target, true);
      p.playVideo();
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
          pickStart(e.target);
        },
        onStateChange: (e) => {
          if (my !== mine) return;
          const p = e.target;
          if (e.data === YT.PlayerState.ENDED) return pickStart(p); // loop, from a new random point
          // show the film only once it is playing at the chosen point, never the first frames of the video
          if (e.data === YT.PlayerState.PLAYING && !shown && Math.abs(p.getCurrentTime() - target) < 8) {
            shown = true;
            box.classList.add('on');
            showCredit(p, film);
          }
        },
        onError: () => { if (my === mine) stopFilm(); },
      },
    });
  });
}

function showCredit(p, film) {
  const credit = $('#filmCredit');
  const data = p.getVideoData?.() || {};
  const t = Math.floor(p.getCurrentTime?.() || 0);
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

// Stop and remove the film (when the scroll opens and the scene fades, or the visitor goes back).
export function stopFilm() {
  mine++;
  const box = $('#cityFilm'), credit = $('#filmCredit');
  box?.classList.remove('on');
  if (credit) credit.hidden = true;
  try { player?.destroy(); } catch { /* already gone */ }
  player = null;
  if (box) box.innerHTML = '';
}
