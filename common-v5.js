(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  const topButton = document.querySelector('.back-to-top');
  const sound = document.querySelector('.sound-toggle');
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
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  nav?.addEventListener('click', event => {
    if (event.target.closest('a')) nav.classList.remove('open');
  });
  sound?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    sound.classList.toggle('active', soundEnabled);
    sound.setAttribute('aria-pressed', String(soundEnabled));
    window.uiBeep(840, .06);
  });

  const updateTopButton = () => topButton?.classList.toggle('visible', scrollY > 620);
  addEventListener('scroll', updateTopButton, { passive: true });
  topButton?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  updateTopButton();

  const fixPlayer = player => {
    const display = player.querySelector('.egg-player-display');
    const title = display?.querySelector('span');
    if (!display || !title) return;
    display.style.overflow = 'hidden';
    title.getAnimations().forEach(animation => animation.cancel());
    title.style.animation = 'none';
    title.style.transform = 'none';
    title.style.display = 'block';
    title.style.maxWidth = '100%';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.title = title.textContent.trim();
  };
  document.querySelectorAll('.egg-player').forEach(fixPlayer);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches('.egg-player')) fixPlayer(node);
    node.querySelectorAll?.('.egg-player').forEach(fixPlayer);
  }))).observe(document.body, { childList: true, subtree: true });
})();
