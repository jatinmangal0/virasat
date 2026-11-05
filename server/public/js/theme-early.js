// Runs in the <head>, before anything is drawn, so a page never flashes the wrong theme.
// Dark or light is the visitor's own choice (saved by night.js); on a first visit it follows the device.
(function () {
  var saved = null, dark = false;
  try { saved = localStorage.getItem('virasat-night'); } catch (e) {}
  if (saved === '1') dark = true;
  else if (saved === null) { try { dark = matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {} }
  if (!dark) return;
  var html = document.documentElement;
  html.classList.add('dark');
  // the rest of the site's dark styles hang on body.is-night: set it the moment <body> exists
  var mark = function () { if (!document.body) return false; document.body.classList.add('is-night'); return true; };
  if (!mark()) { var mo = new MutationObserver(function () { if (mark()) mo.disconnect(); }); mo.observe(html, { childList: true }); }
})();
