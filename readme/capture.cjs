// node readme/capture.cjs <ci-sight checkout> : builds the real dashboard and screenshots it, its API answered from demo-data.json, into readme/inputs/
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, checkout } = require('../lib.cjs');

const repo = checkout(process.argv[2]);
const inputs = path.join(__dirname, 'inputs');
const demo = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-data.json'), 'utf8'));
const PORT = 5179;
const BASE = `http://localhost:${PORT}`;

const now = Date.parse(demo.now);
const ago = min => new Date(now - min * 60000).toISOString();
const projects = demo.projects.map(p => ({ id: p.id, name: p.name, githubRepoUrl: p.githubRepoUrl, createdAt: ago(p.createdMinutesAgo) }));
const builds = demo.builds.map(b => ({
  id: b.id, projectId: b.projectId, projectName: projects.find(p => p.id === b.projectId).name, status: b.status, commit: b.commit,
  startedAt: ago(b.startedMinutesAgo), completedAt: b.durationMinutes ? ago(b.startedMinutesAgo - b.durationMinutes) : null,
}));
const details = id => {
  const b = builds.find(x => x.id === id);
  const p = projects.find(x => x.id === b.projectId);
  const failed = b.status === 'FAILURE';
  return {
    id, projectName: b.projectName, githubRepoUrl: p.githubRepoUrl, githubRunId: String(9100000 + id), status: b.status,
    startedAt: b.startedAt, completedAt: b.completedAt,
    errorCategory: failed ? demo.failure.errorCategory : null,
    failureReason: failed ? demo.failure.failureReason : null,
    logs: b.status === 'RUNNING' ? '' : demo.log.join('\n'),
  };
};
const api = {
  '/api/auth/me': { user: demo.user },
  '/api/health': { status: 'ok', time: demo.now },
  '/api/projects': projects,
  '/api/builds': builds,
  '/api/builds/analytics/errors': demo.errorAnalytics,
  '/api/my/repos': demo.projects.map(p => ({ id: p.id, repoFullName: p.githubRepoUrl, webhookId: p.webhookId, project: { id: p.id, name: p.name } })),
  '/api/github/repos': projects.map(p => ({ id: p.id, full_name: p.githubRepoUrl, name: p.name, private: false })),
};
const answer = pathname => {
  let m;
  if ((m = pathname.match(/^\/api\/projects\/(\d+)$/))) return projects.find(p => p.id === +m[1]);
  if ((m = pathname.match(/^\/api\/projects\/(\d+)\/builds$/))) return builds.filter(b => b.projectId === +m[1]);
  if ((m = pathname.match(/^\/api\/builds\/(\d+)$/))) return details(+m[1]);
  return api[pathname];
};

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Vite preview server did not start');
}

(async () => {
  // A production build: the dev server re-optimises dependencies on first load and reloads the page mid-capture.
  const client = path.join(repo, 'client');
  const viteBin = path.join(client, 'node_modules/vite/bin/vite.js');
  execFileSync(process.execPath, [viteBin, 'build'], { cwd: client, stdio: 'ignore' });
  const vite = spawn(process.execPath, [viteBin, 'preview', '--port', String(PORT), '--strictPort'], { cwd: client, stdio: 'ignore' });
  const browser = await chromium.launch();
  try {
    await waitForServer();
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'en-US', timezoneId: 'UTC',
      });
      await context.route(url => url.pathname.startsWith('/api/'), route => {
        const body = answer(new URL(route.request().url()).pathname);
        if (body === undefined) throw new Error(`No demo data for ${route.request().url()}`);
        return route.fulfill({ json: body });
      });
      const page = await context.newPage();
      // Demo time, but left running: the log virtualiser stalls on a frozen clock.
      await page.clock.install({ time: now });
      await page.clock.resume();
      const settle = async () => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle');
      };
      const shot = async name => { await settle(); await page.screenshot({ path: path.join(inputs, `${name}-${scheme}.png`) }); };

      await page.goto(`${BASE}/`);
      await page.getByText('Recent Builds').waitFor();
      await shot('dashboard');

      await page.goto(`${BASE}/projects/1`);
      await page.getByText('Project Statistics').waitFor();
      await shot('project');

      await page.goto(`${BASE}/`);
      await page.locator('tr', { hasText: 'e41b7d0' }).click();
      const drawer = page.locator('.mantine-Drawer-content');
      await drawer.getByText('AssertionError').waitFor();
      // The drawer focuses its close button on open.
      await page.addStyleTag({ content: '.mantine-Drawer-close:focus { outline: none !important; } *, *::before, *::after { transition: none !important; animation: none !important; }' });
      await page.waitForFunction(() => {
        const r = document.querySelector('.mantine-Drawer-content').getBoundingClientRect();
        return Math.abs(r.right - innerWidth) < 1;
      });
      await settle();
      await drawer.screenshot({ path: path.join(inputs, `drawer-${scheme}.png`) });
      await context.close();
    }
  } finally {
    await browser.close();
    vite.kill();
  }
})();
