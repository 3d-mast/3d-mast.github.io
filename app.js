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
const families = [...new Set(MATERIALS.map(m => m.family))].sort((a,b)=>a.localeCompare(b,'ru'));

function stars(value, max = 5) {
  return `<span class="rating" aria-label="${value} из ${max}">${'■'.repeat(value)}${'□'.repeat(max-value)}</span>`;
}

function difficultyLabel(value) {
  return ['','Просто','Средне','Сложно','Промышленно'][value] || '—';
}

function beep(freq = 440, duration = 0.035) {
  if (!soundEnabled) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.value = 0.025;
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration);
}

function fillFilters() {
  els.total.textContent = MATERIALS.length;
  families.forEach(name => {
    const option = document.createElement('option');
    option.value = name; option.textContent = name;
    els.family.append(option);
  });

  const all = document.createElement('button');
  all.className = 'chip active'; all.dataset.family = 'all'; all.textContent = 'Все';
  els.chips.append(all);
  families.forEach(name => {
    const button = document.createElement('button');
    button.className = 'chip'; button.dataset.family = name; button.textContent = name;
    els.chips.append(button);
  });
}

function materialMatches(material) {
  const haystack = [material.name, material.family, material.desc, ...material.uses, material.support].join(' ').toLowerCase();
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
      <div class="temp-row"><span>Сопло <b>${material.nozzle}°</b></span><span>Стол <b>${material.bed}°</b></span></div>
      <div class="card-stats">
        <span title="Прочность">STR ${stars(material.strength)}</span>
        <span title="Теплостойкость">HEAT ${stars(material.heat)}</span>
      </div>
      <div class="card-actions">
        <button class="details-btn" data-action="details" type="button">Подробнее</button>
        <button class="compare-btn ${state.compare.includes(material.name) ? 'active' : ''}" data-action="compare" type="button">${state.compare.includes(material.name) ? '✓ В сравнении' : '+ Сравнить'}</button>
      </div>
    </article>`).join('');
}

function openDetails(name) {
  const m = MATERIALS.find(item => item.name === name);
  if (!m) return;
  els.dialogContent.innerHTML = `
    <div class="dialog-title" style="--accent:${m.color}">
      <span class="spool-icon big"><i></i></span>
      <div><small>${m.family}</small><h2>${m.name}</h2></div>
    </div>
    <p class="dialog-desc">${m.desc}</p>
    <div class="detail-grid">
      <span><small>Сопло</small><b>${m.nozzle} °C</b></span>
      <span><small>Стол</small><b>${m.bed} °C</b></span>
      <span><small>Камера</small><b>${m.chamber}</b></span>
      <span><small>Сушка</small><b>${m.dry}</b></span>
    </div>
    <div class="stat-bars">
      ${['strength','flex','heat'].map((key, idx) => {
        const labels = ['Прочность','Гибкость','Теплостойкость'];
        return `<div><span>${labels[idx]}</span><i><b style="width:${m[key]*20}%"></b></i><em>${m[key]}/5</em></div>`;
      }).join('')}
      <div><span>Сложность</span><i><b style="width:${m.difficulty*25}%"></b></i><em>${difficultyLabel(m.difficulty)}</em></div>
    </div>
    <div class="dialog-columns">
      <div><small>Подходит для</small><ul>${m.uses.map(use=>`<li>${use}</li>`).join('')}</ul></div>
      <div><small>Интерфейс поддержек</small><p>${m.support}</p></div>
    </div>`;
  els.dialog.showModal();
  beep(640);
}

function toggleCompare(name) {
  if (state.compare.includes(name)) state.compare = state.compare.filter(item => item !== name);
  else if (state.compare.length < 3) state.compare.push(name);
  else {
    els.compare.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:180});
    beep(150, .08); return;
  }
  renderMaterials(); renderCompare(); beep(520);
}

function renderCompare() {
  if (!state.compare.length) {
    els.compare.innerHTML = '<div class="compare-placeholder">Пока пусто. Выбери материалы в каталоге.</div>';
    return;
  }
  const list = state.compare.map(name => MATERIALS.find(m => m.name === name)).filter(Boolean);
  els.compare.innerHTML = `
    <div class="compare-table" style="--cols:${list.length}">
      <div class="compare-labels"><b>Параметр</b><span>Сопло</span><span>Стол</span><span>Сушка</span><span>Прочность</span><span>Гибкость</span><span>Тепло</span><span>Сложность</span><span>Support</span></div>
      ${list.map(m=>`<div class="compare-column" style="--accent:${m.color}"><b>${m.name}<button data-remove="${m.name}" aria-label="Убрать ${m.name}">×</button></b><span>${m.nozzle} °C</span><span>${m.bed} °C</span><span>${m.dry}</span><span>${stars(m.strength)}</span><span>${stars(m.flex)}</span><span>${stars(m.heat)}</span><span>${difficultyLabel(m.difficulty)}</span><span>${m.support}</span></div>`).join('')}
    </div>`;
}

function updateSupport() {
  const name = els.modelMaterial.value;
  const m = MATERIALS.find(item => item.name === name);
  const rule = SUPPORT_MAP[name] || {best:m?.support || 'Материал модели с увеличенным Z-зазором', alternatives:['Фирменный breakaway после теста'], note:'Для этой пары нет универсального рецепта. Проверь маленький тестовый образец.'};
  els.supportResult.innerHTML = `
    <div class="selected-material" style="--accent:${m?.color || '#fff'}"><span class="spool-icon"><i></i></span><div><small>Модель</small><b>${name}</b></div></div>
    <div class="support-arrow">↓</div>
    <div class="support-best"><small>Лучший стартовый вариант</small><strong>${rule.best}</strong></div>
    ${rule.alternatives.length ? `<div class="support-alt"><small>Альтернативы</small><span>${rule.alternatives.join(' · ')}</span></div>` : ''}
    <p class="support-note">${rule.note}</p>`;
}

function renderQuests() {
  els.questGrid.innerHTML = QUESTS.map(q => `<button class="quest-card" data-quest="${q.id}" type="button"><span>${q.icon}</span><b>${q.title}</b><small>${q.material}</small></button>`).join('');
}

function selectQuest(id) {
  const q = QUESTS.find(item => item.id === id);
  if (!q) return;
  document.querySelectorAll('.quest-card').forEach(card => card.classList.toggle('active', card.dataset.quest === id));
  const m = MATERIALS.find(item => item.name === q.material);
  els.questResult.innerHTML = `<span class="quest-avatar" style="--accent:${m?.color}">${q.icon}</span><div><small>${q.title}</small><h3>${q.material}</h3><p>${q.text}</p><button type="button" data-open-material="${q.material}">Открыть карточку</button></div>`;
  beep(720);
}

function bindEvents() {
  els.search.addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderMaterials(); });
  els.family.addEventListener('change', e => setFamily(e.target.value));
  els.difficulty.addEventListener('change', e => { state.difficulty = e.target.value; renderMaterials(); });
  els.reset.addEventListener('click', () => { state.family='all'; state.difficulty='all'; state.query=''; els.search.value=''; els.family.value='all'; els.difficulty.value='all'; setFamily('all'); renderMaterials(); beep(300); });
  els.chips.addEventListener('click', e => { const chip=e.target.closest('[data-family]'); if(chip) setFamily(chip.dataset.family); });
  els.grid.addEventListener('click', e => { const card=e.target.closest('.material-card'); if(!card) return; const action=e.target.closest('button')?.dataset.action; if(action==='compare') toggleCompare(card.dataset.name); else openDetails(card.dataset.name); });
  els.grid.addEventListener('keydown', e => { if((e.key==='Enter'||e.key===' ') && !e.target.closest('button')) { e.preventDefault(); openDetails(e.target.closest('.material-card')?.dataset.name); }});
  document.querySelector('.dialog-close').addEventListener('click', ()=>els.dialog.close());
  els.dialog.addEventListener('click', e => { if(e.target===els.dialog) els.dialog.close(); });
  els.compare.addEventListener('click', e => { const b=e.target.closest('[data-remove]'); if(b) toggleCompare(b.dataset.remove); });
  els.clearCompare.addEventListener('click', ()=>{state.compare=[]; renderCompare(); renderMaterials();});
  els.modelMaterial.addEventListener('change', updateSupport);
  els.questGrid.addEventListener('click', e => { const card=e.target.closest('[data-quest]'); if(card) selectQuest(card.dataset.quest); });
  els.questResult.addEventListener('click', e=>{ const b=e.target.closest('[data-open-material]'); if(b) openDetails(b.dataset.openMaterial); });
  els.menuToggle.addEventListener('click', ()=>{ const open=els.nav.classList.toggle('open'); els.menuToggle.setAttribute('aria-expanded', String(open)); });
  els.nav.addEventListener('click', e=>{ if(e.target.matches('a')) els.nav.classList.remove('open'); });
  els.sound.addEventListener('click', ()=>{ soundEnabled=!soundEnabled; els.sound.classList.toggle('active',soundEnabled); els.sound.setAttribute('aria-pressed',String(soundEnabled)); beep(880,.07); });
}

function setFamily(name) {
  state.family=name; els.family.value=name;
  document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.family===name));
  renderMaterials();
}

function addCopyrightNotice() {
  const container = document.querySelector('.footer-center');
  if (!container || container.querySelector('.copyright')) return;
  const notice = document.createElement('small');
  notice.className = 'copyright';
  notice.textContent = '© 2026 Алексей Прокопчук. Все права защищены.';
  container.append(notice);
}

function init() {
  fillFilters();
  MATERIALS.filter(m => m.family !== 'Поддержки').forEach(m => {
    const option=document.createElement('option'); option.value=m.name; option.textContent=m.name; els.modelMaterial.append(option);
  });
  els.modelMaterial.value='PETG';
  renderMaterials(); renderCompare(); updateSupport(); renderQuests(); bindEvents(); addCopyrightNotice();
}

init();