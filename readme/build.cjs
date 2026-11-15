// node readme/build.cjs <ci-sight checkout> : README hero and feature panels (light/dark) and social-preview.png, from readme/inputs/
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium, fonts, logo, checkout, render } = require('../lib.cjs');

const repo = checkout(process.argv[2]);
const inputs = path.join(__dirname, 'inputs');
const out = path.join(repo, '.github/readme');
const b64 = name => 'data:image/png;base64,' + fs.readFileSync(path.join(inputs, `${name}.png`)).toString('base64');
const t = dark => dark ? 'dark' : 'light';

const base = dark => `<!doctype html><meta charset="utf-8">${fonts}
<style>
  :root { --bg: ${dark ? '#151716' : '#f4f3ee'}; --ink: ${dark ? '#ecebe5' : '#1b1c1a'}; --muted: ${dark ? '#a29f96' : '#5f5d56'};
    --accent: ${dark ? '#4fd1ae' : '#0f7a63'};
    --wash: ${dark
      ? 'radial-gradient(60% 80% at 15% 10%, #1f6e5a 0%, transparent 70%), radial-gradient(55% 70% at 90% 25%, #124a3d 0%, transparent 70%), radial-gradient(70% 70% at 60% 110%, #2c8f74 0%, transparent 65%), #0f2f28'
      : 'radial-gradient(60% 80% at 12% 8%, #a6e3cf 0%, transparent 70%), radial-gradient(55% 70% at 92% 20%, #5cc3a3 0%, transparent 70%), radial-gradient(70% 70% at 55% 115%, #2a9d7c 0%, transparent 65%), #c9eadd'}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; }
  body { width: 1280px; overflow: hidden; color: var(--ink); font-family: system-ui, sans-serif; }
  .card { position: relative; width: 1280px; overflow: hidden; border-radius: 28px; background: var(--bg); }
  .serif { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; }
  .serif i { color: var(--accent); }
  .stage { position: relative; overflow: hidden; background: var(--wash); }
  .shot { position: absolute; border-radius: 12px; box-shadow: 0 30px 70px -20px #0009, 0 0 0 1px #0000001a; }
</style>`;

const hero = (dark, h, radius = 28) => `${base(dark)}<style>
  .card { height: ${h}px; text-align: center; border-radius: ${radius}px; }
  .brand { display: inline-flex; align-items: center; gap: 10px; margin-top: ${h > 700 ? 48 : 34}px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .brand svg { width: 30px; height: 30px; }
  h1 { margin: ${h > 700 ? 30 : 16}px 0 0; font-size: ${h > 700 ? 116 : 100}px; line-height: 0.98; }
  p { margin: 22px auto 0; max-width: 600px; text-wrap: balance; font-size: 20px; line-height: 1.45; color: var(--muted); }
  .stage { position: absolute; left: 120px; right: 120px; top: ${h > 700 ? 452 : 380}px; height: 420px; border-radius: 24px 24px 0 0; }
  .dash { left: 56px; top: 48px; width: 860px; }
  .drawer { left: 640px; top: 30px; width: 360px; }
</style>
<div class="card">
  <div class="brand">${logo(repo, dark ? '#4fd1ae' : '#0f7a63')}CI-Sight</div>
  <h1 class="serif">see why the<br>build <i>broke</i></h1>
  <p>A self-hosted dashboard for GitHub Actions that sorts failed runs by cause and suggests a fix from their logs.</p>
  <div class="stage">
    <img class="shot dash" src="${b64(`dashboard-${t(dark)}`)}">
    <img class="shot drawer" src="${b64(`drawer-${t(dark)}`)}">
  </div>
</div>`;

const feature = (dark, n, title, text, stage) => `${base(dark)}<style>
  .card { height: 560px; display: grid; grid-template-columns: 1fr 640px; }
  .copy { padding: 0 56px 0 72px; display: flex; flex-direction: column; justify-content: center; }
  .num { font: 500 15px ui-monospace, 'Cascadia Code', monospace; color: var(--muted); }
  h2 { margin: 14px 0 0; font-size: 64px; line-height: 1.02; }
  p { margin: 20px 0 0; font-size: 19px; line-height: 1.5; color: var(--muted); }
  .stage { margin: 28px 28px 28px 0; border-radius: 20px; }
</style>
<div class="card">
  <div class="copy"><div class="num">${n}</div><h2 class="serif">${title}</h2><p>${text}</p></div>
  <div class="stage">${stage}</div>
</div>`;

const pages = dark => [
  ['hero', hero(dark, 760), 760],
  ['feature-dashboard', feature(dark, '01', 'Every pipeline, <i>one</i> view',
    'Success rate, average duration, failure causes and webhook health across all the repositories you connect, updated as runs finish.',
    `<img class="shot" style="left:48px;top:48px;width:980px" src="${b64(`dashboard-${t(dark)}`)}">`), 560],
  ['feature-failures', feature(dark, '02', 'Failures, <i>explained</i>',
    'Each failed run gets a category and a suggested fix, from a library of known errors or a local model, next to the full log with error lines marked.',
    `<img class="shot" style="left:96px;top:40px;width:440px" src="${b64(`drawer-${t(dark)}`)}">`), 560],
  ['feature-projects', feature(dark, '03', 'Each repo, <i>up close</i>',
    'A page per repository with its success and failure rates, recent activity and every build, one click from the run on GitHub.',
    `<img class="shot" style="left:40px;top:40px;width:760px" src="${b64(`project-${t(dark)}`)}">`), 560],
];

(async () => {
  const browser = await chromium.launch();
  for (const dark of [false, true]) {
    for (const [name, html, height] of pages(dark)) {
      await render(browser, html, path.join(out, `${name}-${t(dark)}.png`), { width: 1280, height, scale: 1.6, transparent: true });
    }
  }
  const social = path.join(__dirname, '..', 'social-preview.png');
  await render(browser, hero(false, 640, 0), social, { width: 1280, height: 640 });
  await browser.close();
  const downloads = path.join(os.homedir(), 'Downloads');
  if (fs.existsSync(downloads)) fs.copyFileSync(social, path.join(downloads, 'CI-Sight-social-preview.png'));
})();
