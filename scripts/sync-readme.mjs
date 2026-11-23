import fs from 'node:fs';
import path from 'node:path';

const USERNAME = process.env.GITHUB_USERNAME || 'vishn0o';
const TOKEN = process.env.GITHUB_TOKEN || '';
const README_PATH = path.resolve('README.md');

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'vishn0o-readme-sync',
  ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {})
};

async function ghFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
  return res.json();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTitle(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/^Inkynerd$/i, 'InkyNerd')
    .replace(/^Kathashelf$/i, 'KathaShelf');
}

const SURFACE_OVERRIDES = {
  inkynerd: 'Kotlin · Compose · Room',
  kathashelf: 'Rust · egui · SQLite'
};

function renderTelemetrySvg(dark, repoCount, totalBytes, memberSince, topLangs) {
  const bg = dark ? '#0B0C0E' : '#FAF9F5';
  const border = dark ? '#4A5160' : '#121211';
  const subBorder = dark ? '#252932' : '#CFCBC0';
  const ink = dark ? '#F2F3F5' : '#121211';
  const muted = dark ? '#808690' : '#6C6A64';
  const accent = dark ? '#FF4F14' : '#D93800';
  const palette = [accent, ink, '#64748B', '#94A3B8', '#475569'];

  const barW = 836;
  let xCursor = 32;
  const rects = [];
  const legend = [];

  topLangs.forEach(([name, bytes], i) => {
    const col = palette[i % palette.length];
    const w = totalBytes > 0 ? Math.max(4, Math.round((bytes / totalBytes) * barW)) : 0;
    rects.push(`<rect x="${xCursor}" y="116" width="${w}" height="16" fill="${col}" />`);
    xCursor += w;
    const lx = 32 + i * 168;
    const pct = totalBytes > 0 ? `${((bytes / totalBytes) * 100).toFixed(1)}%` : '0.0%';
    legend.push(`<rect x="${lx}" y="148" width="10" height="10" fill="${col}" />`);
    legend.push(`<text x="${lx + 16}" y="157" font-family="'Courier New', Courier, monospace" font-size="11" fill="${ink}">${escapeHtml(name)} (${pct})</text>`);
  });

  const kb = `${Math.round(totalBytes / 1024)} KB`;
  const countStr = String(repoCount).padStart(2, '0');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 185" width="900" height="185">
  <rect width="900" height="185" fill="${bg}" stroke="${border}" stroke-width="1.5" />
  <text x="32" y="34" font-family="'Courier New', Courier, monospace" font-size="11" font-weight="700" letter-spacing="1.5" fill="${accent}">TELEMETRY // LOCAL SOURCE FOOTPRINT</text>
  <text x="868" y="34" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="11" fill="${muted}">AUTO-SYNCED VIA GITHUB ACTIONS</text>
  <line x1="32" y1="46" x2="868" y2="46" stroke="${subBorder}" stroke-width="1" />
  <text x="32" y="76" font-family="'Courier New', Courier, monospace" font-size="10.5" fill="${muted}">SHIPPED REPOS</text>
  <text x="32" y="98" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${ink}">${countStr}</text>
  <text x="240" y="76" font-family="'Courier New', Courier, monospace" font-size="10.5" fill="${muted}">SOURCE VOLUME</text>
  <text x="240" y="98" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${ink}">${kb}</text>
  <text x="460" y="76" font-family="'Courier New', Courier, monospace" font-size="10.5" fill="${muted}">CLOUD SERVERS</text>
  <text x="460" y="98" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${accent}">00</text>
  <text x="680" y="76" font-family="'Courier New', Courier, monospace" font-size="10.5" fill="${muted}">ACTIVE SINCE</text>
  <text x="680" y="98" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${ink}">${memberSince}</text>
  ${rects.join('\n  ')}
  ${legend.join('\n  ')}
</svg>
`;
}

async function main() {
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const markerRegex = /(<!-- SPECIMENS:START -->)([\s\S]*?)(<!-- SPECIMENS:END -->)/;
  if (!markerRegex.test(readme)) {
    throw new Error('Could not find <!-- SPECIMENS:START --> / <!-- SPECIMENS:END --> markers in README.md');
  }

  const user = await ghFetch(`https://api.github.com/users/${USERNAME}`);
  const repos = await ghFetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=30`);
  const ownRepos = repos.filter(r => !r.fork && r.name.toLowerCase() !== USERNAME.toLowerCase() && !r.name.toLowerCase().endsWith('.github.io'));

  const langTotals = {};
  const rows = [];

  for (let i = 0; i < ownRepos.length; i++) {
    const repo = ownRepos[i];
    const id = String(i + 1).padStart(2, '0');
    const title = formatTitle(repo.name);
    const desc = repo.description || 'Local-first open-source software specimen.';
    const languages = await ghFetch(repo.languages_url);
    for (const [lang, bytes] of Object.entries(languages)) {
      langTotals[lang] = (langTotals[lang] || 0) + bytes;
    }
    const langList = Object.keys(languages).slice(0, 3);
    const surface = SURFACE_OVERRIDES[repo.name.toLowerCase()] || langList.join(' · ') || repo.language || 'Local-First';

    rows.push(`    <tr>
      <td><code>${id}</code></td>
      <td><a href="${escapeHtml(repo.html_url)}"><b>${escapeHtml(title)}</b></a></td>
      <td>${escapeHtml(desc)}</td>
      <td><code>${escapeHtml(surface)}</code></td>
    </tr>`);
  }

  const tableHtml = `
<table>
  <thead>
    <tr>
      <th align="left">ID</th>
      <th align="left">SPECIMEN</th>
      <th align="left">ARCHITECTURE &amp; FOOTPRINT</th>
      <th align="left">SURFACE</th>
    </tr>
  </thead>
  <tbody>
${rows.join('\n')}
  </tbody>
</table>
`;

  const updatedReadme = readme.replace(markerRegex, `$1${tableHtml}$3`);
  fs.writeFileSync(README_PATH, updatedReadme, 'utf8');

  const sortedLangs = Object.entries(langTotals).sort((a, b) => b[1] - a[1]);
  const totalBytes = sortedLangs.reduce((s, [, b]) => s + b, 0);
  const top4 = sortedLangs.slice(0, 4);
  const restBytes = sortedLangs.slice(4).reduce((s, [, b]) => s + b, 0);
  const chartLangs = restBytes > 0 ? [...top4, ['Other', restBytes]] : top4;
  const memberSince = new Date(user.created_at).getFullYear();

  fs.mkdirSync(path.resolve('assets'), { recursive: true });
  fs.writeFileSync(path.resolve('assets/stats-light.svg'), renderTelemetrySvg(false, ownRepos.length, totalBytes, memberSince, chartLangs), 'utf8');
  fs.writeFileSync(path.resolve('assets/stats-dark.svg'), renderTelemetrySvg(true, ownRepos.length, totalBytes, memberSince, chartLangs), 'utf8');

  console.log(`Synced ${ownRepos.length} specimens and telemetry SVGs into README.md.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
