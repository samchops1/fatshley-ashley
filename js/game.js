/* Fatshley Ashley — main game loop */
(function () {
  'use strict';

  const W = 390;
  const H = 700;
  const ROUND_TIME = 105; // seconds to Last Call
  const HS_KEY = 'fatshley_ashley_highscore';
  const SOBER_FAIL = 6; // seconds buzz<25 before fail

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const muteBtn = document.getElementById('btn-mute');

  // Audio (simple Web Audio beeps — no external files)
  let muted = localStorage.getItem('fatshley_muted') === '1';
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { /* no audio */ }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(freq, dur, type, vol) {
    if (muted || !audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol || 0.08;
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  function updateMuteUI() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
  }
  updateMuteUI();
  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted;
    localStorage.setItem('fatshley_muted', muted ? '1' : '0');
    updateMuteUI();
    ensureAudio();
    if (!muted) beep(440, 0.08);
  });

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  function getHighScore() {
    return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0;
  }
  function setHighScore(s) {
    localStorage.setItem(HS_KEY, String(s));
  }

  // Game state
  let state = 'title'; // title | play | results
  let frame = 0;
  let lastTs = 0;
  let ashX = W / 2;
  let ashTarget = W / 2;
  let buzz = 50;
  let soberTimer = 0; // time spent too low
  let timeLeft = ROUND_TIME;
  let shots = 0;
  let handled = 0;
  let score = 0;
  let patrons = [];
  let spawnTimer = 0;
  let nextSpawn = 3;
  let activePatron = null;
  let drinkCooldown = 0;
  let linesDone = 0;
  let linesSinceCrash = 0;
  let lineCooldown = 0;
  let crashCooldown = 0;
  let crashOutTimer = 0; // 0 = not crashing
  let ashBark = null; // optional {text, life} speech over Ashley
  let floatTexts = [];
  let pressed = {}; // aggregated: left/right/drink/… (+ _keyLeft/_keyRight)
  let resultData = null;
  let titleBtns = {};
  let resultBtns = {};
  let controls = UI.layoutPlayControls(W, H);
  let survived = 0;
  let showPatronUI = false;

  // --- Multi-touch: Map keyed by identifier (mouse = 'mouse') ---
  const pointers = new Map();
  const RELEASE_ACTIONS = { drink: 1, line: 1, crash: 1, ignore: 1, flirt: 1, yell: 1, play: 1, retry: 1 };
  const HOLD_ACTIONS = { left: 1, right: 1 };

  function resetGame() {
    ashX = W / 2;
    ashTarget = W / 2;
    buzz = 50;
    soberTimer = 0;
    timeLeft = ROUND_TIME;
    shots = 0;
    handled = 0;
    score = 0;
    patrons = [];
    spawnTimer = 0;
    nextSpawn = 2.5;
    activePatron = null;
    drinkCooldown = 0;
    lineCooldown = 0;
    crashCooldown = 0;
    crashOutTimer = 0;
    ashBark = null;
    floatTexts = [];
    pressed = {};
    pointers.clear();
    survived = 0;
    showPatronUI = false;
    resultData = null;
    Patrons.shuffleLines();
  }

  function addFloat(text, x, y, color, life) {
    floatTexts.push({ text: text, x: x, y: y, color: color || '#ffcc44', life: life == null ? 1.2 : life });
  }

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  /** Derive pressed.left/right from ANY active pointer over those buttons (+ keyboard). */
  function rebuildPressed() {
    const keyLeft = !!pressed._keyLeft;
    const keyRight = !!pressed._keyRight;
    const next = {};
    pointers.forEach(function (p) {
      if (!p || !p.action) return;
      if (HOLD_ACTIONS[p.action] && p.downInRect) next[p.action] = true;
      if (RELEASE_ACTIONS[p.action] && p.downInRect) next[p.action] = true;
    });
    if (keyLeft) next.left = true;
    if (keyRight) next.right = true;
    next._keyLeft = keyLeft;
    next._keyRight = keyRight;
    pressed = next;
  }


  function hitActionAt(x, y) {
    if (state === 'title') {
      const playBtn = UI.layoutPlayBtn(W, H);
      if (UI.hitPad(x, y, playBtn)) return { action: 'play', rect: playBtn };
      return null;
    }
    if (state === 'results') {
      const retry = UI.layoutRetryBtn(W, H);
      if (UI.hitPad(x, y, retry)) return { action: 'retry', rect: retry };
      return null;
    }
    if (state === 'play') {
      controls = UI.layoutPlayControls(W, H);
      if (UI.hitPad(x, y, controls.left)) return { action: 'left', rect: controls.left };
      if (UI.hitPad(x, y, controls.right)) return { action: 'right', rect: controls.right };
      if (UI.hitPad(x, y, controls.drink)) return { action: 'drink', rect: controls.drink };
      if (UI.hitPad(x, y, controls.line)) return { action: 'line', rect: controls.line };
      if (UI.hitPad(x, y, controls.crash)) return { action: 'crash', rect: controls.crash };
      if (showPatronUI && activePatron && activePatron.state === 'talking' && crashOutTimer <= 0) {
        if (UI.hitPad(x, y, controls.ignore)) return { action: 'ignore', rect: controls.ignore };
        if (UI.hitPad(x, y, controls.flirt)) return { action: 'flirt', rect: controls.flirt };
        if (UI.hitPad(x, y, controls.yell)) return { action: 'yell', rect: controls.yell };
      }
      // Floor drag zone (above controls)
      if (y < H - 160) return { action: 'floor', rect: null };
    }
    return null;
  }

  function fireAction(action) {
    if (action === 'play') {
      resetGame();
      state = 'play';
      beep(660, 0.12);
      beep(880, 0.15);
      return;
    }
    if (action === 'retry') {
      resetGame();
      state = 'play';
      beep(660, 0.1);
      return;
    }
    if (action === 'drink') { doDrink(); return; }
    if (action === 'line') { doLine(); return; }
    if (action === 'crash') { doCrashOut(true); return; }
    if (action === 'ignore') { doIgnore(); return; }
    if (action === 'flirt') { doFlirt(); return; }
    if (action === 'yell') { doYell(); return; }
  }

  function onPointerDown(id, clientX, clientY) {
    ensureAudio();
    const p = clientToCanvas(clientX, clientY);
    const hit = hitActionAt(p.x, p.y);
    const action = hit ? hit.action : null;
    const rect = hit ? hit.rect : null;

    pointers.set(id, {
      action: action,
      x: p.x,
      y: p.y,
      rect: rect,
      downInRect: !!action && action !== 'floor',
    });

    // Floor drag only for the finger that started the drag
    if (action === 'floor') {
      ashTarget = Math.max(50, Math.min(W - 50, p.x));
    }
    if (action === 'play' || action === 'retry') {
      beep(523, 0.1);
    }
    rebuildPressed();
  }

  function onPointerMove(id, clientX, clientY) {
    const entry = pointers.get(id);
    if (!entry) return;
    const p = clientToCanvas(clientX, clientY);
    entry.x = p.x;
    entry.y = p.y;

    // Floor drag: only the finger that started it
    if (entry.action === 'floor' && state === 'play') {
      ashTarget = Math.max(50, Math.min(W - 50, p.x));
      return;
    }

    // Hold left/right: slide onto/off
    if (state === 'play') {
      controls = UI.layoutPlayControls(W, H);
      if (UI.hitPad(p.x, p.y, controls.left)) {
        entry.action = 'left';
        entry.rect = controls.left;
        entry.downInRect = true;
      } else if (UI.hitPad(p.x, p.y, controls.right)) {
        entry.action = 'right';
        entry.rect = controls.right;
        entry.downInRect = true;
      } else if (HOLD_ACTIONS[entry.action]) {
        entry.downInRect = false;
      }
    }

    // Release-actions: cancel highlight if finger left padded rect
    if (entry.action && RELEASE_ACTIONS[entry.action] && entry.rect) {
      entry.downInRect = UI.hitPad(p.x, p.y, entry.rect);
    }

    rebuildPressed();
  }

  function onPointerUp(id, clientX, clientY) {
    const entry = pointers.get(id);
    if (!entry) return;
    const p = clientToCanvas(clientX, clientY);

    // DRINK/LINE/CRASH/IGNORE/FLIRT/YELL/PLAY/RETRY: fire on pointerup if still inside padded hit rect
    if (entry.action && RELEASE_ACTIONS[entry.action] && entry.rect) {
      if (UI.hitPad(p.x, p.y, entry.rect)) {
        fireAction(entry.action);
      }
    }

    // Clear ONLY this finger's state (never wipe all pointers)
    pointers.delete(id);
    rebuildPressed();
  }

  function clearPointer(id) {
    if (pointers.has(id)) {
      pointers.delete(id);
      rebuildPressed();
    }
  }

  // Touch events — per changedTouches[i].identifier (NOT touches[0])
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      onPointerDown(t.identifier, t.clientX, t.clientY);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      onPointerMove(t.identifier, t.clientX, t.clientY);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      onPointerUp(t.identifier, t.clientX, t.clientY);
    }
  }, { passive: false });

  canvas.addEventListener('touchcancel', function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      clearPointer(e.changedTouches[i].identifier);
    }
  }, { passive: false });

  // Mouse = single pointer id 'mouse'
  canvas.addEventListener('mousedown', function (e) {
    e.preventDefault();
    onPointerDown('mouse', e.clientX, e.clientY);
  });
  canvas.addEventListener('mousemove', function (e) {
    if (!pointers.has('mouse')) return;
    e.preventDefault();
    onPointerMove('mouse', e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseup', function (e) {
    e.preventDefault();
    onPointerUp('mouse', e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseleave', function () {
    clearPointer('mouse');
  });

  // Keyboard still works if present
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      pressed._keyLeft = true;
      rebuildPressed();
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      pressed._keyRight = true;
      rebuildPressed();
    }
    if ((e.key === ' ' || e.key === 'Enter') && state === 'play') {
      e.preventDefault();
      doDrink();
    }
    if ((e.key === 'l' || e.key === 'L') && state === 'play') {
      e.preventDefault();
      doLine();
    }
    if ((e.key === 'c' || e.key === 'C') && state === 'play') {
      e.preventDefault();
      doCrashOut();
    }
    if ((e.key === 'Enter' || e.key === ' ') && state === 'title') {
      e.preventDefault();
      fireAction('play');
    }
    if ((e.key === 'Enter' || e.key === ' ') && state === 'results') {
      e.preventDefault();
      fireAction('retry');
    }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      pressed._keyLeft = false;
      rebuildPressed();
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      pressed._keyRight = false;
      rebuildPressed();
    }
  });

  function doDrink() {
    if (state !== 'play' || crashOutTimer > 0) return;
    if (drinkCooldown > 0) return;
    drinkCooldown = 0.45;
    shots++;
    const gain = 10 + Math.random() * 8;
    buzz = Math.min(100, buzz + gain);
    score += 5;
    addFloat('+' + Math.floor(gain) + ' BUZZ', ashX, H * 0.55, '#88ccff');
    beep(220, 0.06, 'sawtooth', 0.06);
    beep(330, 0.1, 'square', 0.05);
    if (buzz >= 100) endGame('blackout');
  }

  function doLine() {
    if (state !== 'play' || crashOutTimer > 0 || lineCooldown > 0) return;
    lineCooldown = 1.6;
    score += 18;
    const gain = 22 + Math.random() * 14; // big rail buzz/chaos spike
    buzz = Math.min(100, buzz + gain);
    addFloat('LINE!', ashX, H * 0.50, '#ffe066', 1.4);
    addFloat('RAIL', ashX, H * 0.46, '#ff88ff', 1.0);
    addFloat(Patrons.ashleyRail(), ashX, H * 0.56, '#ffccff', 1.6);
    ashBark = { text: Patrons.ashleyRail(), life: 1.6 };
    beep(880, 0.08, 'square', 0.07);
    beep(220, 0.12, 'sawtooth', 0.09);
    beep(1100, 0.1, 'triangle', 0.05);
    // Auto mid-round crash-out after enough rails / high chaos
    linesDone = (typeof linesDone === 'number' ? linesDone : 0) + 1;
    linesSinceCrash = (typeof linesSinceCrash === 'number' ? linesSinceCrash : 0) + 1;
    if (linesSinceCrash >= 3 || (buzz >= 78 && Math.random() < 0.35)) {
      doCrashOut();
    } else if (buzz >= 100) {
      endGame('blackout');
    }
  }

  function doCrashOut(endRound) {
    if (state !== 'play' || crashOutTimer > 0 || crashCooldown > 0) return;
    crashOutTimer = 2.2;
    crashCooldown = 2.0;
    linesSinceCrash = 0;
    // Clear active / nearby patrons — flee
    if (activePatron) {
      activePatron.state = 'leaving';
      activePatron.leaveDir = activePatron.x < ashX ? -1 : 1;
      activePatron.speed *= 2.2;
      activePatron = null;
    }
    let cleared = 0;
    patrons.forEach(function (p) {
      if (p.state === 'talking' || p.state === 'approaching') {
        p.state = 'leaving';
        p.leaveDir = p.x < ashX ? -1 : 1;
        p.speed *= 2.0;
        cleared++;
      }
    });
    showPatronUI = false;
    handled += Math.max(1, cleared);
    score += 40 + cleared * 12;
    let gain = 15 + Math.random() * 13; // +15..28
    if (buzz > 85) gain = Math.max(gain, (100 - buzz) + 1 + Math.random() * 8);
    buzz = Math.min(100, buzz + gain);
    addFloat('CRASHING OUT', ashX, H * 0.52, '#ff4466', 1.8);
    ashBark = { text: Patrons.ashleyCrash(), life: 2.2 };
    beep(90, 0.25, 'sawtooth', 0.12);
    beep(160, 0.2, 'square', 0.08);
    // CRASH button ends the round; auto mid-round crash keeps playing unless blackout
    if (endRound) {
      endGame('crash');
      return;
    }
    if (buzz >= 100) endGame('blackout');
  }

  function doIgnore() {
    if (crashOutTimer > 0) return;
    if (!activePatron || activePatron.state !== 'talking') return;
    activePatron.state = 'leaving';
    activePatron.leaveDir = Math.random() < 0.5 ? -1 : 1;
    handled++;
    score += 8;
    addFloat(Patrons.ashleyIgnore(), activePatron.x, activePatron.y - 40, '#aaaaaa');
    beep(300, 0.08);
    activePatron = null;
    showPatronUI = false;
  }

  function doFlirt() {
    if (crashOutTimer > 0) return;
    if (!activePatron || activePatron.state !== 'talking') return;
    const swing = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 18);
    buzz = Math.max(0, Math.min(100, buzz + swing));
    handled++;
    score += 15;
    const msg = Patrons.ashleyFlirt(swing > 0);
    addFloat(msg, activePatron.x, activePatron.y - 40, swing > 0 ? '#ff88aa' : '#ffaa44');
    activePatron.state = 'leaving';
    activePatron.leaveDir = swing > 0 ? 1 : -1;
    beep(swing > 0 ? 520 : 180, 0.12, 'triangle');
    activePatron = null;
    showPatronUI = false;
    if (buzz >= 100) endGame('blackout');
    if (buzz <= 0) soberTimer = Math.max(soberTimer, 2);
  }

  function doYell() {
    if (crashOutTimer > 0) return;
    if (!activePatron || activePatron.state !== 'talking') return;
    buzz = Math.max(0, buzz - 8);
    handled++;
    score += 10;
    addFloat(Patrons.ashleyYell(), activePatron.x, activePatron.y - 40, '#ff6644');
    activePatron.state = 'leaving';
    activePatron.leaveDir = activePatron.x < ashX ? -1 : 1;
    activePatron.speed *= 1.8;
    beep(150, 0.15, 'sawtooth', 0.1);
    activePatron = null;
    showPatronUI = false;
  }

  function endGame(reason) {
    if (state !== 'play') return;
    survived = ROUND_TIME - timeLeft;
    score += Math.floor(survived) * 2;
    score += shots * 5;
    score += handled * 10;
    if (reason === 'win') score += 100;
    if (reason === 'crash') score += 25;

    const high = getHighScore();
    const newHigh = score > high;
    if (newHigh) setHighScore(score);

    resultData = {
      reason: reason,
      score: score,
      shots: shots,
      handled: handled,
      survived: survived,
      highScore: Math.max(high, score),
      newHigh: newHigh,
    };
    state = 'results';
    pointers.clear();
    pressed = {};
    crashOutTimer = 0;
    if (reason === 'blackout' || reason === 'crash') {
      addFloat(Patrons.ashleyCrash(), ashX, H * 0.5, '#ff6688', 2.5);
      beep(120, 0.3, 'sawtooth', 0.1);
    } else if (reason === 'win') {
      beep(523, 0.1); beep(659, 0.1); beep(784, 0.2);
    } else {
      beep(120, 0.3, 'sawtooth', 0.1);
    }
  }

  function update(dt) {
    frame++;
    if (state !== 'play') return;

    timeLeft -= dt;
    survived = ROUND_TIME - timeLeft;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame('win');
      return;
    }

    const crashing = crashOutTimer > 0;
    const moveSpeed = crashing ? 55 : 160;
    if (pressed.left) ashTarget = Math.max(50, ashX - moveSpeed * dt * 3);
    if (pressed.right) ashTarget = Math.min(W - 50, ashX + moveSpeed * dt * 3);
    ashX += (ashTarget - ashX) * Math.min(1, (crashing ? 3 : 8) * dt);

    buzz = Math.max(0, buzz - 3.2 * dt);
    drinkCooldown = Math.max(0, drinkCooldown - dt);
    lineCooldown = Math.max(0, lineCooldown - dt);
    if (!crashing) crashCooldown = Math.max(0, crashCooldown - dt);

    // Crash-out tick — set crashCooldown when timer hits 0
    if (crashing) {
      crashOutTimer = Math.max(0, crashOutTimer - dt);
      if (crashOutTimer <= 0) {
        crashCooldown = 8;
        if (buzz >= 100) {
          endGame('crash');
          return;
        }
      }
    }

    // TOO SOBER: buzz < 25 for >6s continuous (paused during crash-out)
    if (!crashing) {
      if (buzz < 25) {
        soberTimer += dt;
        if (soberTimer > SOBER_FAIL) {
          endGame('sober');
          return;
        }
      } else {
        soberTimer = Math.max(0, soberTimer - dt * 0.5);
      }
    }

    // Blackout only outside active crash-out (crash expiry handles crash fail)
    if (!crashing && buzz >= 100) {
      endGame('blackout');
      return;
    }

    spawnTimer += dt;
    const talking = patrons.filter(function (p) {
      return p.state === 'talking' || p.state === 'approaching';
    });
    if (!crashing && spawnTimer >= nextSpawn && talking.length < 2) {
      spawnTimer = 0;
      nextSpawn = 4 + Math.random() * 4 - Math.min(2, (ROUND_TIME - timeLeft) / 40);
      const np = Patrons.createPatron(W, H, Math.random() < 0.5);
      patrons.push(np);
      beep(400, 0.05, 'sine', 0.04);
    }

    patrons.forEach(function (p) { Patrons.updatePatron(p, dt, W); });
    patrons = patrons.filter(function (p) { return p.state !== 'gone'; });

    if (!crashing) {
      const talkers = patrons.filter(function (p) { return p.state === 'talking'; });
      if (talkers.length) {
        talkers.sort(function (a, b) { return Math.abs(a.x - ashX) - Math.abs(b.x - ashX); });
        activePatron = talkers[0];
        showPatronUI = true;
      } else {
        if (activePatron && activePatron.state !== 'talking') {
          activePatron = null;
        }
        showPatronUI = !!activePatron && activePatron.state === 'talking';
      }
    } else {
      showPatronUI = false;
    }

    floatTexts.forEach(function (f) {
      f.life -= dt;
      f.y -= 30 * dt;
    });
    floatTexts = floatTexts.filter(function (f) { return f.life > 0; });

    if (ashBark) {
      ashBark.life -= dt;
      if (ashBark.life <= 0) ashBark = null;
    }
  }

  function ashleyFrameId() {
    if (state === 'results' && resultData) {
      if (resultData.reason === 'blackout' || resultData.reason === 'crash') return 'fail_blackout';
      if (resultData.reason === 'win') return 'win_smug';
      if (resultData.reason === 'sober') return 'reject';
    }
    if (crashOutTimer > 0) return (frame % 16 < 8) ? 'pass_out' : 'reject';
    if (ashBark && ashBark.life > 0.3) return 'talk';
    if (drinkCooldown > 0.2) return 'drink_raise';
    if (drinkCooldown > 0) return 'drink_sip';
    if (lineCooldown > 0.35) return 'buzz_high';
    if (buzz > 80) return 'buzz_high';
    if (buzz > 55) return 'buzz_mid';
    if (buzz < 25) return 'buzz_low';
    return (frame % 40 < 20) ? 'idle_0' : 'idle_1';
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (state === 'title') {
      // Shared layout helper — never call drawTitleScreen from tap handlers
      titleBtns = UI.drawTitleScreen(ctx, W, H, getHighScore(), frame);
      if (pressed.play) {
        UI.drawButton(ctx, titleBtns.play, 'PLAY', { pressed: true, fontSize: 22, accent: '#ffee88', bg: '#5a1820' });
      }
      return;
    }

    Sprites.drawBarBackground(ctx, W, H);
    // Bartender behind center island
    Sprites.drawBartender(ctx, W / 2, H * 0.44, 1.0, frame);

    const sorted = patrons.slice().sort(function (a, b) { return a.y - b.y; });
    sorted.forEach(function (p) {
      const pose = p.state === 'approaching' || p.state === 'leaving' ? 'walk' :
                   (p.state === 'talking' ? 'talk' : 'idle');
      Sprites.drawPatron(ctx, p.x, p.y, 1.15, p.variant, frame + p.age * 10, p.facing, pose);
      if (p.state === 'talking' && p === activePatron && crashOutTimer <= 0) {
        Sprites.drawSpeechBubble(ctx, p.x, p.y - 50, p.line, 160);
      }
    });

    // Ashley walks in front / sides of island
    Sprites.drawAshley(ctx, ashX, H * 0.58, 1.35, frame, true, ashleyFrameId());

    if (ashBark && ashBark.text) {
      Sprites.drawSpeechBubble(ctx, ashX, H * 0.48, ashBark.text, 170);
    }

    // HUD — pass soberTimer for fuse UI
    UI.drawBuzzMeter(ctx, 20, 100, W - 40, 18, buzz, soberTimer);
    UI.drawTimer(ctx, W / 2, 55, timeLeft, ROUND_TIME);
    const liveScore = score + Math.floor(survived) * 2;
    UI.drawScoreHud(ctx, 16, 148, liveScore, shots, handled);

    if (crashOutTimer > 0 && UI.drawCrashBanner) {
      UI.drawCrashBanner(ctx, W, H, crashOutTimer, frame);
    }

    if (buzz < 25 && crashOutTimer <= 0) {
      ctx.fillStyle = 'rgba(80,120,255,' + (0.08 + Math.sin(frame * 0.2) * 0.05) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#88aaff';
      ctx.font = 'bold 14px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TOO SOBER! DRINK!', W / 2, 185);
    }
    if (buzz > 80) {
      ctx.fillStyle = 'rgba(200,20,40,' + (0.08 + Math.sin(frame * 0.25) * 0.06) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff6688';
      ctx.font = 'bold 14px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(buzz >= 95 ? 'BLACKOUT TIP!' : 'BLACKOUT ZONE!', W / 2, 185);
    }

    controls = UI.layoutPlayControls(W, H);
    UI.drawButton(ctx, controls.left, '◀', { pressed: pressed.left, fontSize: 24 });
    UI.drawButton(ctx, controls.right, '▶', { pressed: pressed.right, fontSize: 24 });

    const lineDisabled = lineCooldown > 0 || crashOutTimer > 0;
    const crashDisabled = crashCooldown > 0 || crashOutTimer > 0;
    const drinkDisabled = drinkCooldown > 0 || crashOutTimer > 0;

    // Bright labels: ◀ ▶ | CRASH | LINE | DRINK — thumb-obvious on phone
    UI.drawButton(ctx, controls.crash, 'CRASH', {
      pressed: pressed.crash,
      fontSize: 15,
      accent: crashDisabled ? '#886666' : '#ffee66',
      bg: crashDisabled ? '#2a2020' : '#8a1028',
      danger: !crashDisabled,
    });
    UI.drawButton(ctx, controls.line, 'LINE', {
      pressed: pressed.line,
      fontSize: 16,
      accent: lineDisabled ? '#776688' : '#ffffff',
      bg: lineDisabled ? '#2a2030' : '#7a20a8',
    });
    UI.drawButton(ctx, controls.drink, 'DRINK', {
      pressed: pressed.drink,
      fontSize: 16,
      accent: drinkDisabled ? '#667788' : '#88ddff',
      bg: drinkDisabled ? '#2a2030' : '#203050',
    });

    if (showPatronUI && activePatron && crashOutTimer <= 0) {
      UI.drawButton(ctx, controls.ignore, 'IGNORE', { pressed: pressed.ignore, fontSize: 13, accent: '#ccccaa' });
      UI.drawButton(ctx, controls.flirt, 'FLIRT', { pressed: pressed.flirt, fontSize: 13, accent: '#ff88aa', bg: '#4a1828' });
      UI.drawButton(ctx, controls.yell, 'YELL', { pressed: pressed.yell, fontSize: 13, accent: '#ff6644', danger: true });
    }

    floatTexts.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.font = 'bold 14px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });

    if (state === 'results' && resultData) {
      resultBtns = UI.drawResults(ctx, W, H, resultData);
    }
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Kick sheet load (non-blocking; procedural fallback until ready)
  if (Sprites.loadSheets) {
    Sprites.loadSheets('assets/').catch(function () { /* fallback stays */ });
  }

  requestAnimationFrame(loop);
})();
