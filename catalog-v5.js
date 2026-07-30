(() => {
  const state = { family: 'all', difficulty: 'all', query: '', limit: 12 };
  const grid = document.querySelector('#materialsGrid');
  const familySelect = document.querySelector('#familyFilter');
  const difficultySelect = document.querySelector('#difficultyFilter');
  const search = document.querySelector('#searchInput');
  const chips = document.querySelector('#familyChips');
  const count = document.querySelector('#visibleCount');
  const loadMore = document.querySelector('#loadMore');
  const empty = document.querySelector('#emptyState');
  const dialog = document.querySelector('#materialDialog');
  const dialogContent = document.querySelector('#dialogContent');
  const families = [...new Set(MATERIALS.map(material => material.family))].sort((a,b)=>a.localeCompare(b,'ru'));

  const stars = value => `<span class="rating">${'■'.repeat(value)}${'□'.repeat(5-value)}</span>`;
  const difficulty = value => ['', 'Просто', 'Средне', 'Сложно', 'Промышленно'][value] || '—';
  const find = name => MATERIALS.find(material => material.name === name);

  function fillFilters(){
    families.forEach(name => familySelect.add(new Option(name,name)));
    ['Все',...families].forEach((name,index)=>{
      const button=document.createElement('button');
      button.className=`chip${index===0?' active':''}`;
      button.dataset.family=index===0?'all':name;
      button.textContent=name;
      chips.append(button);
    });
  }

  function filtered(){
    return MATERIALS.filter(material=>{
      const text=[material.name,material.family,material.desc,...material.uses,material.support].join(' ').toLowerCase();
      return (state.family==='all'||material.family===state.family)
        &&(state.difficulty==='all'||String(material.difficulty)===state.difficulty)
        &&(!state.query||text.includes(state.query));
    });
  }

  function render(){
    const list=filtered();
    const visible=list.slice(0,state.limit);
    count.textContent=`${visible.length} из ${list.length}`;
    empty.hidden=list.length>0;
    loadMore.hidden=visible.length>=list.length;
    grid.innerHTML=visible.map(material=>`
      <article class="material-card" style="--accent:${material.color}" data-name="${material.name}" tabindex="0">
        <div class="card-top"><span class="spool-icon" aria-hidden="true"></span><span class="family-tag">${material.family}</span></div>
        <h3>${material.name}</h3><p>${material.desc}</p>
        <div class="temperature-row"><span>Сопло<b>${material.nozzle} °C</b></span><span>Стол<b>${material.bed} °C</b></span></div>
        <div class="rating-row"><span>STR ${stars(material.strength)}</span><span>HEAT ${stars(material.heat)}</span></div>
        <div class="card-buttons"><button class="details-btn" type="button" data-action="details">Подробнее</button><button class="compare-btn" type="button" data-action="compare">Сравнить</button></div>
      </article>`).join('');
  }

  function openDetails(name){
    const material=find(name); if(!material)return;
    dialogContent.innerHTML=`
      <div class="dialog-title" style="--accent:${material.color}"><span class="spool-icon big"></span><div><small>${material.family}</small><h2>${material.name}</h2></div></div>
      <p>${material.desc}</p>
      <div class="detail-grid"><span><small>Сопло</small><b>${material.nozzle} °C</b></span><span><small>Стол</small><b>${material.bed} °C</b></span><span><small>Камера</small><b>${material.chamber}</b></span><span><small>Сушка</small><b>${material.dry}</b></span></div>
      <div class="stat-bars">
        <div><span>Прочность</span><i><b style="width:${material.strength*20}%"></b></i><em>${material.strength}/5</em></div>
        <div><span>Гибкость</span><i><b style="width:${material.flex*20}%"></b></i><em>${material.flex}/5</em></div>
        <div><span>Теплостойкость</span><i><b style="width:${material.heat*20}%"></b></i><em>${material.heat}/5</em></div>
        <div><span>Сложность</span><i><b style="width:${material.difficulty*25}%"></b></i><em>${difficulty(material.difficulty)}</em></div>
      </div>
      <div class="dialog-columns"><div><small>Подходит для</small><ul>${material.uses.map(use=>`<li>${use}</li>`).join('')}</ul></div><div><small>Интерфейс поддержек</small><p>${material.support}</p><a class="pixel-button secondary" href="supports.html?material=${encodeURIComponent(material.name)}">Подобрать поддержку</a></div></div>`;
    dialog.showModal(); window.uiBeep?.(640);
  }

  function resetLimit(){state.limit=12;render()}
  search.addEventListener('input',event=>{state.query=event.target.value.trim().toLowerCase();resetLimit()});
  familySelect.addEventListener('change',event=>setFamily(event.target.value));
  difficultySelect.addEventListener('change',event=>{state.difficulty=event.target.value;resetLimit()});
  document.querySelector('#resetFilters').addEventListener('click',()=>{state.family='all';state.difficulty='all';state.query='';search.value='';familySelect.value='all';difficultySelect.value='all';document.querySelectorAll('.chip').forEach((chip,index)=>chip.classList.toggle('active',index===0));resetLimit()});
  chips.addEventListener('click',event=>{const chip=event.target.closest('[data-family]');if(chip)setFamily(chip.dataset.family)});
  function setFamily(name){state.family=name;familySelect.value=name;document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.family===name));resetLimit()}
  loadMore.addEventListener('click',()=>{state.limit+=12;render();window.uiBeep?.(540)});
  grid.addEventListener('click',event=>{const card=event.target.closest('.material-card');if(!card)return;const action=event.target.closest('button')?.dataset.action;if(action==='compare')location.href=`compare.html?m1=${encodeURIComponent(card.dataset.name)}`;else openDetails(card.dataset.name)});
  grid.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();openDetails(event.target.closest('.material-card')?.dataset.name)}});
  document.querySelector('.modal-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});

  fillFilters(); render();
  const requested=new URLSearchParams(location.search).get('material');
  if(requested&&find(requested))setTimeout(()=>openDetails(requested),60);
})();
