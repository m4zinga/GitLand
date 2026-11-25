/**
 * Builds the GitLand theme gallery.
 *
 *   node themes/source/build.js            # every theme
 *   node themes/source/build.js aurora     # only some
 *
 * For each theme writes themes/<id>/style.json and themes/<id>/wallpaper.webp (2560×1440),
 * rendering the SVG scene with headless Chrome/Edge.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { scenes } = require('./scenes');
const { THEMES } = require('./themes');

const ROOT = path.resolve(__dirname, '..');

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Turns a compact palette into a GitLand style.json. */
function styleFor(p) {
  const raised = p.base.map((c) => Math.min(255, c + 10));
  return {
    color: {
      '--bgColor-overlay': rgba(p.overlay.slice(0, 3), p.overlay[3]),
      '--bgColor-header': rgba(p.base, 0.72),
      '--header-bgColor': rgba(p.base, 0.72),
      '--bgColor-default': rgba(p.base, 0.66),
      '--bgColor-muted': rgba(p.base, 0.55),
      '--bgColor-inset': rgba(p.base, 0.42),
      '--overlay-bgColor': rgba(raised, 0.97),
      '--control-bgColor-rest': rgba(p.base, 0.5),
      '--control-bgColor-hover': rgba(p.border, 0.12),
      '--control-transparent-bgColor-hover': rgba(p.border, 0.12),
      '--button-default-bgColor-rest': rgba(p.base, 0.55),
      '--button-default-bgColor-hover': rgba(p.border, 0.14),
      '--borderColor-default': rgba(p.border, 0.3),
      '--borderColor-muted': rgba(p.border, 0.2),
      '--control-borderColor-rest': rgba(p.border, 0.4),
      '--button-default-borderColor-rest': rgba(p.border, 0.35),
      '--underlineNav-borderColor-active': p.accent,
      '--fgColor-default': p.fg,
      '--fgColor-muted': p.fgMuted,
      '--fgColor-accent': p.accent,
      '--fgColor-link': p.accent,
      '--fgColor-disabled': p.fgMuted,
      '--control-fgColor-rest': p.fg,
      '--control-fgColor-placeholder': p.fgMuted,
      '--button-default-fgColor-rest': p.fg,
      '--button-invisible-fgColor-rest': p.fgMuted,
      '--contribution-default-borderColor-0': rgba(p.border, 0.08),
      ...Object.fromEntries(p.graph.map((c, i) => [`--contribution-default-bgColor-${i}`, c]))
    }
  };
}

const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => fs.existsSync(p));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gitland-themes-'));

/** Rasterizes an SVG to WebP through a canvas in headless Chrome (--dump-dom returns the data URL). */
function toWebp(svgText, width, height, quality) {
  const page = path.join(tmp, 'render.html');
  const src = 'data:image/svg+xml;base64,' + Buffer.from(svgText).toString('base64');
  fs.writeFileSync(page, `<!DOCTYPE html><body><pre id="out"></pre><script>
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = ${width}; c.height = ${height};
      c.getContext('2d').drawImage(img, 0, 0, ${width}, ${height});
      document.getElementById('out').textContent = c.toDataURL('image/webp', ${quality});
    };
    img.src = ${JSON.stringify(src)};
  </script></body>`);
  const dom = execFileSync(browser, [
    '--headless=new', '--disable-gpu', `--user-data-dir=${path.join(tmp, 'profile')}`,
    '--virtual-time-budget=15000', '--dump-dom', 'file:///' + page.replace(/\\/g, '/')
  ], { maxBuffer: 64 * 1024 * 1024 }).toString();
  const m = dom.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error('render failed');
  return Buffer.from(m[1], 'base64');
}

const only = process.argv.slice(2);
for (const theme of THEMES) {
  if (only.length && !only.includes(theme.id)) continue;
  const dir = path.join(ROOT, theme.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'style.json'), JSON.stringify(styleFor(theme.palette), null, 2) + '\n');
  const svg = scenes[theme.id]();
  const webp = toWebp(svg, 2560, 1440, 0.9);
  fs.writeFileSync(path.join(dir, 'wallpaper.webp'), webp);
  console.log(`${theme.id}: wallpaper ${(webp.length / 1024).toFixed(0)} KB`);
}
