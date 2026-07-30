(() => {
  'use strict';

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'design-v3.css?v=3.0.0';
  document.head.append(stylesheet);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  body.classList.add('design-v3');

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', '#120c08');

  const materialByName = name => {
    const normalized = name.toLowerCase();
    return MATERIALS.find(material => material.name.toLowerCase() === normalized)
      || MATERIALS.find(material => material.name.toLowerCase().includes(normalized))
      || MATERIALS.find(material => normalized.includes(material.name.toLowerCase()));
  };

  function openMaterial(name) {
    const material = materialByName(name);
    if (!material) return;
    if (typeof window.openDetails === 'function') {
      window.openDetails(material.name);
      return;
    }
    const card = [...document.querySelectorAll('.material-card')]
      .find(item => item.dataset.name === material.name);
    card?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    card?.click();
  }

  function addNavIcons() {
    const icons = ['▦', '⇄', '✦', '◆'];
    document.querySelectorAll('.nav a').forEach((link, index) => {
      link.dataset.icon = icons[index] || '▪';
    });
  }

  function addWorkshopLife() {
    const workshop = document.querySelector('.workshop');
    if (!workshop || workshop.querySelector('.v3-lamp')) return;

    const lamp = document.createElement('div');
    lamp.className = 'v3-lamp';
    lamp.setAttribute('aria-hidden', 'true');
    lamp.innerHTML = '<i class="v3-chain"></i><i class="v3-shade"></i><i class="v3-bulb"></i><i class="v3-light"></i>';

    const mascot = document.createElement('div');
    mascot.className = 'v3-mascot';
    mascot.setAttribute('aria-hidden', 'true');
    mascot.innerHTML = '<i class="v3-tail"></i><i class="v3-body"></i><i class="v3-head"><b></b><b></b><em></em></i><i class="v3-foot a"></i><i class="v3-foot b"></i><span>PRINT!</span>';

    const steam = document.createElement('div');
    steam.className = 'v3-steam';
    steam.setAttribute('aria-hidden', 'true');
    steam.innerHTML = '<i></i><i></i><i></i>';

    const sparks = document.createElement('div');
    sparks.className = 'v3-printer-sparks';
    sparks.setAttribute('aria-hidden', 'true');
    sparks.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';

    workshop.append(lamp, mascot, steam, sparks);
  }

  function addBlockField() {
    if (reduceMotion || document.querySelector('.v3-block-field')) return;
    const field = document.createElement('div');
    field.className = 'v3-block-field';
    field.setAttribute('aria-hidden', 'true');
    const colors = ['#d39242', '#6e9f55', '#4aa3a0', '#9a6f47', '#d6b167', '#8667a8'];
    const count = window.innerWidth < 700 ? 12 : 28;
    for (let index = 0; index < count; index += 1) {
      const block = document.createElement('i');
      const size = 4 + Math.floor(Math.random() * 8);
      block.style.left = `${Math.random() * 100}%`;
      block.style.top = `${Math.random() * 100}%`;
      block.style.width = `${size}px`;
      block.style.height = `${size}px`;
      block.style.setProperty('--block-color', colors[index % colors.length]);
      block.style.setProperty('--block-time', `${16 + Math.random() * 22}s`);
      block.style.setProperty('--block-delay', `${-Math.random() * 30}s`);
      block.style.setProperty('--block-drift', `${-35 + Math.random() * 70}px`);
      field.append(block);
    }
    body.prepend(field);
  }

  function makeFeaturedSection() {
    if (document.querySelector('.v3-dashboard')) return;
    const ticker = document.querySelector('.ticker');
    const catalog = document.querySelector('#catalog');
    if (!ticker || !catalog) return;

    const requested = [
      'PLA', 'PLA+', 'HT-PLA', 'PETG', 'PCTG', 'ABS',
      'ASA', 'HIPS', 'TPU 95A', 'TPE', 'PA6', 'PA12',
      'CoPA', 'PC', 'PC-ABS', 'PP', 'POM', 'PEI',
      'PEEK', 'PEKK', 'PVB', 'SBS', 'CPE', 'PETT'
    ];
    const featured = requested
      .map(materialByName)
      .filter((material, index, list) => material && list.indexOf(material) === index)
      .slice(0, 24);

    const specialItems = [
      ['CF', '▧', 'карбон'], ['GF', '◫', 'стекло'], ['Wood', '▥', 'дерево'],
      ['Metal', '●', 'металл'], ['Glow', '✦', 'светится'], ['Conductive', 'ϟ', 'проводящий'],
      ['ESD', '⚠', 'антистатик'], ['FR', '♨', 'огнестойкий'], ['LW-PLA', '↟', 'лёгкий'],
      ['Magnetic', '∩', 'магнитный'], ['Antibacterial', '✚', 'антибактериальный'],
      ['Castable', '♜', 'выжигаемый'], ['PVA', '◉', 'растворимый'], ['BVOH', '≋', 'водорастворимый'],
      ['Breakaway', '✂', 'отрывной'], ['AquaSys', '≈', 'industrial support']
    ];

    const section = document.createElement('section');
    section.className = 'v3-dashboard shell';
    section.innerHTML = `
      <div class="v3-frame v3-popular-panel">
        <div class="v3-panel-title"><span>★</span><h2>Популярные пластики</h2><i></i></div>
        <div class="v3-feature-grid">
          ${featured.map((material, index) => `
            <button class="v3-feature-card" type="button" data-material="${material.name}" style="--accent:${material.color};--delay:${index * 45}ms">
              <span class="v3-mini-spool"><i></i></span>
              <span><b>${material.name}</b><small>${material.desc}</small></span>
            </button>`).join('')}
        </div>
      </div>
      <div class="v3-frame v3-special-panel">
        <div class="v3-panel-title"><span>⚗</span><h2>Специальные и композитные</h2><i></i></div>
        <div class="v3-special-grid">
          ${specialItems.map(([query, icon, text], index) => `
            <button class="v3-special-card" type="button" data-query="${query}" style="--delay:${index * 38}ms">
              <b>${icon}</b><strong>${query}</strong><small>${text}</small>
            </button>`).join('')}
        </div>
      </div>`;

    ticker.insertAdjacentElement('afterend', section);

    section.addEventListener('click', event => {
      const feature = event.target.closest('[data-material]');
      if (feature) {
        openMaterial(feature.dataset.material);
        return;
      }
      const special = event.target.closest('[data-query]');
      if (!special) return;
      const search = document.querySelector('#searchInput');
      if (search) {
        search.value = special.dataset.query;
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('#catalog')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function addBackToTop() {
    if (document.querySelector('.v3-to-top')) return;
    const button = document.createElement('button');
    button.className = 'v3-to-top';
    button.type = 'button';
    button.setAttribute('aria-label', 'Вернуться наверх');
    button.innerHTML = '<i></i><span>↑</span><small>TOP</small>';
    body.append(button);

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      button.style.setProperty('--page-progress', `${ratio * 360}deg`);
      button.classList.toggle('visible', window.scrollY > Math.max(520, window.innerHeight * .65));
    };
    window.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    update();
  }

  function burst(x, y, color = '#e4a448') {
    if (reduceMotion) return;
    const group = document.createElement('div');
    group.className = 'v3-block-burst';
    group.style.left = `${x}px`;
    group.style.top = `${y}px`;
    group.style.setProperty('--burst-color', color);
    for (let index = 0; index < 9; index += 1) {
      const particle = document.createElement('i');
      const angle = (Math.PI * 2 * index) / 9 + Math.random() * .35;
      const distance = 28 + Math.random() * 42;
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      particle.style.setProperty('--spin', `${90 + Math.random() * 260}deg`);
      particle.style.animationDelay = `${index * 14}ms`;
      group.append(particle);
    }
    body.append(group);
    window.setTimeout(() => group.remove(), 900);
  }

  function bindBlockBursts() {
    document.addEventListener('pointerdown', event => {
      const target = event.target.closest('.pixel-btn,.material-card,.quest-card,.tip-note,.v3-feature-card,.v3-special-card,.rule-card');
      if (!target) return;
      const color = getComputedStyle(target).getPropertyValue('--accent').trim() || '#e4a448';
      burst(event.clientX, event.clientY, color);
    }, { passive: true });
  }

  function addCardObserver() {
    const grid = document.querySelector('#materialsGrid');
    if (!grid) return;
    const decorate = card => {
      if (!(card instanceof HTMLElement) || card.dataset.v3Decorated) return;
      card.dataset.v3Decorated = '1';
      const top = card.querySelector('.card-top');
      if (top) {
        const glint = document.createElement('i');
        glint.className = 'v3-card-glint';
        top.append(glint);
      }
    };
    grid.querySelectorAll('.material-card').forEach(decorate);
    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof HTMLElement && node.matches('.material-card')) decorate(node);
      }));
    }).observe(grid, { childList: true });
  }

  function addSectionMarkers() {
    const marks = ['BASE', 'COMPARE', 'SUPPORT', 'TIPS', 'QUEST'];
    document.querySelectorAll('main > .section, main > section.section').forEach((section, index) => {
      if (section.querySelector(':scope > .v3-section-code')) return;
      const code = document.createElement('span');
      code.className = 'v3-section-code';
      code.textContent = marks[index] || `AREA-${index + 1}`;
      section.append(code);
    });
  }

  addNavIcons();
  addWorkshopLife();
  addBlockField();
  makeFeaturedSection();
  addBackToTop();
  bindBlockBursts();
  addCardObserver();
  addSectionMarkers();
})();
