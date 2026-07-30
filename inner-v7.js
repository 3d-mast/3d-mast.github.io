(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('.top-nav');
  const topButton = document.querySelector('.back-to-top');
  let soundEnabled = false;

  window.uiBeep = (frequency = 520, duration = .035) => {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.value = .018;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.addEventListener('ended', () => context.close(), { once: true });
  };

  menu?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(Boolean(open)));
  });
  nav?.addEventListener('click', event => {
    if (event.target.closest('a')) nav.classList.remove('open');
  });
  document.querySelector('[data-sound]')?.addEventListener('click', event => {
    soundEnabled = !soundEnabled;
    event.currentTarget.classList.toggle('active', soundEnabled);
    event.currentTarget.setAttribute('aria-pressed', String(soundEnabled));
    window.uiBeep(840, .06);
  });

  const updateTopButton = () => topButton?.classList.toggle('visible', scrollY > 520);
  addEventListener('scroll', updateTopButton, { passive: true });
  topButton?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  updateTopButton();
})();