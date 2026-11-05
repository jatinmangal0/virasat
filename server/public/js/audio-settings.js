// Sound settings in one place. To change the background music, replace MUSIC_URL with the new file's address.
//   Best: put the file in server/public/assets/ (e.g. 'assets/music.mp3') or on Cloudinary (https://res.cloudinary.com/...).
//   Any other website also needs adding to "media-src" in vercel.json, or the browser will refuse to play it.
//   '' means no music; footsteps and the other sounds still play.
// The music file is fetched only after the visitor's first click or tap, and only while sound is on.
export const MUSIC_URL = '';

// Loudness, from 0 (silent) to 1 (full). Music stays low so Gaju's footsteps are heard over it.
export const MUSIC_VOLUME = 0.12;
export const FOOTSTEP_VOLUME = 0.55;
