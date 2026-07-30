(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  async function loadSpriteAtlases() {
    try {
      const [hero, ui] = await Promise.all([
        fetch('assets/sprites/hero-v8.b64?v=8.0.1').then(response => { if (!response.ok) throw new Error('hero atlas'); return response.text(); }),
        fetch('assets/sprites/ui-v8.b64?v=8.0.1').then(response => { if (!response.ok) throw new Error('ui atlas'); return response.text(); })
      ]);
      document.documentElement.style.setProperty('--hero-atlas', `url("data:image/webp;base64,${hero.trim()}")`);
      document.documentElement.style.setProperty('--ui-atlas', `url("data:image/webp;base64,${ui.trim()}")`);
      document.documentElement.classList.add('sprites-ready');
    } catch (error) {
      console.warn('Sprite atlases were not loaded', error);
    }
  }
  loadSpriteAtlases();
  const popular = [
    ['PLA',0,'Лёгкий старт и отличное качество'],
    ['PETG',1,'Прочный и универсальный'],
    ['ABS',2,'Прочный и термостойкий'],
    ['ASA',3,'Устойчив к УФ и погоде'],
    ['TPU 95A',4,'Гибкий и эластичный'],
    ['PA6 Nylon',5,'Прочный и износостойкий'],
    ['PC',6,'Ударопрочный инженерный пластик'],
    ['PEEK',7,'Промышленный максимум']
  ];
  const specials = ['CF','GF','Wood','Metal','Glow','Conductive','ESD','FR','LW-PLA','Magnetic','Antibacterial','Castable','PVA','BVOH','Breakaway','AquaSys'];
  const ratings = ['PLA','PETG','ABS','ASA','TPU 95A','PA6 Nylon','PC','PEEK'];
  const supports = [
    ['PLA','⇄','PETG'],['PETG','⇄','PLA'],['PLA','→','PVA / BVOH'],['ABS / ASA','→','HIPS'],
    ['Nylon / PA','→','Support for PA'],['PC','→','High-temp support'],['PP','→','Support for PP'],['PEEK / PEKK','→','Industrial support']
  ];
  const quick = [
    ['Для новичка','PLA','Легко печатать и настраивать',0],
    ['Для функционала','PETG','Универсальный и надёжный',1],
    ['Для улицы','ASA','Устойчив к солнцу и погоде',2],
    ['Для гибких деталей','TPU 95A','Эластичный и износостойкий',3],
    ['Для высокой нагрузки','PA / PC','Прочность и жёсткость',4],
    ['Для максимума','PEEK / PEKK','Промышленный уровень',5]
  ];
  const findMaterial = name => {
    const query = name.toLowerCase();
    return MATERIALS.find(item => item.name.toLowerCase() === query)
      || MATERIALS.find(item => item.name.toLowerCase().includes(query))
      || MATERIALS.find(item => query.includes(item.name.toLowerCase()));
  };
  const stars = value => `<span class="stars" aria-label="${value} из 5">${'★'.repeat(value)}${'☆'.repeat(5-value)}</span>`;
  const difficulty = value => ['', 'Просто', 'Средне', 'Сложно', 'Промышленно'][value] || '—';

  function renderPopular() {
    $('#materialCount').textContent = MATERIALS.length;
    $('#popularGrid').innerHTML = popular.map(([name,index,caption]) => {
      const material = findMaterial(name);
      return `<button class="popular-card" type="button" data-material="${material?.name || name}">
        <span class="ui-sprite spool-${index}" aria-hidden="true"></span>
        <span><b>${name.replace(' 95A','')}</b><small>${caption}</small></span>
      </button>`;
    }).join('');
  }
  function renderSpecials() {
    $('#specialGrid').innerHTML = specials.map((name,index) => `<a class="special-card" href="materials.html?q=${encodeURIComponent(name)}">
      <span class="ui-sprite special-${index}" aria-hidden="true"></span><b>${name}</b>
    </a>`).join('');
  }
  function renderRatings() {
    $('#ratingTable').innerHTML = ratings.map(name => {
      const material = findMaterial(name);
      if (!material) return '';
      const ease = 5 - material.difficulty;
      return `<tr><th>${name.replace(' 95A','').replace('6 Nylon',' (Nylon)')}</th><td>${stars(material.strength)}</td><td>${stars(material.flex)}</td><td>${stars(material.heat)}</td><td>${stars(ease)}</td></tr>`;
    }).join('');
  }
  function renderSupports() {
    $('#supportPairs').innerHTML = supports.map(([left,arrow,right]) => `<div><b>${left}</b><i>${arrow}</i><span>${right}</span></div>`).join('');
  }
  function renderQuick() {
    $('#quickGrid').innerHTML = quick.map(([title,material,caption,index]) => `<a class="quick-card" href="materials.html?q=${encodeURIComponent(material)}">
      <span class="ui-sprite quick-${index}" aria-hidden="true"></span>
      <span><small>${title}</small><b>${material}</b><p>${caption}</p></span>
    </a>`).join('');
  }
  function openMaterial(name) {
    const material = findMaterial(name);
    if (!material) return;
    $('#dialogContent').innerHTML = `<div class="dialog-title" style="--accent:${material.color}">
      <span class="dialog-spool" style="--accent:${material.color}"><i></i></span>
      <div><small>${material.family}</small><h2>${material.name}</h2></div></div>
      <p class="dialog-description">${material.desc}</p>
      <div class="detail-grid"><span><small>Сопло</small><b>${material.nozzle} °C</b></span><span><small>Стол</small><b>${material.bed} °C</b></span><span><small>Камера</small><b>${material.chamber}</b></span><span><small>Сушка</small><b>${material.dry}</b></span></div>
      <div class="dialog-ratings"><span>Прочность ${stars(material.strength)}</span><span>Гибкость ${stars(material.flex)}</span><span>Тепло ${stars(material.heat)}</span><span>Сложность <b>${difficulty(material.difficulty)}</b></span></div>
      <div class="dialog-columns"><div><small>Подходит для</small><ul>${material.uses.map(use => `<li>${use}</li>`).join('')}</ul></div><div><small>Поддержки</small><p>${material.support}</p><a href="supports.html?material=${encodeURIComponent(material.name)}">Подобрать поддержку →</a></div></div>`;
    $('#materialDialog').showModal();
  }
  function bindEvents() {
    $('.menu-toggle').addEventListener('click', () => {
      const open = $('.nav').classList.toggle('open');
      $('.menu-toggle').setAttribute('aria-expanded', String(open));
    });
    $('.nav').addEventListener('click', event => { if (event.target.closest('a')) $('.nav').classList.remove('open'); });
    $('#popularGrid').addEventListener('click', event => {
      const card = event.target.closest('[data-material]');
      if (card) openMaterial(card.dataset.material);
    });
    $('.dialog-close').addEventListener('click', () => $('#materialDialog').close());
    $('#materialDialog').addEventListener('click', event => { if (event.target === $('#materialDialog')) $('#materialDialog').close(); });
    $('#backToTop').addEventListener('click', () => scrollTo({top:0,behavior:'smooth'}));
    addEventListener('scroll', () => $('#backToTop').classList.toggle('visible', scrollY > 700), {passive:true});
  }
  renderPopular(); renderSpecials(); renderRatings(); renderSupports(); renderQuick(); bindEvents();
})();
