// The standalone music sample page.
import { createMusic } from './music.js';

const music = createMusic();
const labels = { hall: 'Now playing: The Hall', battle: 'Now playing: Battle', lament: 'Now playing: Lament' };
const now = document.getElementById('now');

function show() {
  for (const b of document.querySelectorAll('[data-mood]')) b.setAttribute('aria-pressed', String(music.playing && music.mood === b.dataset.mood));
  now.textContent = music.playing ? labels[music.mood] : '';
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.mood) { if (music.playing) music.setMood(b.dataset.mood); else music.start(b.dataset.mood); }
  if (b.dataset.sting) music.sting(b.dataset.sting);
  if (b.id === 'stop') music.stop();
  show();
});
document.getElementById('vol').addEventListener('input', (e) => music.setVolume(Number(e.target.value)));
