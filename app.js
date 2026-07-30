const state = { family: 'all', difficulty: 'all', query: '', compare: [] };
const els = {
  grid: document.querySelector('#materialsGrid'),
  family: document.querySelector('#familyFilter'),
  difficulty: document.querySelector('#difficultyFilter'),
  search: document.querySelector('#searchInput'),
  reset: document.querySelector('#resetFilters'),
  visible: document.querySelector('#visibleCount'),
  total: document.querySelector('#materialCount'),
  empty: document.querySelector('#emptyState'),
  chips: document.querySelector('#familyChips'),
  dialog: document.querySelector('#materialDialog'),
  dialogContent: document.querySelector('#dialogContent'),
  compare: document.querySelector('#compareTray'),
  clearCompare: document.querySelector('#clearCompare'),
  modelMaterial: document.querySelector('#modelMaterial'),
  supportResult: document.querySelector('#supportResult'),
  questGrid: document.querySelector('#questGrid'),
  questResult: document.querySelector('#questResult'),
  menuToggle: document.querySelector('.menu-toggle'),
  nav: document.querySelector('.nav'),
  sound: document.querySelector('.sound-toggle')
};

let soundEnabled = false;
const families = [...new Set(MATERIALS.map(material => material.family))]
  .sort((a, b) => a.localeCompare(b, 'ru'));

function stars(value, max = 5) {
  return `<span class="rating" aria-label="${value} из ${max}">${'■'.repeat(value)}${'□'.repeat(max - value)}</span>`;
}

function difficultyLabel(value) {
  return ['', 'Просто', 'Средне', 'Сложно', 'Промышленно'][value] || '—';
}

function beep(freq = 440, duration = 0.035) {
  if (!soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.value = 0.025;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  osc.addEventListener('ended', () => ctx.close(), { once: true });
}

function fillFilters() {
  els.total.textContent = MATERIALS.length;
  families.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    els.family.append(option);
  });

  const all = document.createElement('button');
  all.className = 'chip active';
  all.dataset.family = 'all';
  all.textContent = 'Все';
  els.chips.append(all);

  families.forEach(name => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.dataset.family = name;
    button.textContent = name;
    els.chips.append(button);
  });
}

function materialMatches(material) {
  const haystack = [
    material.name,
    material.family,
    material.desc,
    ...material.uses,
    material.support
  ].join(' ').toLowerCase();

  return (state.family === 'all' || material.family === state.family)
    && (state.difficulty === 'all' || String(material.difficulty) === state.difficulty)
    && (!state.query || haystack.includes(state.query));
}

function renderMaterials() {
  const list = MATERIALS.filter(materialMatches);
  els.visible.textContent = list.length;
  els.empty.hidden = list.length !== 0;
  els.grid.innerHTML = list.map(material => `
    <article class="material-card" style="--accent:${material.color}" tabindex="0" data-name="${material.name}">
      <div class="card-top">
        <span class="spool-icon" aria-hidden="true"><i></i></span>
        <span class="family-tag">${material.family}</span>
      </div>
      <h3>${material.name}</h3>
      <p>${material.desc}</p>
      <div class="temp-row">
        <span>Сопло <b>${material.nozzle}°</b></span>
        <span>Стол <b>${material.bed}°</b></span>
      </div>
      <div class="card-stats">
        <span title="Прочность">STR ${stars(material.strength)}</span>
        <span title="Теплостойкость">HEAT ${stars(material.heat)}</span>
      </div>
      <div class="card-actions">
        <button class="details-btn" data-action="details" type="button">Подробнее</button>
        <button class="compare-btn ${state.compare.includes(material.name) ? 'active' : ''}" data-action="compare" type="button">
          ${state.compare.includes(material.name) ? '✓ В сравнении' : '+ Сравнить'}
        </button>
      </div>
    </article>`).join('');
}

function openDetails(name) {
  const material = MATERIALS.find(item => item.name === name);
  if (!material) return;

  els.dialogContent.innerHTML = `
    <div class="dialog-title" style="--accent:${material.color}">
      <span class="spool-icon big"><i></i></span>
      <div><small>${material.family}</small><h2>${material.name}</h2></div>
    </div>
    <p class="dialog-desc">${material.desc}</p>
    <div class="detail-grid">
      <span><small>Сопло</small><b>${material.nozzle} °C</b></span>
      <span><small>Стол</small><b>${material.bed} °C</b></span>
      <span><small>Камера</small><b>${material.chamber}</b></span>
      <span><small>Сушка</small><b>${material.dry}</b></span>
    </div>
    <div class="stat-bars">
      ${['strength', 'flex', 'heat'].map((key, index) => {
        const labels = ['Прочность', 'Гибкость', 'Теплостойкость'];
        return `<div><span>${labels[index]}</span><i><b style="width:${material[key] * 20}%"></b></i><em>${material[key]}/5</em></div>`;
      }).join('')}
      <div><span>Сложность</span><i><b style="width:${material.difficulty * 25}%"></b></i><em>${difficultyLabel(material.difficulty)}</em></div>
    </div>
    <div class="dialog-columns">
      <div><small>Подходит для</small><ul>${material.uses.map(use => `<li>${use}</li>`).join('')}</ul></div>
      <div><small>Интерфейс поддержек</small><p>${material.support}</p></div>
    </div>`;

  els.dialog.showModal();
  beep(640);
}

function toggleCompare(name) {
  if (state.compare.includes(name)) {
    state.compare = state.compare.filter(item => item !== name);
  } else if (state.compare.length < 3) {
    state.compare.push(name);
  } else {
    els.compare.animate(
      [{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: 180 }
    );
    beep(150, 0.08);
    return;
  }
  renderMaterials();
  renderCompare();
  beep(520);
}

function renderCompare() {
  if (!state.compare.length) {
    els.compare.innerHTML = '<div class="compare-placeholder">Пока пусто. Выбери материалы в каталоге.</div>';
    return;
  }

  const list = state.compare
    .map(name => MATERIALS.find(material => material.name === name))
    .filter(Boolean);

  els.compare.innerHTML = `
    <div class="compare-table" style="--cols:${list.length}">
      <div class="compare-labels">
        <b>Параметр</b><span>Сопло</span><span>Стол</span><span>Сушка</span><span>Прочность</span><span>Гибкость</span><span>Тепло</span><span>Сложность</span><span>Support</span>
      </div>
      ${list.map(material => `
        <div class="compare-column" style="--accent:${material.color}">
          <b>${material.name}<button data-remove="${material.name}" aria-label="Убрать ${material.name}">×</button></b>
          <span>${material.nozzle} °C</span><span>${material.bed} °C</span><span>${material.dry}</span>
          <span>${stars(material.strength)}</span><span>${stars(material.flex)}</span><span>${stars(material.heat)}</span>
          <span>${difficultyLabel(material.difficulty)}</span><span>${material.support}</span>
        </div>`).join('')}
    </div>`;
}

function updateSupport() {
  const name = els.modelMaterial.value;
  const material = MATERIALS.find(item => item.name === name);
  const rule = SUPPORT_MAP[name] || {
    best: material?.support || 'Материал модели с увеличенным Z-зазором',
    alternatives: ['Фирменный breakaway после теста'],
    note: 'Для этой пары нет универсального рецепта. Проверь маленький тестовый образец.'
  };

  els.supportResult.innerHTML = `
    <div class="selected-material" style="--accent:${material?.color || '#fff'}">
      <span class="spool-icon"><i></i></span><div><small>Модель</small><b>${name}</b></div>
    </div>
    <div class="support-arrow">↓</div>
    <div class="support-best"><small>Лучший стартовый вариант</small><strong>${rule.best}</strong></div>
    ${rule.alternatives.length ? `<div class="support-alt"><small>Альтернативы</small><span>${rule.alternatives.join(' · ')}</span></div>` : ''}
    <p class="support-note">${rule.note}</p>`;
}

function renderQuests() {
  els.questGrid.innerHTML = QUESTS.map(quest => `
    <button class="quest-card" data-quest="${quest.id}" type="button">
      <span>${quest.icon}</span><b>${quest.title}</b><small>${quest.material}</small>
    </button>`).join('');
}

function selectQuest(id) {
  const quest = QUESTS.find(item => item.id === id);
  if (!quest) return;
  document.querySelectorAll('.quest-card').forEach(card => {
    card.classList.toggle('active', card.dataset.quest === id);
  });
  const material = MATERIALS.find(item => item.name === quest.material);
  els.questResult.innerHTML = `
    <span class="quest-avatar" style="--accent:${material?.color}">${quest.icon}</span>
    <div><small>${quest.title}</small><h3>${quest.material}</h3><p>${quest.text}</p>
    <button type="button" data-open-material="${quest.material}">Открыть карточку</button></div>`;
  beep(720);
}

function setFamily(name) {
  state.family = name;
  els.family.value = name;
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.family === name);
  });
  renderMaterials();
}

function bindEvents() {
  els.search.addEventListener('input', event => {
    state.query = event.target.value.trim().toLowerCase();
    renderMaterials();
  });
  els.family.addEventListener('change', event => setFamily(event.target.value));
  els.difficulty.addEventListener('change', event => {
    state.difficulty = event.target.value;
    renderMaterials();
  });
  els.reset.addEventListener('click', () => {
    state.family = 'all';
    state.difficulty = 'all';
    state.query = '';
    els.search.value = '';
    els.family.value = 'all';
    els.difficulty.value = 'all';
    setFamily('all');
    beep(300);
  });
  els.chips.addEventListener('click', event => {
    const chip = event.target.closest('[data-family]');
    if (chip) setFamily(chip.dataset.family);
  });
  els.grid.addEventListener('click', event => {
    const card = event.target.closest('.material-card');
    if (!card) return;
    const action = event.target.closest('button')?.dataset.action;
    if (action === 'compare') toggleCompare(card.dataset.name);
    else openDetails(card.dataset.name);
  });
  els.grid.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) {
      event.preventDefault();
      openDetails(event.target.closest('.material-card')?.dataset.name);
    }
  });
  document.querySelector('.dialog-close').addEventListener('click', () => els.dialog.close());
  els.dialog.addEventListener('click', event => {
    if (event.target === els.dialog) els.dialog.close();
  });
  els.compare.addEventListener('click', event => {
    const button = event.target.closest('[data-remove]');
    if (button) toggleCompare(button.dataset.remove);
  });
  els.clearCompare.addEventListener('click', () => {
    state.compare = [];
    renderCompare();
    renderMaterials();
  });
  els.modelMaterial.addEventListener('change', updateSupport);
  els.questGrid.addEventListener('click', event => {
    const card = event.target.closest('[data-quest]');
    if (card) selectQuest(card.dataset.quest);
  });
  els.questResult.addEventListener('click', event => {
    const button = event.target.closest('[data-open-material]');
    if (button) openDetails(button.dataset.openMaterial);
  });
  els.menuToggle.addEventListener('click', () => {
    const open = els.nav.classList.toggle('open');
    els.menuToggle.setAttribute('aria-expanded', String(open));
  });
  els.nav.addEventListener('click', event => {
    if (event.target.matches('a')) els.nav.classList.remove('open');
  });
  els.sound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    els.sound.classList.toggle('active', soundEnabled);
    els.sound.setAttribute('aria-pressed', String(soundEnabled));
    beep(880, 0.07);
  });
}

function addCopyrightNotice() {
  const container = document.querySelector('.footer-center');
  if (!container || container.querySelector('.copyright')) return;
  const notice = document.createElement('small');
  notice.className = 'copyright';
  notice.textContent = '© 2026 Алексей Прокопчук. Все права защищены.';
  container.append(notice);
}

function loadEnhancements() {
  const version = '2.0.0';
  ['easter-eggs.css', 'design-v2.css'].forEach(href => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `${href}?v=${version}`;
    document.head.append(stylesheet);
  });

  ['design-v2.js', 'easter-eggs.js'].forEach(src => {
    const script = document.createElement('script');
    script.src = `${src}?v=${version}`;
    script.async = false;
    document.body.append(script);
  });
}

function init() {
  fillFilters();
  MATERIALS.filter(material => material.family !== 'Поддержки').forEach(material => {
    const option = document.createElement('option');
    option.value = material.name;
    option.textContent = material.name;
    els.modelMaterial.append(option);
  });
  els.modelMaterial.value = 'PETG';
  renderMaterials();
  renderCompare();
  updateSupport();
  renderQuests();
  bindEvents();
  addCopyrightNotice();
  loadEnhancements();
}

init();
