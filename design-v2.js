(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('design-v2');

  function addProgress() {
    const bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.append(bar);

    let queued = false;
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.transform = `scaleX(${value})`;
    };
    window.addEventListener('scroll', () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function addAmbientPixels() {
    if (reduceMotion) return;
    const layer = document.createElement('div');
    layer.className = 'ambient-pixels';
    layer.setAttribute('aria-hidden', 'true');
    const colors = ['#ffc95e', '#55d3bd', '#f1854e', '#9f83e7'];
    for (let i = 0; i < 18; i += 1) {
      const pixel = document.createElement('i');
      pixel.style.left = `${3 + Math.random() * 94}%`;
      pixel.style.top = `${Math.random() * 100}%`;
      pixel.style.setProperty('--pixel-color', colors[i % colors.length]);
      pixel.style.setProperty('--pixel-speed', `${13 + Math.random() * 16}s`);
      pixel.style.setProperty('--pixel-delay', `${-Math.random() * 20}s`);
      layer.append(pixel);
    }
    document.body.prepend(layer);
  }

  function addHeroStatus() {
    const copy = document.querySelector('.hero-copy');
    if (!copy || copy.querySelector('.hero-status')) return;
    const status = document.createElement('div');
    status.className = 'hero-status';
    status.innerHTML = '<i></i><span>DATABASE ONLINE · MATERIAL PROFILES LOADED · SUPPORT MATRIX READY</span>';
    copy.append(status);
  }

  function addPointerLight() {
    if (reduceMotion || !window.matchMedia('(pointer:fine)').matches) return;
    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    window.addEventListener('pointermove', event => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          document.body.style.setProperty('--mx', `${x}px`);
          document.body.style.setProperty('--my', `${y}px`);
        });
      }
    }, { passive: true });
  }

  function addWorkshopParallax() {
    const workshop = document.querySelector('.workshop');
    if (!workshop || reduceMotion || !window.matchMedia('(pointer:fine)').matches) return;
    workshop.addEventListener('pointermove', event => {
      const rect = workshop.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      workshop.style.transform = `perspective(1000px) rotateY(${x * 3 - 1.4}deg) rotateX(${-y * 2 + .7}deg) translateY(-2px)`;
    });
    workshop.addEventListener('pointerleave', () => {
      workshop.style.transform = '';
    });
  }

  function revealNode(node, observer) {
    if (!(node instanceof HTMLElement) || node.classList.contains('reveal-item')) return;
    node.classList.add('reveal-item');
    observer.observe(node);
  }

  function addRevealAnimations() {
    const selector = '.material-card,.tip-note,.rule-card,.quest-card,.compare-tray,.support-picker';
    if (reduceMotion || !('IntersectionObserver' in window)) {
      document.querySelectorAll(selector).forEach(node => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -35px' });

    document.querySelectorAll(selector).forEach(node => revealNode(node, observer));
    const grid = document.querySelector('#materialsGrid');
    if (grid) {
      new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node instanceof HTMLElement && node.matches('.material-card')) revealNode(node, observer);
        }));
      }).observe(grid, { childList: true });
    }
  }

  function protectWinampTitle() {
    const fix = player => {
      const title = player.querySelector('.egg-player-display > span');
      if (!title) return;
      title.getAnimations().forEach(animation => animation.cancel());
      title.style.animation = 'none';
      title.style.transform = 'none';
      title.title = title.textContent.trim();
    };
    document.querySelectorAll('.egg-player').forEach(fix);
    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.egg-player')) fix(node);
        node.querySelectorAll?.('.egg-player').forEach(fix);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  addProgress();
  addAmbientPixels();
  addHeroStatus();
  addPointerLight();
  addWorkshopParallax();
  addRevealAnimations();
  protectWinampTitle();
})();
