(() => {
  'use strict';

  const STORAGE_KEY = '3d-plastics-easter-eggs-v1';
  const discovered = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  const TOTAL_EGGS = 12;
  let commandBuffer = '';
  let brandClicks = 0;
  let mugClicks = 0;
  let soundClicks = 0;
  let resetClicks = 0;
  let clippyShown = discovered.has('clippy');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...discovered]));
  }

  function synth(notes = [660, 440], duration = 0.08) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index % 2 ? 'square' : 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01 + index * duration);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration + index * duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * duration);
        osc.stop(ctx.currentTime + duration * 2 + index * duration);
      });
      window.setTimeout(() => ctx.close(), 800);
    } catch (_) {
      // Audio is decorative; unsupported browsers stay silent.
    }
  }

  function discover(id, title) {
    const isNew = !discovered.has(id);
    discovered.add(id);
    persist();
    if (isNew) synth([880, 660]);
    toast(isNew ? `Пасхалка найдена: ${title}` : title, `${discovered.size}/${TOTAL_EGGS} секретов обнаружено`);
  }

  function toast(title, text = '') {
    let stack = document.querySelector('.egg-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'egg-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.append(stack);
    }
    const item = document.createElement('div');
    item.className = 'egg-toast';
    item.innerHTML = `<b>${title}</b>${text ? `<span>${text}</span>` : ''}`;
    stack.append(item);
    requestAnimationFrame(() => item.classList.add('show'));
    window.setTimeout(() => {
      item.classList.remove('show');
      window.setTimeout(() => item.remove(), 250);
    }, 4200);
  }

  function makeOverlay(className, html) {
    const old = document.querySelector(`.${className}`);
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.className = `egg-overlay ${className}`;
    overlay.innerHTML = html;
    document.body.append(overlay);
    overlay.querySelectorAll('[data-egg-close]').forEach(button => {
      button.addEventListener('click', () => overlay.remove());
    });
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });
    return overlay;
  }

  function windows95() {
    discover('win95', '3D Plastics 95');
    const overlay = makeOverlay('egg-win95', `
      <section class="egg-window95" role="dialog" aria-modal="true" aria-label="3D Plastics 95">
        <header><span>▣ 3D Plastics 95</span><button data-egg-close aria-label="Закрыть">×</button></header>
        <div class="egg-win95-body">
          <div class="egg-hourglass">⌛</div>
          <div><b>Обнаружено новое устройство:</b><p>FDM Printer (Plug and Pray)</p><small>Установка драйвера сопла 0.4 мм завершена успешно.</small></div>
        </div>
        <footer><button data-egg-close>OK</button></footer>
      </section>`);
    synth([523, 659, 784], 0.11);
    window.setTimeout(() => overlay.querySelector('button')?.focus(), 50);
  }

  function doomMode() {
    discover('doom', 'IDDQD // GOD MODE');
    document.body.classList.toggle('egg-doom-mode');
    let hud = document.querySelector('.egg-doom-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'egg-doom-hud';
      hud.innerHTML = '<span>HEAT 100%</span><b>NOZZLE GOD MODE</b><span>WARP 0%</span>';
      document.body.append(hud);
    } else {
      hud.remove();
    }
  }

  function matrixRain() {
    discover('matrix', 'Wake up, printer…');
    const existing = document.querySelector('.egg-matrix-canvas');
    if (existing) existing.remove();
    const canvas = document.createElement('canvas');
    canvas.className = 'egg-matrix-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    const chars = '01PLA PETG ABS TPU PA PC FDM'.replaceAll(' ', '');
    let columns = [];
    let raf = 0;
    let last = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Array(Math.ceil(canvas.width / 18)).fill(1);
    }
    function draw(time) {
      if (time - last < 55) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = time;
      ctx.fillStyle = 'rgba(0, 8, 2, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#63ff76';
      ctx.font = '14px monospace';
      columns.forEach((y, index) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, index * 18, y * 18);
        if (y * 18 > canvas.height && Math.random() > 0.975) columns[index] = 0;
        columns[index] += 1;
      });
      raf = requestAnimationFrame(draw);
    }
    resize();
    if (!reduceMotion) raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize, { once: true });
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      canvas.classList.add('fade');
      window.setTimeout(() => canvas.remove(), 800);
    }, reduceMotion ? 2600 : 10000);
  }

  function winamp() {
    discover('winamp', 'FILAMENT AMP 2.91');
    const overlay = makeOverlay('egg-winamp', `
      <section class="egg-player" role="dialog" aria-modal="true" aria-label="Filament Amp">
        <header><b>FILAMENT AMP</b><button data-egg-close aria-label="Закрыть">×</button></header>
        <div class="egg-player-display"><span>01. PRINTING_GOOD.MP3</span><small>128 KBPS · 44 KHZ · STEREO</small></div>
        <div class="egg-equalizer" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <div class="egg-player-controls"><button>◀◀</button><button>▶</button><button>▮▮</button><button>■</button><button>▶▶</button></div>
        <footer>WINAMP-STYLE SKIN // NO COPYRIGHTED AUDIO</footer>
      </section>`);
    overlay.querySelector('.egg-player-controls button:nth-child(2)')?.addEventListener('click', () => synth([220, 330, 440, 660], 0.07));
  }

  function lambdaCascade() {
    discover('lambda', 'Резонансный каскад');
    const mark = document.createElement('div');
    mark.className = 'egg-lambda';
    mark.innerHTML = '<b>λ</b><span>НЕСТАНДАРТНЫЙ МАТЕРИАЛ В КАМЕРЕ</span>';
    document.body.append(mark);
    document.documentElement.classList.add('egg-cascade');
    synth([110, 95, 130], 0.12);
    window.setTimeout(() => {
      mark.remove();
      document.documentElement.classList.remove('egg-cascade');
    }, 4300);
  }

  function underground() {
    discover('underground', 'Underground workshop');
    document.body.classList.toggle('egg-underground');
    toast('NEON MODE', document.body.classList.contains('egg-underground') ? 'Гаражная подсветка включена' : 'Гаражная подсветка выключена');
  }

  function cake() {
    discover('cake', 'Лабораторная заметка №2007');
    makeOverlay('egg-cake', `
      <section class="egg-terminal" role="dialog" aria-modal="true">
        <button data-egg-close aria-label="Закрыть">×</button>
        <pre>APERTURE-LIKE MATERIAL LAB
--------------------------
Торт — вопрос дискуссионный.
Калибровочный куб — объективная реальность.

STATUS: STILL PRINTING</pre>
      </section>`);
  }

  function creeper() {
    discover('creeper', 'Тихий гость из 2009-го');
    const guest = document.createElement('div');
    guest.className = 'egg-creeper';
    guest.innerHTML = '<i></i><i></i><b></b><span>тс-с-с…</span>';
    document.body.append(guest);
    synth([80, 60, 45], 0.13);
    window.setTimeout(() => {
      guest.classList.add('boom');
      window.setTimeout(() => guest.remove(), 650);
    }, 2300);
  }

  function tamagotchi() {
    discover('tamagotchi', 'Катушечный питомец');
    const overlay = makeOverlay('egg-tamagotchi', `
      <section class="egg-pet" role="dialog" aria-modal="true" aria-label="Катушечный питомец">
        <header>POCKET SPOOL 1996 <button data-egg-close>×</button></header>
        <div class="egg-pet-screen"><div class="egg-pet-face">◉ᴗ◉</div><span>MOOD: <b data-mood>72</b>%</span><small>Ест обрезки филамента</small></div>
        <footer><button data-feed>FEED</button><button data-play>PLAY</button></footer>
      </section>`);
    let mood = 72;
    const update = amount => {
      mood = Math.min(100, mood + amount);
      overlay.querySelector('[data-mood]').textContent = String(mood);
      overlay.querySelector('.egg-pet-face').textContent = mood > 90 ? '◉▽◉' : '◉ᴗ◉';
      synth([520 + mood, 720], 0.06);
    };
    overlay.querySelector('[data-feed]').addEventListener('click', () => update(7));
    overlay.querySelector('[data-play]').addEventListener('click', () => update(4));
  }

  function snake3310() {
    discover('snake3310', 'Snake 3310: Spool Edition');
    const width = 16;
    const height = 12;
    const overlay = makeOverlay('egg-snake', `
      <section class="egg-phone" role="dialog" aria-modal="true" aria-label="Snake 3310">
        <header><b>3310</b><button data-egg-close aria-label="Закрыть">×</button></header>
        <div class="egg-phone-screen"><div class="egg-snake-score">SCORE: <b>0</b></div><div class="egg-snake-grid">${Array.from({ length: width * height }, () => '<i></i>').join('')}</div></div>
        <div class="egg-phone-controls"><button data-dir="up">▲</button><button data-dir="left">◀</button><button data-dir="down">▼</button><button data-dir="right">▶</button></div>
        <small>Стрелки / WASD · ESC — выход</small>
      </section>`);
    const cells = [...overlay.querySelectorAll('.egg-snake-grid i')];
    const scoreNode = overlay.querySelector('.egg-snake-score b');
    let snake = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    let direction = { x: 1, y: 0 };
    let pending = direction;
    let score = 0;
    let food = spawnFood();
    let timer;

    function spawnFood() {
      let point;
      do {
        point = { x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height) };
      } while (snake.some(part => part.x === point.x && part.y === point.y));
      return point;
    }
    function render() {
      cells.forEach(cell => cell.className = '');
      snake.forEach((part, index) => {
        const cell = cells[part.y * width + part.x];
        if (cell) cell.className = index === 0 ? 'head' : 'snake';
      });
      cells[food.y * width + food.x].className = 'food';
    }
    function setDirection(name) {
      const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      const next = map[name];
      if (!next || (next.x === -direction.x && next.y === -direction.y)) return;
      pending = next;
    }
    function tick() {
      direction = pending;
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= width || head.y >= height;
      const hitSelf = snake.some(part => part.x === head.x && part.y === head.y);
      if (hitWall || hitSelf) {
        clearInterval(timer);
        overlay.querySelector('.egg-snake-score').innerHTML = `GAME OVER · SCORE: <b>${score}</b>`;
        synth([180, 120, 80], 0.12);
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreNode.textContent = String(score);
        food = spawnFood();
        synth([760, 980], 0.05);
      } else {
        snake.pop();
      }
      render();
    }
    function keyboard(event) {
      const keys = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
      if (event.key === 'Escape') overlay.remove();
      if (keys[event.key]) {
        event.preventDefault();
        setDirection(keys[event.key]);
      }
    }
    overlay.querySelectorAll('[data-dir]').forEach(button => button.addEventListener('click', () => setDirection(button.dataset.dir)));
    document.addEventListener('keydown', keyboard);
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        clearInterval(timer);
        document.removeEventListener('keydown', keyboard);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });
    render();
    timer = window.setInterval(tick, 150);
  }

  function clippy() {
    clippyShown = true;
    discover('clippy', 'Офисный помощник 1997');
    const bubble = document.createElement('aside');
    bubble.className = 'egg-clippy';
    bubble.innerHTML = `<button aria-label="Закрыть">×</button><div class="egg-paperclip">〰</div><p><b>Похоже, вы выбираете пластик.</b><br>Попробуйте PETG, а потом всё равно напечатайте тестовый куб.</p>`;
    document.body.append(bubble);
    bubble.querySelector('button').addEventListener('click', () => bubble.remove());
    window.setTimeout(() => bubble.remove(), 12000);
  }

  function hereWeGoAgain() {
    discover('again', 'Снова в мастерскую');
    const banner = document.createElement('div');
    banner.className = 'egg-again';
    banner.innerHTML = '<b>AH, HERE WE PRINT AGAIN…</b><span>Все фильтры сброшены. Лос-Сантос подождёт.</span>';
    document.body.append(banner);
    synth([196, 247, 294], 0.1);
    window.setTimeout(() => banner.remove(), 5000);
  }

  const commands = {
    iddqd: doomMode,
    matrix: matrixRain,
    '3310': snake3310,
    winamp,
    lambda: lambdaCascade,
    underground,
    cake,
    creeper
  };

  function handleCommandKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    commandBuffer = (commandBuffer + event.key.toLowerCase()).slice(-20);
    for (const [command, action] of Object.entries(commands)) {
      if (commandBuffer.endsWith(command)) {
        commandBuffer = '';
        action();
        break;
      }
    }
  }

  function bindClickSecrets() {
    document.querySelector('.brand')?.addEventListener('click', event => {
      brandClicks += 1;
      if (brandClicks === 5) {
        event.preventDefault();
        brandClicks = 0;
        windows95();
      }
    });

    document.querySelector('.mug')?.addEventListener('click', () => {
      mugClicks += 1;
      if (mugClicks === 7) {
        mugClicks = 0;
        tamagotchi();
      }
    });

    document.querySelector('.sound-toggle')?.addEventListener('click', () => {
      soundClicks += 1;
      if (soundClicks === 4) {
        soundClicks = 0;
        winamp();
      }
    });

    document.querySelector('#resetFilters')?.addEventListener('click', () => {
      resetClicks += 1;
      if (resetClicks === 5) {
        resetClicks = 0;
        hereWeGoAgain();
      }
    });

    document.querySelector('#searchInput')?.addEventListener('input', event => {
      if (!clippyShown && event.target.value.trim().length >= 18) {
        window.setTimeout(clippy, 500);
      }
    });
  }

  function addSecretCounter() {
    const footer = document.querySelector('.footer-center');
    if (!footer) return;
    const counter = document.createElement('button');
    counter.className = 'egg-secret-counter';
    counter.type = 'button';
    counter.textContent = '▣';
    counter.title = 'Секретный архив';
    counter.setAttribute('aria-label', 'Открыть секретный архив');
    counter.addEventListener('click', () => {
      toast('Секретный архив', `${discovered.size}/${TOTAL_EGGS} пасхалок найдено. Команды спрятаны где-то между 1993 и 2010 годом.`);
    });
    footer.append(counter);
  }

  document.addEventListener('keydown', handleCommandKey);
  bindClickSecrets();
  addSecretCounter();
  console.info('%c3D PLASTICS SECRET TERMINAL', 'color:#63ff76;background:#061006;padding:6px;font-family:monospace');
  console.info('1993 > 1995 > 1996 > 1997 > 1998 > 1999 > 2004 > 2007 > 2009 > 2010');
})();