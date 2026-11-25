/**
 * Renders previews of the themes on real GitHub pages (public HTML + GitHub's own CSS),
 * applying a theme exactly like the extension does.
 *
 *   node themes/source/preview.js [--light] [--out <dir>] [theme ...]
 *
 * Writes themes/<theme>/profile.png (or <out>/<theme>-profile.png). The pseudo-theme "plain"
 * renders the page without GitLand, for before/after comparisons.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { THEMES } = require('./themes');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.resolve(ROOT, '..');
const USER = 'm4zinga';
// Repository pages are left out: without JavaScript their commit list stays a grey placeholder.
const PAGES = { profile: `https://github.com/${USER}` };

const args = process.argv.slice(2);
const light = args.includes('--light');
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1 ? path.resolve(args[outIdx + 1]) : null;
const only = args.filter((a, i) => !a.startsWith('--') && (outIdx === -1 || i !== outIdx + 1));

const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => fs.existsSync(p));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gitland-preview-'));
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');

async function loadPages() {
  const get = async (u) => (await fetch(u)).text();
  const pages = {};
  for (const [name, url] of Object.entries(PAGES)) {
    let html = await get(url);
    if (name === 'profile') {
      // the contribution graph is normally loaded by JavaScript: inline it
      const graph = await get(`https://github.com/users/${USER}/contributions`);
      html = html.replace(/<include-fragment[^>]*tab=contributions[^>]*>[\s\S]*?<\/include-fragment>/, graph);
    }
    pages[name] = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  }
  return pages;
}

function themed(html, theme, mode) {
  if (theme.id === 'plain') {
    return html
      .replace(/<html([^>]*)>/, (m, a) => `<html${a.replace(/\sdata-color-mode="[^"]*"/, '')} data-color-mode="${mode}">`)
      .replace('<head>', '<head><base href="https://github.com/">');
  }
  const style = JSON.parse(fs.readFileSync(path.join(ROOT, theme.id, 'style.json'), 'utf8')).color;
  const decls = Object.entries(style).map(([k, v]) => `${k}: ${v} !important;`).join(' ');
  const wallpaper = fileUrl(path.join(ROOT, theme.id, 'wallpaper.webp'));
  const inject = `<base href="https://github.com/">
    <link rel="stylesheet" href="${fileUrl(path.join(PROJECT, 'content', 'contentStyles.css'))}">
    <style>html.gitland-active { ${decls} --gitland-bg-image: url("${wallpaper}"); }</style>`;
  return html
    .replace(/<html([^>]*)>/, (m, attrs) => {
      const a = attrs.replace(/\s(class|data-color-mode|data-light-theme|data-dark-theme)="[^"]*"/g, '');
      return `<html${a} class="gitland-active gitland-has-image gitland-has-header" data-color-mode="${mode}" data-light-theme="light" data-dark-theme="dark">`;
    })
    .replace(/<head>/, `<head>${inject}`);
}

(async () => {
  const pages = await loadPages();
  for (const theme of [...THEMES, { id: 'plain' }]) {
    if (theme.id === 'plain' && !only.includes('plain')) continue;
    if (only.length && !only.includes(theme.id)) continue;
    const dir = outDir || path.join(ROOT, theme.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, html] of Object.entries(pages)) {
      const page = path.join(tmp, `${theme.id}-${name}.html`);
      fs.writeFileSync(page, themed(html, theme, light ? 'light' : 'dark'));
      const out = path.join(dir, `${outDir ? theme.id + '-' : ''}${name}${light ? '-light' : ''}.png`);
      execFileSync(browser, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        '--allow-file-access-from-files', `--user-data-dir=${path.join(tmp, 'profile')}`,
        '--virtual-time-budget=10000', '--window-size=1600,900', `--screenshot=${out}`, fileUrl(page)
      ], { stdio: 'ignore' });
      console.log('preview', path.relative(PROJECT, out));
    }
  }
})();
