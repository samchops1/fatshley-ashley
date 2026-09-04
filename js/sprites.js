
(function (global) {
  'use strict';

  const P = {
    wood: '#3d1f12',
    woodLight: '#5c3220',
    woodDark: '#241208',
    amber: '#e89a2c',
    neon: '#ffdd44',
    neonPink: '#ff4466',
    deepRed: '#8b1520',
    darkBg: '#1a0508',
    floor: '#2a1810',
    vodka: '#c8e8f0',
    ashSkin: '#e8c4a8',
    ashHair: '#1a0e08',
    ashDress: '#121212',
    barTop: '#4a2818',
    stool: '#3a2010',
  };

  let atlas = null;
  let ashleyImg = null;
  let patronsImg = null;
  let tilesImg = null;
  let tavernImg = null;
  let ready = false;
  let loadPromise = null;

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Failed to load ' + src)); };
      img.src = src;
    });
  }

  function loadSheets(base) {
    base = base || 'assets/';
    if (loadPromise) return loadPromise;
    loadPromise = (async function () {
      const atlasUrl = base + 'atlas.json';
      const res = await fetch(atlasUrl);
      if (!res.ok) throw new Error('atlas fetch failed');
      atlas = await res.json();
      const aPath = base + (atlas.ashley.image || 'ashley_sheet.png');
      const pPath = base + (atlas.patrons.image || 'patrons_sheet.png');
      const tPath = base + ((atlas.tiles && atlas.tiles.image) || 'bar_tiles.png');
      const bt = atlas.bar_tavern;
      const tavernPath = bt ? base + (bt.image || 'bar_tavern.png') : null;
      ashleyImg = await loadImage(aPath);
      patronsImg = await loadImage(pPath);
      tilesImg = null;
      try { tilesImg = await loadImage(tPath); } catch (e) { console.warn('[Sprites] bar_tiles optional miss', e); }
      tavernImg = null;
      if (tavernPath) {
        try {
          tavernImg = await loadImage(tavernPath);
        } catch (e) {
          console.warn('[Sprites] bar_tavern load failed, using tiles fallback', e);
          tavernImg = null;
        }
      }
      ready = true;
      return true;
    })().catch(function (err) {
      ready = false;
      console.warn('[Sprites] sheet load failed, using procedural', err);
      return false;
    });
    return loadPromise;
  }

  
  function blit(ctx, img, frame, dx, dy, scale) {
    if (!img || !frame) return;
    scale = scale == null ? 1 : scale;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      frame.x, frame.y, frame.w, frame.h,
      Math.floor(dx), Math.floor(dy),
      Math.floor(frame.w * scale), Math.floor(frame.h * scale)
    );
    ctx.imageSmoothingEnabled = prev;
  }

  function tileFrame(id) {
    return atlas && atlas.tiles && atlas.tiles.frames ? atlas.tiles.frames[id] : null;
  }

  function blitTile(ctx, id, dx, dy, scale) {
    const fr = tileFrame(id);
    if (!fr || !tilesImg) return false;
    blit(ctx, tilesImg, fr, dx, dy, scale == null ? 1 : scale);
    return true;
  }

  function tavernFrame(id) {
    return atlas && atlas.bar_tavern && atlas.bar_tavern.frames
      ? atlas.bar_tavern.frames[id]
      : null;
  }

  function blitTavern(ctx, id, dx, dy, scale) {
    const fr = tavernFrame(id);
    if (!fr || !tavernImg) return false;
    blit(ctx, tavernImg, fr, dx, dy, scale == null ? 1 : scale);
    return true;
  }

  function hasTavern() {
    return !!(ready && tavernImg && atlas && atlas.bar_tavern && atlas.bar_tavern.frames);
  }

  function feetPivot(x, y, scale) {
    return { dx: x - 32 * scale, dy: y - 78 * scale };
  }

  function drawNeonSign(ctx, cx, y) {
    if (ready && tilesImg && tileFrame('neon_c')) {
      const letters = ['neon_c', 'neon_a', 'neon_n', 'neon_d'];
      const scale = 1;
      const cell = 32 * scale;
      const gap = 2;
      const blockW = letters.length * (cell + gap) - gap;
      let lx = cx - blockW / 2;
      letters.forEach(function (id) {
        blitTile(ctx, id, lx, y - 20, scale);
        lx += cell + gap;
      });
      ctx.save();
      ctx.font = 'bold 12px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = P.neon;
      ctx.shadowBlur = 10;
      ctx.fillStyle = P.neon;
      ctx.fillText('Candlelight Tavern', cx, y + 22);
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#fff8c0';
      ctx.fillText('Candlelight Tavern', cx, y + 22);
      ctx.restore();
      return;
    }
    const text = 'Candlelight Tavern';
    ctx.save();
    ctx.font = 'bold 16px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = P.neon;
    ctx.shadowBlur = 12;
    ctx.fillStyle = P.neon;
    ctx.fillText(text, cx, y);
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff8c0';
    ctx.fillText(text, cx, y);
    ctx.shadowBlur = 8;
    ctx.strokeStyle = P.neonPink;
    ctx.lineWidth = 2;
    const tw = ctx.measureText(text).width;
    ctx.strokeRect(cx - tw / 2 - 10, y - 18, tw + 20, 26);
    ctx.restore();
  }

  
  function blitMarqueeStrip(ctx, neonIds, x, y, scale) {
    scale = scale == null ? 1 : scale;
    const cell = 32 * scale;
    blitTavern(ctx, 'marquee_frame_l', x, y, scale);
    let cx = x + cell;
    neonIds.forEach(function (id, i) {
      if (i === 2) blitTavern(ctx, 'marquee_frame_m', cx - cell * 0.15, y, scale);
      blitTavern(ctx, id, cx, y, scale);
      cx += cell;
    });
    blitTavern(ctx, 'marquee_frame_r', cx, y, scale);
    return cx + cell - x;
  }

  
  function drawBarBackgroundTavern(ctx, W, H) {
    const floorY = Math.floor(H * 0.42);
    const bricks = ['brick_a', 'brick_b', 'brick_dark', 'brick_mortar', 'brick_soot'];

    for (let y = 0; y < floorY; y += 32) {
      for (let x = 0; x < W; x += 32) {
        const col = Math.floor(x / 32);
        const row = Math.floor(y / 32);
        let id = bricks[(col + row * 2) % bricks.length];
        if (row === 0 && col % 5 === 0) id = 'brick_soot';
        if (col % 4 === 3) id = 'brick_mortar';
        blitTavern(ctx, id, x, y, 1);
      }
    }

    blitTavern(ctx, 'tv_sports', 18, 28, 1);
    blitTavern(ctx, 'tv_fight', W - 50, 28, 1);
    blitTavern(ctx, 'amber_sconce', 56, 20, 1);
    blitTavern(ctx, 'amber_sconce', W - 88, 20, 1);
    blitTavern(ctx, 'amber_spill', 56, 48, 0.85);
    blitTavern(ctx, 'amber_spill', W - 88, 48, 0.85);
    blitTavern(ctx, 'amber_lamp', 90, 70, 0.9);
    blitTavern(ctx, 'amber_lamp', W - 122, 70, 0.9);

    const cocktails = [
      'marquee_neon_cocktails_0', 'marquee_neon_cocktails_1',
      'marquee_neon_cocktails_2', 'marquee_neon_cocktails_3',
    ];
    const finefood = [
      'marquee_neon_finefood_0', 'marquee_neon_finefood_1',
      'marquee_neon_finefood_2', 'marquee_neon_finefood_3',
    ];
    const candle = [
      'neon_candlelight_0', 'neon_candlelight_1',
      'neon_candlelight_2', 'neon_candlelight_3',
    ];
    const tavern = [
      'neon_tavern_0', 'neon_tavern_1', 'neon_tavern_2', 'neon_tavern_3',
    ];
    const stripW = 32 + 4 * 32 + 32; // frame_l + 4 neon + frame_r
    const mx = Math.floor((W - stripW) / 2);
    blitMarqueeStrip(ctx, cocktails, mx, 8, 1);
    blitMarqueeStrip(ctx, finefood, mx, 40, 1);
    const nameY = 72;
    const nameScale = 0.85;
    const nameCell = 32 * nameScale;
    const nameStripW = nameCell + 4 * nameCell + nameCell;
    const nx = Math.floor((W - nameStripW) / 2);
    blitMarqueeStrip(ctx, candle, nx, nameY, nameScale);
    if (tavernFrame('neon_tavern_0')) {
      blitMarqueeStrip(ctx, tavern, nx, nameY + Math.floor(nameCell) + 2, nameScale);
    }

    for (let y = floorY; y < H; y += 32) {
      for (let x = 0; x < W; x += 32) {
        if (tileFrame('floor_wood_a') && tilesImg) {
          const id = ((x + y) / 32) % 2 === 0 ? 'floor_wood_a' : 'floor_wood_b';
          blitTile(ctx, id, x, y, 1);
        } else {
          blitTavern(ctx, ((x + y) / 32) % 2 === 0 ? 'brick_a' : 'brick_dark', x, y, 1);
        }
      }
    }
    if (tileFrame('floor_plank_line') && tilesImg) {
      for (let y = floorY; y < H; y += 48) {
        for (let x = 0; x < W; x += 32) {
          blitTile(ctx, 'floor_plank_line', x, y, 1);
        }
      }
    }

    blitTavern(ctx, 'pool_felt_a', 8, floorY + 8, 0.9);
    blitTavern(ctx, 'pool_felt_b', 8, floorY + 36, 0.9);
    blitTavern(ctx, 'shuffleboard_a', W - 40, floorY + 10, 0.9);
    blitTavern(ctx, 'shuffleboard_b', W - 40, floorY + 38, 0.9);

    const islandW = Math.min(260, W - 80);
    const islandX = Math.floor((W - islandW) / 2);
    const barTopY = Math.floor(H * 0.46);
    const barDepth = 56;
    const frontY = barTopY + 28;

    for (let x = islandX + 16; x < islandX + islandW - 16; x += 32) {
      blitTavern(ctx, 'center_bar_top', x, barTopY - 8, 1);
    }
    for (let x = islandX; x < islandX + islandW; x += 32) {
      blitTavern(ctx, 'center_bar_front', x, frontY, 1);
      if (barDepth > 32) blitTavern(ctx, 'center_bar_front', x, frontY + 24, 1);
    }
    blitTavern(ctx, 'center_bar_end_l', islandX - 16, barTopY + 4, 1);
    blitTavern(ctx, 'center_bar_end_r', islandX + islandW - 16, barTopY + 4, 1);

    for (let x = islandX; x < islandX + islandW; x += 32) {
      blitTavern(ctx, 'center_bar_top', x, barTopY, 1);
    }
    blitTavern(ctx, 'center_bar_corner_l', islandX - 8, frontY - 4, 1);
    blitTavern(ctx, 'center_bar_corner_r', islandX + islandW - 24, frontY - 4, 1);
    for (let x = islandX + 16; x < islandX + islandW - 16; x += 32) {
      blitTavern(ctx, 'center_bar_shine', x, barTopY, 1);
    }

    blitTavern(ctx, 'burger_plate', islandX + Math.floor(islandW / 2) - 16, barTopY - 6, 1);

    if (tilesImg && tileFrame('shelf')) {
      for (let x = islandX + 16; x < islandX + islandW - 16; x += 32) {
        blitTile(ctx, 'shelf', x, 108, 1);
      }
      const bottles = ['bottle_vodka', 'bottle_red', 'bottle_amber', 'bottle_green'];
      for (let i = 0; i < 6; i++) {
        const bx = islandX + 24 + i * 34;
        if (bx + 32 > islandX + islandW - 16) break;
        blitTile(ctx, bottles[i % bottles.length], bx, 84, 0.8);
      }
    }

    const stoolY = frontY + 42;
    const stoolXs = [
      islandX - 14,
      islandX + 36,
      islandX + Math.floor(islandW / 2) - 16,
      islandX + islandW - 68,
      islandX + islandW - 18,
    ];
    stoolXs.forEach(function (sx) {
      if (sx < 4 || sx > W - 36) return;
      if (tavernFrame('center_stool')) {
        blitTavern(ctx, 'center_stool', sx, stoolY, 1);
      } else {
        blitTile(ctx, 'stool_shadow', sx, stoolY + 20, 0.9);
        blitTile(ctx, 'stool_leg', sx + 4, stoolY + 10, 0.85);
        blitTile(ctx, 'stool_seat', sx, stoolY, 0.9);
      }
    });
  }

  
  function drawBarBackgroundSheet(ctx, W, H) {
    const floorY = Math.floor(H * 0.42);

    for (let y = 0; y < floorY; y += 32) {
      for (let x = 0; x < W; x += 32) {
        const id = (Math.floor(x / 32) % 3 === 1) ? 'wall_stripe' : 'wall_dark';
        blitTile(ctx, id, x, y, 1);
      }
    }
    for (let x = 40; x < W - 40; x += 32) {
      blitTile(ctx, 'wall_neon_pink', x, 52, 1);
    }

    drawNeonSign(ctx, W / 2, 38);

    for (let y = floorY; y < H; y += 32) {
      for (let x = 0; x < W; x += 32) {
        const id = ((x + y) / 32) % 2 === 0 ? 'floor_wood_a' : 'floor_wood_b';
        blitTile(ctx, id, x, y, 1);
      }
    }
    for (let y = floorY; y < H; y += 48) {
      for (let x = 0; x < W; x += 32) {
        blitTile(ctx, 'floor_plank_line', x, y, 1);
      }
    }

    const islandW = Math.min(260, W - 80);
    const islandX = Math.floor((W - islandW) / 2);
    const barTopY = Math.floor(H * 0.46);
    const barFrontH = 48;

    for (let x = islandX; x < islandX + islandW; x += 32) {
      blitTile(ctx, 'shelf', x, 78, 1);
    }
    const bottles = ['bottle_vodka', 'bottle_red', 'bottle_amber', 'bottle_green'];
    for (let i = 0; i < 8; i++) {
      const bx = islandX + 8 + i * 30;
      if (bx + 32 > islandX + islandW) break;
      blitTile(ctx, bottles[i % bottles.length], bx, 52, 0.85);
    }

    for (let x = islandX; x < islandX + islandW; x += 32) {
      blitTile(ctx, 'bar_top', x, barTopY, 1);
    }
    for (let x = islandX + 16; x < islandX + islandW - 16; x += 32) {
      blitTile(ctx, 'bar_shine', x, barTopY, 1);
    }
    for (let row = 0; row < Math.ceil(barFrontH / 32); row++) {
      for (let x = islandX; x < islandX + islandW; x += 32) {
        blitTile(ctx, 'bar_front', x, barTopY + 28 + row * 28, 1);
      }
    }
    blitTile(ctx, 'counter_edge', islandX - 8, barTopY + 20, 1);
    blitTile(ctx, 'counter_edge', islandX + islandW - 24, barTopY + 20, 1);

    const stoolY = barTopY + 70;
    const stoolXs = [
      islandX - 10,
      islandX + 40,
      islandX + islandW / 2 - 16,
      islandX + islandW - 72,
      islandX + islandW - 20,
    ];
    stoolXs.forEach(function (sx) {
      if (sx < 8 || sx > W - 40) return;
      blitTile(ctx, 'stool_shadow', sx, stoolY + 20, 0.9);
      blitTile(ctx, 'stool_leg', sx + 4, stoolY + 10, 0.85);
      blitTile(ctx, 'stool_seat', sx, stoolY, 0.9);
    });
  }

  function drawBarBackgroundProcedural(ctx, W, H) {
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    grad.addColorStop(0, '#2a0810');
    grad.addColorStop(1, '#4a1520');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H * 0.45);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let x = 0; x < W; x += 24) {
      ctx.fillRect(x, 0, 8, H * 0.45);
    }

    ctx.fillStyle = P.floor;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = H * 0.45; y < H; y += 18) {
      ctx.fillRect(0, y, W, 2);
    }
    for (let x = 0; x < W; x += 28) {
      ctx.fillRect(x, H * 0.45, 2, H * 0.55);
    }

    drawNeonSign(ctx, W / 2, 38);

    px(ctx, 40, 70, W - 80, 8, P.woodDark);
    px(ctx, 40, 78, W - 80, 4, P.wood);
    const bottles = [
      ['#c8e8f0', 60], ['#a03020', 95], ['#e8d080', 130],
      ['#60a040', 165], ['#c8e8f0', 200], ['#d06030', 235],
      ['#e8d080', 270], ['#a03020', 305],
    ];
    bottles.forEach(function (pair) {
      const c = pair[0];
      const x = pair[1];
      if (x > W - 50) return;
      px(ctx, x, 48, 10, 22, c);
      px(ctx, x + 2, 42, 6, 8, '#ddd');
      px(ctx, x + 3, 40, 4, 4, '#888');
    });

    const islandW = Math.min(260, W - 80);
    const islandX = (W - islandW) / 2;
    const barY = H * 0.46;
    px(ctx, islandX, barY, islandW, 28, P.barTop);
    px(ctx, islandX, barY + 28, islandW, 50, P.wood);
    px(ctx, islandX, barY + 28, islandW, 6, P.woodLight);
    ctx.fillStyle = 'rgba(255,200,100,0.08)';
    ctx.fillRect(islandX + 4, barY + 2, islandW - 8, 8);

    const stoolYs = barY + 78;
    const stoolXs = [islandX - 8, islandX + 50, islandX + islandW / 2 - 14, islandX + islandW - 78, islandX + islandW - 22];
    stoolXs.forEach(function (sx) {
      if (sx < 10 || sx > W - 40) return;
      px(ctx, sx, stoolYs, 28, 8, P.stool);
      px(ctx, sx + 10, stoolYs + 8, 8, 22, P.woodDark);
      px(ctx, sx + 4, stoolYs + 28, 20, 4, P.woodDark);
    });
  }

  function drawBarBackground(ctx, W, H) {
    if (hasTavern()) {
      drawBarBackgroundTavern(ctx, W, H);
    } else if (ready && tilesImg && atlas) {
      drawBarBackgroundSheet(ctx, W, H);
    } else {
      drawBarBackgroundProcedural(ctx, W, H);
    }
  }

  function pickAshleyFrameId(frame, holdingBottle, frameId) {
    if (typeof frameId === 'string' && frameId) return frameId;
    if (holdingBottle && frame % 30 < 8) return 'drink_sip';
    return (frame % 40 < 20) ? 'idle_0' : 'idle_1';
  }

  function drawAshleySheet(ctx, x, y, scale, frame, holdingBottle, frameId) {
    const id = pickAshleyFrameId(frame, holdingBottle, frameId);
    const fr = atlas.ashley.frames[id] || atlas.ashley.frames.idle_0;
    const piv = feetPivot(x, y, scale);
    blit(ctx, ashleyImg, fr, piv.dx, piv.dy, scale);
  }

  function drawAshleyProcedural(ctx, x, y, scale, frame, holdingBottle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 54, 34, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const wobble = Math.sin(frame * 0.15) * 1.5;
    const armSwing = Math.sin(frame * 0.12) * 3;

    px(ctx, -18 + wobble, 28, 16, 24, '#2a1820');
    px(ctx, 2 - wobble, 28, 16, 24, '#2a1820');
    px(ctx, -20 + wobble, 48, 18, 7, '#0e0a0c');
    px(ctx, 2 - wobble, 48, 18, 7, '#0e0a0c');

    px(ctx, -30, 2, 60, 30, P.ashSkin);
    px(ctx, -32, 14, 64, 20, P.ashSkin);
    px(ctx, -28, -8, 56, 28, P.ashDress);
    px(ctx, -30, 6, 60, 14, P.ashDress);
    px(ctx, -18, -6, 8, 16, '#2a2a2a');

    px(ctx, -10, -6, 18, 5, '#1a1010');
    px(ctx, -8, -5, 2, 3, '#0a0808');
    px(ctx, -4, -5, 2, 3, '#0a0808');
    px(ctx, 0, -5, 2, 3, '#0a0808');
    px(ctx, 4, -5, 2, 3, '#0a0808');

    px(ctx, -40, 0 + armSwing, 14, 30, P.ashSkin);
    px(ctx, 26, 0 - armSwing, 14, 30, P.ashSkin);
    px(ctx, -42, 26 + armSwing, 12, 8, P.ashSkin);
    px(ctx, 30, 26 - armSwing, 12, 8, P.ashSkin);

    px(ctx, -18, -36, 36, 34, P.ashSkin);
    px(ctx, -20, -10, 40, 12, P.ashSkin);
    px(ctx, -14, -6, 28, 8, P.ashSkin);

    px(ctx, -24, -48, 48, 20, P.ashHair);
    px(ctx, -28, -40, 14, 28, P.ashHair);
    px(ctx, 14, -42, 16, 30, P.ashHair);
    px(ctx, -12, -54, 10, 12, P.ashHair);
    px(ctx, 2, -56, 12, 14, P.ashHair);
    px(ctx, -30, -28, 8, 18, P.ashHair);
    px(ctx, 22, -30, 8, 20, P.ashHair);
    px(ctx, -6, -50, 6, 8, '#2a1810');

    px(ctx, -12, -26, 8, 5, '#1a0808');
    px(ctx, 4, -26, 8, 5, '#1a0808');
    px(ctx, -10, -25, 3, 2, '#eee');
    px(ctx, 6, -25, 3, 2, '#eee');
    px(ctx, -13, -28, 10, 2, '#0a0404');

    px(ctx, -8, -14, 16, 4, '#a05060');
    px(ctx, -6, -13, 12, 2, '#e8c0c8');

    px(ctx, -16, -18, 7, 4, 'rgba(220,90,90,0.45)');
    px(ctx, 9, -18, 7, 4, 'rgba(220,90,90,0.45)');

    px(ctx, 2, -20, 3, 3, '#d4a017');
    px(ctx, 3, -19, 1, 1, '#ffe08a');

    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-20, -18, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(20, -18, 7, 0, Math.PI * 2);
    ctx.stroke();
    px(ctx, -21, -19, 2, 2, '#ffe08a');
    px(ctx, 19, -19, 2, 2, '#ffe08a');

    if (holdingBottle) {
      px(ctx, 34, -10 - armSwing, 10, 24, P.vodka);
      px(ctx, 36, -16 - armSwing, 6, 8, '#aaa');
      px(ctx, 37, -18 - armSwing, 4, 4, '#666');
      px(ctx, 35, 2 - armSwing, 8, 4, '#e8f4f8');
    }

    ctx.restore();
  }

  function drawAshley(ctx, x, y, scale, frame, holdingBottle, frameId) {
    if (ready && ashleyImg && atlas && atlas.ashley) {
      drawAshleySheet(ctx, x, y, scale, frame, holdingBottle, frameId);
    } else {
      drawAshleyProcedural(ctx, x, y, scale, frame, holdingBottle);
    }
  }

  function drawBartender(ctx, x, y, scale, frame) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    px(ctx, -12, 10, 24, 30, '#2a3040');
    px(ctx, -10, 12, 20, 20, '#d0d0d8');
    px(ctx, -14, -18, 28, 28, '#d4a878');
    px(ctx, -16, -28, 32, 14, '#1a1010');
    px(ctx, -8, -10, 5, 4, '#222');
    px(ctx, 4, -10, 5, 4, '#222');
    px(ctx, -6, -2, 12, 3, '#884040');
    const tw = Math.sin(frame * 0.08) * 8;
    px(ctx, 10 + tw, 8, 14, 6, '#c0a060');

    ctx.restore();
  }

  function poseFromState(poseOrState) {
    if (poseOrState === 'approaching' || poseOrState === 'leaving' || poseOrState === 'walk') return 'walk';
    if (poseOrState === 'talking' || poseOrState === 'talk') return 'talk';
    return 'idle';
  }

  function drawPatronSheet(ctx, x, y, scale, variant, frame, facing, poseOrState) {
    const v = (variant % 4 + 4) % 4;
    const pose = poseFromState(poseOrState);
    let key = 'v' + v + '_' + pose;
    if (pose === 'walk' && frame % 20 < 10) {
    }
    const fr = atlas.patrons.frames[key] || atlas.patrons.frames['v' + v + '_idle'];
    const piv = feetPivot(x, y, scale);
    ctx.save();
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    blit(ctx, patronsImg, fr, piv.dx, piv.dy + (pose === 'walk' ? Math.sin(frame * 0.3) * 1.5 : 0), scale);
    ctx.restore();
  }

  function drawPatronProcedural(ctx, x, y, scale, variant, frame, facing) {
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-scale, scale);
    else ctx.scale(scale, scale);

    const skins = ['#6b4423', '#5a3818', '#4a2c14', '#7a5030'];
    const shirts = ['#3a5080', '#604028', '#2a6040', '#703050'];
    const pants = ['#2a2030', '#1a1820', '#302818', '#202028'];
    const hairs = ['#1a1010', '#2a2018', '#3a3028', '#0a0808'];
    const skin = skins[variant % 4];
    const shirt = shirts[variant % 4];
    const pant = pants[variant % 4];
    const hair = hairs[variant % 4];

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 48, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const walk = Math.sin(frame * 0.2) * 2;

    px(ctx, -12, 28, 12, 20, pant);
    px(ctx, 2, 28, 12, 20, pant);
    px(ctx, -14, 44, 14, 5, '#1a1010');
    px(ctx, 2, 44, 14, 5, '#1a1010');

    px(ctx, -22, -2, 44, 34, shirt);
    px(ctx, -24, 10, 48, 18, shirt);
    px(ctx, -8, 14, 16, 10, 'rgba(255,255,255,0.08)');

    px(ctx, -30, 4 + walk, 10, 26, skin);
    px(ctx, 20, 4 - walk, 10, 26, skin);

    px(ctx, -14, -30, 28, 28, skin);
    if (variant % 2 === 0) {
      px(ctx, -14, -36, 28, 12, hair);
      px(ctx, -16, -28, 6, 10, hair);
      px(ctx, 10, -28, 6, 10, hair);
      px(ctx, -6, -34, 12, 8, skin);
    } else {
      px(ctx, -12, -34, 24, 10, '#8a8070');
      px(ctx, -14, -28, 5, 8, '#8a8070');
    }
    px(ctx, -8, -18, 5, 4, '#1a1010');
    px(ctx, 4, -18, 5, 4, '#1a1010');
    px(ctx, -9, -14, 7, 2, 'rgba(0,0,0,0.25)');
    px(ctx, 3, -14, 7, 2, 'rgba(0,0,0,0.25)');
    if (variant !== 1) {
      px(ctx, -8, -6, 16, 4, hair);
    }
    px(ctx, -5, -2, 10, 3, '#4a2020');
    px(ctx, -10, -2, 20, 8, skin);
    px(ctx, -8, 4, 16, 4, 'rgba(0,0,0,0.15)');

    ctx.restore();
  }

  
  function drawPatron(ctx, x, y, scale, variant, frame, facing, poseOrState) {
    if (ready && patronsImg && atlas && atlas.patrons) {
      drawPatronSheet(ctx, x, y, scale, variant, frame, facing, poseOrState);
    } else {
      drawPatronProcedural(ctx, x, y, scale, variant, frame, facing);
    }
  }

  function drawVodkaIcon(ctx, x, y, s) {
    px(ctx, x, y + 4 * s, 10 * s, 18 * s, P.vodka);
    px(ctx, x + 2 * s, y, 6 * s, 6 * s, '#aaa');
    px(ctx, x + 3 * s, y - 2 * s, 4 * s, 3 * s, '#666');
    px(ctx, x + 1 * s, y + 10 * s, 8 * s, 4 * s, 'rgba(255,255,255,0.4)');
  }

  function drawSpeechBubble(ctx, x, y, text, maxW) {
    ctx.save();
    ctx.font = '11px Courier New, monospace';
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach(function (w) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW) {
        if (line) lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);

    const lineH = 14;
    const pad = 8;
    const bw = Math.min(maxW + pad * 2, Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + pad * 2);
    const bh = lines.length * lineH + pad * 2;

    let bx = x - bw / 2;
    bx = Math.max(4, Math.min(bx, 390 - bw - 4));
    const by = y - bh - 12;

    ctx.fillStyle = 'rgba(255, 245, 220, 0.95)';
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 6, by + bh);
    ctx.lineTo(x, by + bh + 10);
    ctx.lineTo(x + 6, by + bh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1a1008';
    ctx.textAlign = 'left';
    lines.forEach(function (l, i) {
      ctx.fillText(l, bx + pad, by + pad + (i + 1) * lineH - 2);
    });
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.Sprites = {
    P,
    px,
    ready: function () { return ready; },
    loadSheets,
    blit,
    tavernFrame,
    blitTavern,
    drawBarBackground,
    drawNeonSign,
    drawAshley,
    drawBartender,
    drawPatron,
    drawVodkaIcon,
    drawSpeechBubble,
    roundRect,
  };
})(typeof window !== 'undefined' ? window : globalThis);