// SPDX-License-Identifier: MIT
// Original 128x32 mobile-suit face set: one helmet (V-fin, crest, cheek
// lines, mouth vents, chin) with sixteen eye and symbol moods. Same ids and
// order as designs.js, so the robot's mood mapping works for either set.
const faces = [
  { id: 'idle' },
  { id: 'happy' },
  { id: 'laugh' },
  { id: 'wink' },
  { id: 'curious' },
  { id: 'thinking' },
  { id: 'surprise' },
  { id: 'smug' },
  { id: 'sleepy' },
  { id: 'sleep' },
  { id: 'sad' },
  { id: 'cry' },
  { id: 'angry' },
  { id: 'panic' },
  { id: 'shy' },
  { id: 'love' },
];

// Eye centers and the helmet's mirror axis (x pairs with 127 - x).
const LEFT_X = 32;
const RIGHT_X = 95;
const EYE_Y = 15;

// Rasterize one face at time t (seconds, 0..2.5) into 4096 one-bit pixels.
// No fonts, gray pixels, antialiasing, display rotation, or device access.
function rasterFace(id, t = 0) {
  const pixels = new Uint8Array(128 * 32);

  function putPixel(x, y, value = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < 128 && y >= 0 && y < 32) pixels[y * 128 + x] = value;
  }

  function fillRect(x, y, width, height, value = 1) {
    for (let row = Math.round(y); row < Math.round(y + height); row++) {
      for (let column = Math.round(x); column < Math.round(x + width); column++) {
        putPixel(column, row, value);
      }
    }
  }

  function drawLine(x0, y0, x1, y1, width = 1, value = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const stepX = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const stepY = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    const half = Math.floor((width - 1) / 2);
    for (let step = 0; step < 300; step++) {
      fillRect(x0 - half, y0 - half, width, width, value);
      if (x0 === x1 && y0 === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x0 += stepX;
      }
      if (doubled <= dx) {
        error += dx;
        y0 += stepY;
      }
    }
  }

  function drawPath(points, width = 1, value = 1) {
    for (let i = 1; i < points.length; i++) drawLine(...points[i - 1], ...points[i], width, value);
  }

  function fillOval(cx, cy, rx, ry, value = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) putPixel(x, y, value);
      }
    }
  }

  // ---- helmet -----------------------------------------------------------

  function vFin(lift = 0) {
    for (let d = 0; d < 2; d++) {
      drawLine(64, 9 - d - lift, 26, 1 - d - lift);
      drawLine(63, 9 - d - lift, 101, 1 - d - lift);
    }
    fillRect(60, 6 - lift, 8, 5);
    fillRect(62, 8 - lift, 4, 1, 0);
  }

  function faceplate(vent = 'closed') {
    drawLine(46, 21, 55, 30);
    drawLine(81, 21, 72, 30);
    if (vent === 'open') {
      // Vents flared open: wider slits, no ribs.
      fillRect(57, 23, 4, 7);
      fillRect(67, 23, 4, 7);
    } else {
      fillRect(58, 24, 3, 6);
      fillRect(67, 24, 3, 6);
      fillRect(58, 27, 3, 1, 0);
      fillRect(67, 27, 3, 1, 0);
    }
    drawLine(55, 31, 72, 31);
  }

  function helmet(vent = 'closed', lift = 0) {
    vFin(lift);
    faceplate(vent);
  }

  // ---- eyes ---------------------------------------------------------------
  // side: -1 = screen-left eye (inner end on its right), +1 = screen-right.

  // The signature stern slit inside a 24x13 box: straight top edge sloping
  // down toward the center, sharp outer point, square-cut inner end.
  // slope scales the tilt (1 = stern); a negative slope mirrors the slit top
  // to bottom for sad eyes. open < 1 squashes it toward its middle (blinks).
  function slit(side, { dx = 0, dy = 0, slope = 1, thick = 1, open = 1 } = {}) {
    const cx = (side < 0 ? LEFT_X : RIGHT_X) + dx;
    const width = 24;
    const height = 13;
    const x0 = Math.round(cx - width / 2);
    const y0 = EYE_Y - 6 + dy;
    const tilt = Math.abs(slope);
    for (let c = 0; c < width; c++) {
      const along = c / (width - 1);
      const inner = side < 0 ? along : 1 - along;
      let top = height * (0.12 + 0.36 * tilt * inner);
      let bottom = top + height * (0.16 + 0.36 * inner) * thick;
      if (slope < 0) [top, bottom] = [height - bottom, height - top];
      const mid = (top + bottom) / 2;
      const half = ((bottom - top) / 2) * open;
      const yTop = Math.round(y0 + mid - half);
      const yBottom = Math.round(y0 + mid + half);
      fillRect(x0 + c, yTop, 1, Math.max(1, yBottom - yTop + 1));
    }
  }

  // Closed "^" chevron (happy / laughing / shy).
  function chevron(side, { dy = 0, sharp = false } = {}) {
    const cx = side < 0 ? LEFT_X : RIGHT_X;
    const y = EYE_Y + 3 + dy;
    const rise = sharp ? 8 : 6;
    drawPath([[cx - 10, y], [cx, y - rise], [cx + 10, y]], 2);
  }

  // Squeezed ">" / "<" pointing at the center (laugh / panic).
  function squint(side, dy = 0) {
    const cx = side < 0 ? LEFT_X : RIGHT_X;
    const tip = side < 0 ? cx + 6 : cx - 6;
    const back = side < 0 ? cx - 6 : cx + 6;
    drawPath([[back, EYE_Y - 6 + dy], [tip, EYE_Y + dy], [back, EYE_Y + 6 + dy]], 2);
  }

  // Wide hollow eye (surprise / curious).
  function ring(side, scale = 1, dy = 0) {
    const cx = side < 0 ? LEFT_X : RIGHT_X;
    fillOval(cx, EYE_Y + dy, 9 * scale, 6 * scale);
    fillOval(cx, EYE_Y + dy, 6 * scale, 3.5 * scale, 0);
  }

  // Eye power-down dash (sleep).
  function dash(side, dy = 0) {
    const cx = side < 0 ? LEFT_X : RIGHT_X;
    fillRect(cx - 8, EYE_Y + 3 + dy, 16, 1);
  }

  // Signature eye flash: a 4-point glint at the inner corner.
  function glint(side, size = 3) {
    const x = side < 0 ? LEFT_X + 11 : RIGHT_X - 11;
    const y = EYE_Y - 3;
    drawLine(x - size, y, x + size, y);
    drawLine(x, y - size, x, y + size);
  }

  function heart(cx, cy, scale = 1) {
    const outline = [[0, 2], [2, 0], [5, 0], [7, 2], [9, 0], [12, 0], [14, 2], [14, 6], [7, 13], [0, 6]];
    for (let row = 0; row < 14; row++) {
      for (let column = 0; column < 15; column++) {
        let inside = false;
        for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
          const [ax, ay] = outline[i];
          const [bx, by] = outline[j];
          if ((ay > row) !== (by > row) && column < (bx - ax) * (row - ay) / (by - ay) + ax) inside = !inside;
        }
        if (inside) fillRect(cx + (column - 7) * scale, cy + (row - 6) * scale, scale, scale);
      }
    }
  }

  // ---- side symbols ---------------------------------------------------------

  function drop(x, y) {
    drawPath([[x, y - 3], [x - 2, y], [x - 2, y + 3], [x, y + 4], [x + 2, y + 3], [x + 2, y], [x, y - 3]]);
    fillRect(x - 1, y, 3, 3);
  }

  function star(x, y, r = 3) {
    drawLine(x - r, y, x + r, y);
    drawLine(x, y - r, x, y + r);
    putPixel(x - 1, y - 1);
    putPixel(x + 1, y + 1);
    putPixel(x - 1, y + 1);
    putPixel(x + 1, y - 1);
  }

  function question(x, y) {
    drawPath([[x, y + 2], [x + 2, y], [x + 5, y], [x + 7, y + 2], [x + 7, y + 4], [x + 3, y + 7], [x + 3, y + 9]]);
    fillRect(x + 3, y + 12, 2, 2);
  }

  function bang(x, y) {
    fillRect(x, y, 2, 8);
    fillRect(x, y + 10, 2, 2);
  }

  function zee(x, y, s) {
    drawPath([[x, y], [x + s, y], [x, y + s], [x + s, y + s]]);
  }

  // Anime anger mark: four corner brackets.
  function vein(x, y) {
    drawPath([[x, y], [x, y + 3], [x - 3, y + 3]]);
    drawPath([[x + 4, y], [x + 4, y + 3], [x + 7, y + 3]]);
    drawPath([[x, y + 10], [x, y + 7], [x - 3, y + 7]]);
    drawPath([[x + 4, y + 10], [x + 4, y + 7], [x + 7, y + 7]]);
  }

  // ---- timing -----------------------------------------------------------------

  const blinkPhase = t % 2.4;
  let blink = 1;
  if (t > 0 && blinkPhase > 1.3 && blinkPhase < 1.62) {
    blink = Math.max(0.1, Math.abs(blinkPhase - 1.46) / 0.16);
  }
  const glance = t ? Math.round(Math.sin(t * 2.1) * 2) : 0;
  const bob = t ? Math.round(Math.sin(t * 3)) : 0;

  switch (id) {
    case 'idle':
      helmet();
      slit(-1, { dx: glance, open: blink });
      slit(1, { dx: glance, open: blink });
      break;

    case 'happy': {
      const bounce = Math.round(Math.sin(Math.PI * Math.min(1, t / 0.8)) * -2);
      helmet('closed', bounce < 0 ? 1 : 0);
      chevron(-1, { dy: bounce });
      chevron(1, { dy: bounce });
      if (!t || t % 1 < 0.5) star(12, 9, 2);
      break;
    }

    case 'laugh': {
      const shake = t ? (Math.floor(t * 8) % 2) : 0;
      helmet(t && Math.sin(t * 9) < 0 ? 'closed' : 'open', shake);
      squint(-1, -shake);
      squint(1, -shake);
      break;
    }

    case 'wink':
      helmet();
      slit(-1);
      if (!t || t % 2 < 1.25) chevron(1);
      else slit(1);
      if (!t || t % 2 < 1.5) {
        star(114, 6, 3);
        glint(-1, 2);
      }
      break;

    case 'curious': {
      helmet();
      // One slit raised and narrowed like a lifted brow, gently bobbing.
      const tilt = t ? Math.round(Math.sin(t * 3)) : 0;
      slit(-1, { dy: 1 });
      slit(1, { thick: 0.75, dy: -3 + tilt });
      question(112, 3);
      break;
    }

    case 'thinking': {
      helmet();
      // Narrowed eyes glancing up and aside.
      const look = t ? Math.round(Math.sin(t * 1.6) * 3) : 3;
      slit(-1, { dx: look, dy: -2, thick: 0.6 });
      slit(1, { dx: look, dy: -2, thick: 0.6 });
      const dots = t ? 1 + Math.floor(t * 2) % 3 : 3;
      for (let i = 0; i < dots; i++) fillRect(110 + i * 5, 26, 2, 2);
      break;
    }

    case 'surprise': {
      const grow = t ? Math.max(0, 1 - t / 0.8) * 0.25 : 0;
      helmet('open', grow > 0.1 ? 1 : 0);
      ring(-1, 1 + grow);
      ring(1, 1 + grow);
      bang(10, 6);
      bang(116, 6);
      break;
    }

    case 'smug': {
      helmet();
      // Half-lidded: stern slits with the top shaved off, one lid lifting.
      const lift = t ? Math.round((Math.sin(t * 3) + 1)) : 0;
      slit(-1, { thick: 1.2 });
      fillRect(LEFT_X - 13, EYE_Y - 7, 26, 6, 0);
      slit(1, { thick: 1.2 });
      fillRect(RIGHT_X - 13, EYE_Y - 7 - lift, 26, 6, 0);
      glint(1, 2);
      break;
    }

    case 'sleepy': {
      helmet();
      const droop = t ? Math.max(0.15, 0.7 - t * 0.2) : 0.45;
      slit(-1, { open: droop });
      slit(1, { open: droop });
      zee(112, 20, 4);
      break;
    }

    case 'sleep': {
      // Powered down: eyes dark, fin dipped, Zs rising.
      helmet('closed', -bob);
      dash(-1, bob);
      dash(1, bob);
      const rise = t ? -Math.floor(t * 1.5) % 3 : 0;
      zee(108, 14 + rise, 5);
      zee(117, 5 + rise, 6);
      break;
    }

    case 'sad':
      helmet();
      slit(-1, { slope: -1, thick: 0.9, dy: 2 });
      slit(1, { slope: -1, thick: 0.9, dy: 2 });
      drop(LEFT_X - 9, 24 + (t ? Math.round(Math.sin(t * 3)) : 0));
      break;

    case 'cry':
      helmet();
      slit(-1, { slope: -1, thick: 0.7, dy: 1 });
      slit(1, { slope: -1, thick: 0.7, dy: 1 });
      for (const x of [LEFT_X - 2, RIGHT_X + 2]) {
        const flow = t ? Math.floor(t * 7) % 6 : 0;
        for (let y = 22 + flow; y < 32; y += 6) fillRect(x, y, 2, 3);
      }
      break;

    case 'angry': {
      const flash = !t || t % 1.1 < 0.7;
      helmet();
      slit(-1, { slope: 1.5, thick: 1.1, dy: 1 });
      slit(1, { slope: 1.5, thick: 1.1, dy: 1 });
      if (flash) {
        glint(-1, 3);
        glint(1, 3);
        vein(113, 4);
      }
      break;
    }

    case 'panic': {
      const jitter = t ? (Math.floor(t * 10) % 2 ? 1 : -1) : 0;
      helmet('open');
      squint(-1, jitter);
      squint(1, -jitter);
      drop(116, 8 + (t ? Math.floor(t * 5) % 8 : 0));
      drop(11, 12 + (t ? Math.floor(t * 5 + 4) % 8 : 0));
      break;
    }

    case 'shy':
      helmet();
      chevron(-1, { dy: -1 });
      chevron(1, { dy: -1 });
      if (!t || t % 1.5 < 1.1) {
        for (const x of [20, 25, 102, 107]) drawLine(x, 22, x - 2, 26);
      }
      break;

    case 'love': {
      helmet();
      const beat = t ? Math.round(Math.sin(t * 7)) : 0;
      heart(LEFT_X, EYE_Y + beat);
      heart(RIGHT_X, EYE_Y + beat);
      if (!t || t % 1 < 0.5) {
        star(12, 10, 2);
        star(115, 24, 2);
      }
      break;
    }
  }

  return pixels;
}

export { faces, rasterFace };
