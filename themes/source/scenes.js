/**
 * Procedural wallpapers for the GitLand theme gallery.
 * Every scene is drawn in a 1600×900 space (16:9) and rendered at 2560×1440.
 */
const W = 1600, H = 900;

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;
const grad = (id, stops, vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const radial = (id, stops) =>
  `<radialGradient id="${id}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
const blur = (id, d) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;

/** A jagged mountain ridge from x=-40 to W+40 around height y. */
function ridge(r, { y, amp, step = 60, peaks = [], bottom = H + 10 }) {
  const pts = [];
  for (let x = -40; x <= W + 40; x += step * (0.6 + r() * 0.8)) {
    let py = y + (r() - 0.5) * amp;
    for (const [px, ph, pw] of peaks) py -= ph * Math.max(0, 1 - Math.abs(x - px) / pw);
    pts.push([x, py]);
  }
  pts.push([W + 40, y]);
  return `M-40 ${bottom} ` + pts.map(([x, py]) => `L${f(x)} ${f(py)}`).join(' ') + ` L${W + 40} ${bottom}Z`;
}

function stars(r, n, ymax, color = '#ffffff', minR = 0.6, maxR = 1.8) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${f(r() * W)}" cy="${f(r() * ymax)}" r="${f(minR + r() * (maxR - minR))}" fill="${color}" opacity="${f(0.3 + r() * 0.7)}"/>`;
  }
  return s;
}

function sparkles(r, n, ymax, color = '#eef3fa', avoid = null) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 40 + r() * (W - 80), y = 30 + r() * ymax, k = 5 + r() * 7;
    if (avoid && Math.hypot(x - avoid[0], y - avoid[1]) < avoid[2]) continue;
    s += `<path d="M${f(x - k)} ${f(y)}h${f(2 * k)}M${f(x)} ${f(y - k)}v${f(2 * k)}" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity="${f(0.5 + r() * 0.45)}"/>`;
  }
  return s;
}

/** The GitLand "water lines": rows of rounded dashes below the horizon. */
function waterLines(r, { top, rows, gap = 19, color, width = 5, fade = 0.022, base = 0.4, glowX = null }) {
  let s = '';
  for (let row = 0; row < rows; row++) {
    const y = top + row * gap;
    let x = -30 + r() * 50;
    while (x < W + 30) {
      const len = 90 + r() * 420;
      let op = Math.max(0.06, base - row * fade);
      if (glowX !== null && row < 8 && Math.abs(x + len / 2 - glowX) < 200) op = Math.min(0.9, op + 0.4);
      s += `<path d="M${f(x)} ${y}h${f(len)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${f(op)}"/>`;
      x += len + 18 + r() * 36;
    }
  }
  return s;
}

const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="2560" height="1440"><defs>${defs}</defs>${body}</svg>`;

/* ======================================================================== scenes */

const scenes = {};

/** GitLand Night: the logo's landscape. */
scenes.night = () => {
  const r = rng(7);
  const HZ = 600, moon = [1440, 250, 95];
  return svg(
    grad('sky', [[0, '#060f26'], [0.55, '#13234a'], [1, '#26395f']]) +
    grad('water', [[0, '#15264a'], [1, '#060f26']]) +
    radial('glow', [[0, '#eef3fa', 0.35], [1, '#eef3fa', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars(r, 160, 470, '#eef3fa')}
    ${sparkles(r, 14, 360, '#eef3fa', [moon[0], moon[1], moon[2] + 60])}
    <circle cx="1330" cy="130" r="11" fill="none" stroke="#eef3fa" stroke-width="4" opacity=".8"/>
    <g opacity=".5"><circle cx="250" cy="210" r="13" fill="none" stroke="#a6b2c6" stroke-width="4"/><path d="M222 210h56" stroke="#a6b2c6" stroke-width="4" stroke-linecap="round"/></g>
    <circle cx="${moon[0]}" cy="${moon[1]}" r="${moon[2] * 2.3}" fill="url(#glow)"/>
    <circle cx="${moon[0]}" cy="${moon[1]}" r="${moon[2]}" fill="#eef3fa"/>
    <path d="${ridge(r, { y: 470, amp: 60, step: 70, peaks: [[380, 80, 200], [900, 90, 220], [1250, 60, 180]], bottom: HZ })}" fill="#2a3a61"/>
    <path d="${ridge(r, { y: 530, amp: 50, step: 60, peaks: [[300, 70, 220], [1000, 80, 260], [1450, 60, 200]], bottom: HZ + 6 })}" fill="#55678a" stroke="#0e1a33" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-40 ${HZ} Q200 525 380 565 T760 570 Q960 520 1150 575 T1640 560 V${HZ + 12} H-40Z" fill="#a6b2c6" stroke="#0e1a33" stroke-width="6" stroke-linejoin="round"/>
    <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#water)"/>
    ${waterLines(r, { top: HZ + 18, rows: 15, color: '#dde5f0', glowX: moon[0] })}`
  );
};

/** Aurora: northern lights over a frozen pine forest. */
scenes.aurora = () => {
  const r = rng(21);
  const band = (d, op) => `<path d="${d}" fill="url(#aur)" opacity="${op}" filter="url(#b1)"/>`;
  let trees = '';
  for (let x = -20; x < W + 40; x += 14 + r() * 26) {
    const h = 70 + r() * 150, w = h * (0.28 + r() * 0.08), base = 830 + r() * 40;
    let t = '';
    for (let k = 0; k < 4; k++) {
      const y = base - h + (k * h) / 4.2, ww = (w * (k + 1.4)) / 5;
      t += `M${f(x)} ${f(y)} L${f(x - ww)} ${f(y + h / 3)} L${f(x + ww)} ${f(y + h / 3)}Z `;
    }
    trees += t + `M${f(x - 3)} ${f(base - 8)}h6v30h-6Z `;
  }
  return svg(
    grad('sky', [[0, '#01070f'], [0.5, '#052033'], [1, '#0d3a4a']]) +
    grad('aur', [[0, '#7c8cf0', 0], [0.35, '#7c8cf0', 0.35], [0.6, '#5eead4', 0.85], [1, '#5eead4', 0]]) +
    grad('lake', [[0, '#0b3443'], [1, '#020b12']]) +
    blur('b1', 26) + blur('b2', 6),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars(r, 220, 620, '#e8fbf8')}
    ${band('M-80 330 C250 140 520 380 820 220 S1350 70 1700 210 L1700 300 C1350 180 1120 400 820 330 S260 260 -80 430Z', 0.95)}
    ${band('M100 170 C400 60 650 230 980 120 S1450 40 1700 110 L1700 160 C1450 100 1250 280 980 200 S420 140 100 250Z', 0.7)}
    ${band('M-80 470 C300 330 700 520 1050 380 S1500 330 1700 400 L1700 450 C1500 400 1300 520 1050 470 S320 430 -80 540Z', 0.45)}
    <circle cx="1370" cy="120" r="34" fill="#e8fbf8"/>
    <circle cx="1370" cy="120" r="70" fill="#e8fbf8" opacity=".12" filter="url(#b2)"/>
    <path d="${ridge(r, { y: 620, amp: 40, step: 60, bottom: 700 })}" fill="#10303e"/>
    <path d="M80 700 L420 420 L520 500 L560 470 L820 700Z M760 700 L1180 380 L1300 470 L1340 450 L1620 700Z" fill="#1b4152"/>
    <path d="M420 420 L520 500 L470 488 L432 515 L398 482 L352 500Z M1180 380 L1300 470 L1250 462 L1205 492 L1165 458 L1108 478Z" fill="#dff7f4" opacity=".7"/>
    <path d="M420 420 L560 470 L820 700 L620 700Z M1180 380 L1340 450 L1620 700 L1400 700Z" fill="#000" opacity=".18"/>
    <rect y="690" width="${W}" height="${H - 690}" fill="url(#lake)"/>
    ${waterLines(r, { top: 706, rows: 7, gap: 17, color: '#9ff3e6', width: 4, base: 0.3, fade: 0.03 })}
    <path d="${trees}" fill="#010a10"/>
    <rect y="860" width="${W}" height="40" fill="#010a10"/>`
  );
};

/** Synthwave: striped retro sun over a neon grid. */
scenes.synthwave = () => {
  const r = rng(84);
  const HZ = 560, cx = 800;
  let stripes = '';
  for (let i = 0; i < 9; i++) {
    const y = 470 + i * i * 1.6 + i * 11, hgt = 2 + i * 1.6;
    stripes += `<rect x="0" y="${f(y)}" width="${W}" height="${f(hgt)}" fill="#000"/>`;
  }
  let grid = '';
  for (let i = 1; i < 22; i++) {
    const y = HZ + Math.pow(i / 21, 2.1) * (H - HZ + 40);
    grid += `<path d="M0 ${f(y)}H${W}" stroke="#ff4fd8" stroke-width="${f(0.8 + i * 0.12)}" opacity="${f(0.25 + i * 0.03)}"/>`;
  }
  for (let i = -24; i <= 24; i++) {
    grid += `<path d="M${cx + i * 6} ${HZ}L${cx + i * 190} ${H + 40}" stroke="#ff4fd8" stroke-width="1.6" opacity=".55"/>`;
  }
  return svg(
    grad('sky', [[0, '#0b0221'], [0.45, '#2b0a52'], [0.72, '#8a1f7a'], [0.9, '#ff4f8b'], [1, '#ffb35c']]) +
    grad('sun', [[0, '#ffe680'], [0.55, '#ff9a5c'], [1, '#ff3c8e']]) +
    grad('floor', [[0, '#25063f'], [1, '#07000f']]) +
    radial('halo', [[0, '#ff5fa8', 0.5], [1, '#ff5fa8', 0]]) +
    `<mask id="cut"><rect width="${W}" height="${H}" fill="#fff"/>${stripes}</mask>` + blur('g', 4),
    `<rect width="${W}" height="${HZ}" fill="url(#sky)"/>
    ${stars(r, 150, 330, '#ffe9fb')}
    <circle cx="${cx}" cy="400" r="380" fill="url(#halo)"/>
    <circle cx="${cx}" cy="400" r="210" fill="url(#sun)" mask="url(#cut)"/>
    <path d="${ridge(r, { y: 545, amp: 26, step: 40, peaks: [[160, 150, 230], [420, 90, 160], [1180, 120, 200], [1450, 170, 240]], bottom: HZ })}" fill="#160430" stroke="#ff4fd8" stroke-width="2" stroke-linejoin="round"/>
    <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#floor)"/>
    <g filter="url(#g)" opacity=".7">${grid}</g>${grid}
    <path d="M0 ${HZ}H${W}" stroke="#ffd1f5" stroke-width="2.5"/>
    <path d="M0 ${HZ}H${W}" stroke="#ff4fd8" stroke-width="10" opacity=".45" filter="url(#g)"/>`
  );
};

/** Sakura: cherry blossoms at dusk over a quiet lake. */
scenes.sakura = () => {
  const r = rng(5);
  const HZ = 640;
  let wood = '', flowers = '';
  const petalColors = ['#ffc4d8', '#ff9dbd', '#ffe1ec', '#ffb0c9'];
  function branch(x, y, ang, len, w, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    const mx = (x + x2) / 2 + (r() - 0.5) * len * 0.3, my = (y + y2) / 2 + (r() - 0.5) * len * 0.3;
    wood += `<path d="M${f(x)} ${f(y)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}" stroke="#1d0d1c" stroke-width="${f(w)}" stroke-linecap="round" fill="none"/>`;
    if (depth >= 2) {
      const n = 6 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) {
        const t = r(), bx = x + (x2 - x) * t + (r() - 0.5) * 50, by = y + (y2 - y) * t + (r() - 0.5) * 50;
        flowers += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(5 + r() * 11)}" fill="${petalColors[Math.floor(r() * 4)]}" opacity="${f(0.75 + r() * 0.25)}"/>`;
      }
    }
    if (depth < 5) {
      const kids = depth < 2 ? 2 : 1 + Math.floor(r() * 2);
      for (let k = 0; k < kids; k++) {
        branch(x2, y2, ang + (r() - 0.5) * 1.1, len * (0.62 + r() * 0.15), Math.max(1.5, w * 0.62), depth + 1);
      }
    }
  }
  branch(-30, -20, 0.55, 260, 26, 0);
  branch(-40, 180, 0.15, 220, 20, 1);
  branch(W + 30, -10, Math.PI - 0.6, 230, 22, 0);
  let petals = '';
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, a = r() * 180;
    petals += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(3 + r() * 4)}" ry="${f(2 + r() * 2)}" transform="rotate(${f(a)} ${f(x)} ${f(y)})" fill="${petalColors[i % 4]}" opacity="${f(0.45 + r() * 0.5)}"/>`;
  }
  return svg(
    grad('sky', [[0, '#170d2c'], [0.45, '#43204f'], [0.78, '#b5577a'], [1, '#f2a58e']]) +
    grad('lake', [[0, '#7a3a63'], [0.4, '#3a1c3d'], [1, '#140a1c']]) +
    radial('glow', [[0, '#ffe3dc', 0.45], [1, '#ffe3dc', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars(r, 70, 300, '#ffe9f2')}
    <circle cx="1360" cy="400" r="240" fill="url(#glow)"/>
    <circle cx="1360" cy="400" r="95" fill="#ffe7df"/>
    <path d="M520 ${HZ} L760 330 L800 315 L840 332 L1120 ${HZ}Z" fill="#6b3a63"/>
    <path d="M700 400 L760 330 L800 315 L840 332 L905 405 L860 390 L825 412 L790 385 L755 410 L735 392Z" fill="#f6d5df"/>
    <path d="${ridge(r, { y: 585, amp: 30, step: 70, peaks: [[200, 60, 260], [1400, 70, 300]], bottom: HZ + 4 })}" fill="#3b1f45"/>
    <path d="${ridge(r, { y: 625, amp: 18, step: 80, bottom: HZ + 6 })}" fill="#24122d"/>
    <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#lake)"/>
    ${waterLines(r, { top: HZ + 16, rows: 13, gap: 19, color: '#ffd0dc', width: 4, base: 0.32, glowX: 1360 })}
    ${wood}${flowers}${petals}`
  );
};

/** Abyss: bioluminescent deep sea. */
scenes.abyss = () => {
  const r = rng(33);
  let rays = '';
  for (let i = 0; i < 7; i++) {
    const x = 150 + i * 210 + (r() - 0.5) * 80, w = 40 + r() * 70;
    rays += `<path d="M${f(x)} -20 L${f(x + w)} -20 L${f(x + w * 3 + 140)} 760 L${f(x - 120)} 760Z" fill="url(#ray)" opacity="${f(0.35 + r() * 0.4)}"/>`;
  }
  let dots = '';
  for (let i = 0; i < 230; i++) {
    const c = r() < 0.75 ? '#7cf2ff' : '#b69cff';
    dots += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(0.8 + r() * 2.4)}" fill="${c}" opacity="${f(0.25 + r() * 0.7)}"/>`;
  }
  let jelly = '';
  const jellies = [[300, 330, 70, '#7cf2ff'], [1270, 250, 95, '#b69cff'], [1060, 560, 45, '#7cf2ff'], [560, 640, 34, '#b69cff']];
  for (const [x, y, s, c] of jellies) {
    let tent = '';
    for (let k = -2; k <= 2; k++) {
      const tx = x + k * s * 0.32;
      tent += `<path d="M${f(tx)} ${f(y)} q${f(s * 0.25)} ${f(s * 0.7)} 0 ${f(s * 1.4)} t0 ${f(s * 1.4)} t0 ${f(s * 1.2)}" stroke="${c}" stroke-width="${f(1.5 + s / 40)}" fill="none" opacity=".55"/>`;
    }
    const dome = `M${f(x - s)} ${f(y)} Q${f(x - s)} ${f(y - s * 1.05)} ${f(x)} ${f(y - s * 1.05)} Q${f(x + s)} ${f(y - s * 1.05)} ${f(x + s)} ${f(y)} Q${f(x)} ${f(y - s * 0.25)} ${f(x - s)} ${f(y)}Z`;
    jelly += `<g><path d="${dome}" fill="${c}" opacity=".5" filter="url(#glow)"/>${tent}<path d="${dome}" fill="${c}" opacity=".28" stroke="${c}" stroke-width="2"/></g>`;
  }
  let kelp = '';
  for (let i = 0; i < 26; i++) {
    const x = r() * W, h = 120 + r() * 260;
    kelp += `<path d="M${f(x)} ${H + 10} q${f(30 * (r() - 0.5) * 2)} -${f(h / 3)} 0 -${f(h / 1.5)} t0 -${f(h / 3)}" stroke="#021a26" stroke-width="${f(6 + r() * 8)}" fill="none" stroke-linecap="round"/>`;
  }
  return svg(
    grad('sea', [[0, '#0b5570'], [0.35, '#05304a'], [1, '#010810']]) +
    grad('ray', [[0, '#d6fbff', 0.55], [1, '#d6fbff', 0]]) +
    blur('soft', 14) + blur('glow', 18),
    `<rect width="${W}" height="${H}" fill="url(#sea)"/>
    <g filter="url(#soft)">${rays}</g>
    ${dots}${jelly}
    ${kelp}
    <path d="${ridge(r, { y: 850, amp: 40, step: 50, peaks: [[250, 60, 180], [1350, 80, 220]] })}" fill="#010a12"/>`
  );
};

/** Ember: a volcano glowing in the night. */
scenes.ember = () => {
  const r = rng(61);
  let embers = '';
  for (let i = 0; i < 220; i++) {
    const x = 800 + (r() - 0.5) * (300 + r() * 1400), y = r() * 640;
    const c = ['#ffd166', '#ff9b3d', '#ff5a1f'][Math.floor(r() * 3)];
    embers += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.8 + r() * 2.6)}" fill="${c}" opacity="${f(0.35 + r() * 0.65)}"/>`;
  }
  /** A lava flow: a wandering line from the crater down the slope, sometimes splitting. */
  function flow(x, y, dir, len, width) {
    let d = `M${f(x)} ${f(y)}`, out = '';
    for (let i = 0; i < len; i++) {
      const nx = x + dir * (8 + r() * 22) + (r() - 0.5) * 26, ny = y + 18 + r() * 16;
      d += ` Q${f((x + nx) / 2 + (r() - 0.5) * 18)} ${f((y + ny) / 2)} ${f(nx)} ${f(ny)}`;
      x = nx; y = ny;
      if (i > 4 && r() < 0.12 && width > 2) out += flow(x, y, dir * (0.4 + r()), Math.floor((len - i) * 0.6), width * 0.6);
    }
    return out +
      `<path d="${d}" stroke="#ff3d00" stroke-width="${f(width * 4)}" fill="none" opacity=".5" filter="url(#g)" stroke-linecap="round"/>` +
      `<path d="${d}" stroke="#ff6a1a" stroke-width="${f(width)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" stroke="#ffd166" stroke-width="${f(Math.max(1, width / 3))}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const flows = flow(770, 342, -1.1, 22, 6) + flow(835, 342, 1.2, 21, 6) + flow(800, 345, -0.15, 24, 4.5);
  return svg(
    grad('sky', [[0, '#050203'], [0.5, '#1a0705'], [1, '#3d1007']]) +
    radial('crater', [[0, '#ffb347', 0.95], [0.4, '#ff5a1f', 0.6], [1, '#ff3d00', 0]]) +
    `<radialGradient id="slope" cx="0.5" cy="0" r="0.9"><stop offset="0" stop-color="#4a1709"/><stop offset=".45" stop-color="#1d0705"/><stop offset="1" stop-color="#090202"/></radialGradient>` +
    grad('ground', [[0, '#1a0604'], [1, '#050102']]) +
    blur('g', 10) + blur('smoke', 40),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars(r, 60, 260, '#ffe3cf', 0.5, 1.3)}
    <g filter="url(#smoke)" opacity=".6"><ellipse cx="760" cy="210" rx="260" ry="90" fill="#3a120b"/><ellipse cx="930" cy="120" rx="320" ry="80" fill="#2b0d09"/><ellipse cx="600" cy="100" rx="220" ry="60" fill="#331009"/></g>
    <ellipse cx="805" cy="335" rx="250" ry="130" fill="url(#crater)"/>
    <path d="${ridge(r, { y: 640, amp: 40, step: 70, peaks: [[150, 120, 260], [1450, 140, 280]], bottom: H })}" fill="#1f0806"/>
    <path d="M140 ${H} L420 690 L560 560 L700 380 L735 345 Q805 322 875 345 L920 395 L1050 560 L1180 680 L1480 ${H}Z" fill="url(#slope)"/>
    <ellipse cx="805" cy="342" rx="72" ry="9" fill="#ffb347"/>
    ${flows}
    ${embers}
    <rect y="790" width="${W}" height="${H - 790}" fill="url(#ground)" opacity=".85"/>`
  );
};

module.exports = { scenes };
