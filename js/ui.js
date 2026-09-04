/* UI: buttons, meters, screens for Fatshley Ashley */
(function (global) {
  'use strict';

  /** Hit test with optional pad (default 10px for fat fingers). */
  function hitRect(px, py, r, pad) {
    pad = pad == null ? 10 : pad;
    return (
      px >= r.x - pad &&
      px <= r.x + r.w + pad &&
      py >= r.y - pad &&
      py <= r.y + r.h + pad
    );
  }

  /** Alias — inflate hit tests only (does not change draw rects). */
  function hitPad(px, py, r, pad) {
    return hitRect(px, py, r, pad);
  }

  function drawButton(ctx, r, label, opts) {
    opts = opts || {};
    const pressed = opts.pressed;
    const danger = opts.danger;
    const accent = opts.accent || '#ffcc44';
    const bg = opts.bg || (danger ? '#6a1020' : '#3a1810');

    ctx.save();
    Sprites.roundRect(ctx, r.x, r.y + (pressed ? 2 : 0), r.w, r.h, 10);
    ctx.fillStyle = pressed ? '#5a2820' : bg;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner glow
    ctx.fillStyle = 'rgba(255,200,80,0.08)';
    Sprites.roundRect(ctx, r.x + 3, r.y + 3 + (pressed ? 2 : 0), r.w - 6, r.h * 0.4, 6);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.font = 'bold ' + (opts.fontSize || 16) + 'px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + (pressed ? 2 : 0) + 1);
    ctx.restore();
  }

  /**
   * Buzz zones (align with fail buzz>=100 and warn >80):
   * 0–25 sober | 25–80 safe | 80–95 warn | 95–100 blackout tip
   * When buzz < 25: show Math.floor(buzz) + sober fuse countdown
   * (fail when soberTimer > 6 → remaining ≈ max(0, 6 - soberTimer)).
   */
  function drawBuzzMeter(ctx, x, y, w, h, buzz, soberTimer) {
    soberTimer = soberTimer == null ? 0 : soberTimer;

    // Track
    ctx.fillStyle = '#1a0808';
    Sprites.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#884422';
    ctx.lineWidth = 2;
    Sprites.roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();

    const innerX = x + 2;
    const innerW = w - 4;
    const innerY = y + 2;
    const innerH = h - 4;

    // Zone backgrounds
    // 0–25 sober
    ctx.fillStyle = 'rgba(60,100,220,0.35)';
    ctx.fillRect(innerX, innerY, innerW * 0.25, innerH);
    // 25–80 safe
    ctx.fillStyle = 'rgba(60,160,60,0.35)';
    ctx.fillRect(innerX + innerW * 0.25, innerY, innerW * 0.55, innerH);
    // 80–95 warn
    ctx.fillStyle = 'rgba(220,160,40,0.40)';
    ctx.fillRect(innerX + innerW * 0.80, innerY, innerW * 0.15, innerH);
    // 95–100 blackout tip
    ctx.fillStyle = 'rgba(200,40,40,0.50)';
    ctx.fillRect(innerX + innerW * 0.95, innerY, innerW * 0.05, innerH);

    // Fill
    const fillW = Math.max(0, Math.min(1, buzz / 100)) * innerW;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#4488ff');
    grad.addColorStop(0.25, '#44cc66');
    grad.addColorStop(0.80, '#44cc66');
    grad.addColorStop(0.95, '#ffaa22');
    grad.addColorStop(1, '#ff2244');
    ctx.fillStyle = grad;
    ctx.fillRect(innerX, innerY, fillW, innerH);

    // Zone guide ticks ON TOP of fill (not buried)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    [0.25, 0.80, 0.95].forEach(function (t) {
      const tx = innerX + innerW * t;
      ctx.beginPath();
      ctx.moveTo(tx, innerY);
      ctx.lineTo(tx, innerY + innerH);
      ctx.stroke();
    });
    // Soft zone wash overlays so colors stay readable over fill
    ctx.fillStyle = 'rgba(60,100,220,0.18)';
    ctx.fillRect(innerX, innerY, innerW * 0.25, innerH);
    ctx.fillStyle = 'rgba(60,160,60,0.12)';
    ctx.fillRect(innerX + innerW * 0.25, innerY, innerW * 0.55, innerH);
    ctx.fillStyle = 'rgba(220,160,40,0.22)';
    ctx.fillRect(innerX + innerW * 0.80, innerY, innerW * 0.15, innerH);
    ctx.fillStyle = 'rgba(200,40,40,0.28)';
    ctx.fillRect(innerX + innerW * 0.95, innerY, innerW * 0.05, innerH);

    // Needle
    const nx = innerX + fillW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(nx - 1.5, y - 2, 3, h + 4);

    // Labels
    ctx.fillStyle = '#ffcc88';
    ctx.font = '10px Courier New, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SOBER', x, y - 4);
    ctx.textAlign = 'right';
    ctx.fillText('BLACKOUT', x + w, y - 4);
    ctx.textAlign = 'center';
    ctx.fillText('BUZZ', x + w / 2, y - 4);

    // Numeric buzz + sober fuse (when buzz < 25)
    if (buzz < 25) {
      const remain = Math.max(0, 6 - soberTimer);
      ctx.fillStyle = '#88aaff';
      ctx.font = 'bold 11px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        Math.floor(buzz) + '  fuse ' + remain.toFixed(1) + 's',
        x + w / 2,
        y + h + 14
      );
    } else {
      ctx.fillStyle = '#ddccaa';
      ctx.font = '10px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.floor(buzz)), x + w / 2, y + h + 14);
    }
  }

  function drawTimer(ctx, x, y, remain, total) {
    const m = Math.floor(remain / 60);
    const s = Math.floor(remain % 60);
    const str = m + ':' + (s < 10 ? '0' : '') + s;
    ctx.fillStyle = remain < 20 ? '#ff4466' : '#ffcc44';
    ctx.font = 'bold 18px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAST CALL ' + str, x, y);
    // Progress bar
    const bw = 160;
    ctx.fillStyle = '#2a1010';
    ctx.fillRect(x - bw / 2, y + 6, bw, 6);
    ctx.fillStyle = '#e89a2c';
    ctx.fillRect(x - bw / 2, y + 6, bw * Math.max(0, remain / total), 6);
  }

  function drawScoreHud(ctx, x, y, score, shots, handled, lines) {
    lines = lines == null ? 0 : lines;
    ctx.fillStyle = '#ffddaa';
    ctx.font = '12px Courier New, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, x, y);
    ctx.fillText('SHOTS ' + shots + '  LINES ' + lines + '  PPL ' + handled, x, y + 14);
  }

  /** Layout with safe-area bottom inset for home indicator / notches. */
  function layoutPlayControls(W, H) {
    const btnH = 52;
    const moveW = 64;
    const actW = 70;
    const margin = 10;
    const gap = 6;
    const safeBottom = 28; // safe-area bottom padding on controls
    const y = H - btnH - safeBottom;
    // Bottom: ◀ ▶ | CRASH | LINE | DRINK  (thumbs fit 390×700)
    const left = { x: margin, y: y, w: moveW, h: btnH, id: 'left' };
    const right = { x: margin + moveW + gap, y: y, w: moveW, h: btnH, id: 'right' };
    const drinkX = W - margin - actW;
    const lineX = drinkX - gap - actW;
    const crashX = lineX - gap - actW;
    return {
      left: left,
      right: right,
      crash: { x: crashX, y: y, w: actW, h: btnH, id: 'crash' },
      line: { x: lineX, y: y, w: actW, h: btnH, id: 'line' },
      drink: { x: drinkX, y: y, w: actW, h: btnH, id: 'drink' },
      ignore: { x: margin, y: y - btnH - 10, w: 100, h: 44, id: 'ignore' },
      flirt: { x: W / 2 - 50, y: y - btnH - 10, w: 100, h: 44, id: 'flirt' },
      yell: { x: W - 100 - margin, y: y - btnH - 10, w: 100, h: 44, id: 'yell' },
    };
  }

  /** Shared play button layout (hit + draw) — do not re-layout inside tap handlers via drawTitleScreen. */
  function layoutPlayBtn(W, H) {
    return { x: W / 2 - 80, y: 520, w: 160, h: 56, id: 'play' };
  }

  function layoutRetryBtn(W, H) {
    return { x: W / 2 - 80, y: 500, w: 160, h: 56, id: 'retry' };
  }

  function drawTitleScreen(ctx, W, H, highScore, frame) {
    // Dark bar vibe bg
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a0508');
    g.addColorStop(0.5, '#3a1020');
    g.addColorStop(1, '#1a0508');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    Sprites.drawNeonSign(ctx, W / 2, 80);

    ctx.fillStyle = '#ff4466';
    ctx.font = 'bold 36px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 16;
    ctx.fillText('FATSHLEY', W / 2, 160);
    ctx.fillText('ASHLEY', W / 2, 200);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffcc66';
    ctx.font = '14px Courier New, monospace';
    ctx.fillText('Dive Bar Survival Comedy', W / 2, 235);

    Sprites.drawAshley(ctx, W / 2, 340, 1.6, frame, true);

    ctx.fillStyle = '#ccaa88';
    ctx.font = '12px Courier New, monospace';
    ctx.fillText('Wash Park dive. Greasy burgers. Worse decisions.', W / 2, 430);
    ctx.fillText('Vodka + rails. Yell. Crash out. Last Call.', W / 2, 448);

    if (highScore > 0) {
      ctx.fillStyle = '#ffaa44';
      ctx.fillText('HIGH SCORE: ' + highScore, W / 2, 480);
    }

    const playBtn = layoutPlayBtn(W, H);
    drawButton(ctx, playBtn, 'PLAY', { fontSize: 22, accent: '#ffee88', bg: '#5a1820' });

    ctx.fillStyle = '#886655';
    ctx.font = '10px Courier New, monospace';
    ctx.fillText('Arrows · DRINK · LINE · CRASH · IGNORE/FLIRT/YELL', W / 2, 610);
    ctx.fillText('Candlelight Tavern — open till Last Call', W / 2, 628);

    return { play: playBtn };
  }

  function drawResults(ctx, W, H, result) {
    ctx.fillStyle = 'rgba(10,2,4,0.92)';
    ctx.fillRect(0, 0, W, H);

    const win = result.reason === 'win';
    const title =
      result.reason === 'blackout' ? 'BLACKOUT' :
      result.reason === 'crash' ? 'CRASH OUT' :
      result.reason === 'sober' ? 'TOO SOBER' :
      'LAST CALL — Candlelight Tavern';

    ctx.fillStyle = win ? '#44ff88' : '#ff4466';
    ctx.font = 'bold 26px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    // Wrap long win title
    if (win) {
      ctx.fillText('LAST CALL', W / 2, 160);
      ctx.font = 'bold 20px Courier New, monospace';
      ctx.fillText('Still upright at the Tavern.', W / 2, 190);
    } else {
      ctx.fillText(title, W / 2, 180);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffddaa';
    ctx.font = '16px Courier New, monospace';
    ctx.fillText('Score: ' + result.score, W / 2, 250);
    ctx.fillText('Shots: ' + result.shots, W / 2, 278);
    ctx.fillText('Patrons handled: ' + result.handled, W / 2, 306);
    ctx.fillText('Time survived: ' + Math.floor(result.survived) + 's', W / 2, 334);

    if (result.newHigh) {
      ctx.fillStyle = '#ffcc44';
      ctx.font = 'bold 18px Courier New, monospace';
      ctx.fillText('★ NEW HIGH SCORE ★', W / 2, 380);
    } else {
      ctx.fillStyle = '#aa8866';
      ctx.font = '14px Courier New, monospace';
      ctx.fillText('High score: ' + result.highScore, W / 2, 380);
    }

    // fail_blackout / fail_sober / win_lastcall / fail_crash (distinct)
    const flavor =
      result.reason === 'crash' ? 'Railed too hard. Crash-out on the sticky Tavern floor. Iconic.' :
      result.reason === 'blackout' ? 'Face-planted next to a greasy burger basket. Iconic.' :
      result.reason === 'sober' ? 'Too sober for Wash Park dive energy. She bailed.' :
      'Last Call at Candlelight Tavern. Legend status.';
    ctx.fillStyle = '#ccaa88';
    ctx.font = '12px Courier New, monospace';
    ctx.fillText(flavor, W / 2, 430);

    const retry = layoutRetryBtn(W, H);
    drawButton(ctx, retry, 'RETRY', { fontSize: 22, accent: '#ffee88', bg: '#5a1820' });

    return { retry: retry };
  }


  function drawCrashBanner(ctx, W, H, t, frame) {
    if (t <= 0) return;
    const pulse = 0.55 + Math.sin(frame * 0.45) * 0.2;
    ctx.fillStyle = 'rgba(180,10,40,' + (0.35 + pulse * 0.25) + ')';
    ctx.fillRect(0, H * 0.28, W, 54);
    ctx.strokeStyle = '#ff4466';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, H * 0.28 + 4, W - 16, 46);
    ctx.fillStyle = '#ffeeaa';
    ctx.font = 'bold 22px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 14;
    ctx.fillText('CRASH OUT!!!', W / 2, H * 0.28 + 27);
    ctx.shadowBlur = 0;
  }

  global.UI = {
    hitRect,
    hitPad,
    drawButton,
    drawBuzzMeter,
    drawTimer,
    drawScoreHud,
    drawCrashBanner,
    layoutPlayControls,
    layoutPlayBtn,
    layoutRetryBtn,
    drawTitleScreen,
    drawResults,
  };
})(typeof window !== 'undefined' ? window : globalThis);
