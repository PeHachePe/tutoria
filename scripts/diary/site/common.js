// Shared by the diary (index.html) and the slides (laminas.html). `data.js` sets the globals:
// DIARY (read from docs/), DIARY_TEXT (the curated words of content.mjs) and IMAGES (paths of the captures).
const D = window.DIARY;
const TEXT = window.DIARY_TEXT;
const IMG = window.IMAGES;
/** Printing (the PDF of the slides): everything static, no animations. */
const printing = new URLSearchParams(location.search).has('print');
if (printing) document.documentElement.classList.add('print');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const fmt = (n, d = 0) =>
  Number(n).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtBig = (n) =>
  n >= 1e9
    ? `${fmt(n / 1e9, 1)} mil M`
    : n >= 1e6
      ? `${fmt(n / 1e6, 1)} M`
      : n >= 1e4
        ? `${fmt(n / 1e3, 0)} k`
        : fmt(n);
const dLong = (iso) =>
  new Date(`${iso}T12:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
const dShort = (iso) =>
  new Date(`${iso}T12:00`)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');
const dayN = (iso) => Math.round((Date.parse(iso) - Date.parse(D.totals.from)) / 864e5) + 1;
const reduced = printing || matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, def) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? def;
    } catch {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
const withTransition = (fn) =>
  document.startViewTransition && !reduced ? document.startViewTransition(fn) : fn();
const PHASE = D.phases;
const stepById = Object.fromEntries(D.steps.map((s) => [s.id, s]));
const decById = Object.fromEntries(D.decisions.map((d) => [d.id, d]));
const CAL = (() => {
  const out = [];
  for (
    let t = Date.parse(`${D.totals.from}T12:00Z`);
    t <= Date.parse(`${D.totals.to}T12:00Z`);
    t += 864e5
  )
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
})();
/** The month or months the project spans, under the day axis. */
const CAL_MONTHS = [
  ...new Set(CAL.map((d) => new Date(`${d}T12:00`).toLocaleDateString('es-ES', { month: 'long' }))),
].join(' – ');

// Theme toggle (remembered per viewer).
{
  const saved = store.get('diary-theme', null);
  if (saved) document.documentElement.dataset.theme = saved;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('diary-theme', root.dataset.theme);
  });
}

// Animated number.
function countUp(el, to, digits = 0, suffix = '') {
  if (reduced) return (el.textContent = fmt(to, digits) + suffix);
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 900);
    el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)), digits) + suffix;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Per-day cumulative line with a hover/focus bubble on every day.
function dayLine({ values, unit, tone = 'ph2', w = 440, h = 230 }) {
  const x0 = 22,
    x1 = w - 22,
    y0 = h - 44,
    top = 26,
    n = CAL.length - 1;
  const X = (i) => x0 + (i / n) * (x1 - x0);
  const max = Math.max(...values) || 1;
  const pts = values.map((v, i) => [X(i), y0 - (v / max) * (y0 - top)]);
  const line = pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const mondays = CAL.map((d, i) =>
    new Date(`${d}T12:00Z`).getUTCDay() === 1
      ? `<line class="grid" x1="${X(i)}" x2="${X(i)}" y1="${top}" y2="${y0}"/>`
      : '',
  ).join('');
  const labels = CAL.map(
    (d, i) =>
      `<text class="axis" x="${X(i).toFixed(1)}" y="${y0 + 18}" text-anchor="middle" ${[0, 6].includes(new Date(`${d}T12:00Z`).getUTCDay()) ? 'opacity=".5"' : ''}>${+d.slice(8)}</text>`,
  ).join('');
  const hits = values
    .map((v, i) => {
      const delta = v - (values[i - 1] ?? 0);
      const tip = `${dShort(CAL[i])} · ${fmt(v)} ${unit}${delta > 0 ? ` (+${fmt(delta)})` : ''}`;
      return `<rect class="hit" x="${(X(i) - (x1 - x0) / n / 2).toFixed(1)}" y="${top}" width="${((x1 - x0) / n).toFixed(1)}" height="${y0 - top + 24}" tabindex="0" data-x="${X(i).toFixed(1)}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>`;
    })
    .join('');
  const [lx, ly] = pts.at(-1);
  return `<svg class="${tone} chart" viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(unit)} por día">${mondays}<polygon class="area" points="${x0},${y0} ${line} ${x1},${y0}"/><polyline class="lineq" points="${line}"/><circle cx="${lx}" cy="${ly}" r="5" fill="var(--c)"/><line class="base" x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}"/>${labels}<text class="axis" x="${w / 2}" y="${h - 4}" text-anchor="middle">${CAL_MONTHS}</text><g class="tip" aria-hidden="true"><line class="guide" y1="${top}" y2="${y0}"/><rect class="tip-bg" y="${top - 24}" height="24" rx="12"/><text class="tip-t" y="${top - 7}" text-anchor="middle"></text></g>${hits}</svg>`;
}
function wireCharts(root = document) {
  for (const svg of $$('svg.chart', root)) {
    if (svg.dataset.wired) continue;
    svg.dataset.wired = '1';
    const w = svg.viewBox.baseVal.width;
    const [guide, bg, text] = [$('.guide', svg), $('.tip-bg', svg), $('.tip-t', svg)];
    const show = (hit) => {
      const x = +hit.dataset.x;
      text.textContent = hit.dataset.tip;
      const tw = text.getComputedTextLength() + 24;
      const cx = Math.min(Math.max(x, 4 + tw / 2), w - 4 - tw / 2);
      text.setAttribute('x', cx);
      bg.setAttribute('x', cx - tw / 2);
      bg.setAttribute('width', tw);
      guide.setAttribute('x1', x);
      guide.setAttribute('x2', x);
      svg.classList.add('show');
    };
    for (const hit of $$('.hit', svg)) {
      hit.addEventListener('pointerenter', () => show(hit));
      hit.addEventListener('focus', () => show(hit));
      hit.addEventListener('blur', () => svg.classList.remove('show'));
    }
    svg.addEventListener('pointerleave', () => svg.classList.remove('show'));
  }
}
const cumulativeBy = (fn) => {
  let acc = 0;
  return CAL.map((d) => {
    acc = fn(
      acc,
      D.steps.filter((s) => s.date === d),
    );
    return acc;
  });
};
const testsPerDay = () => cumulativeBy((acc, ss) => Math.max(acc, ...ss.map((s) => s.unit)));
const costPerDay = () => cumulativeBy((acc, ss) => acc + ss.reduce((a, s) => a + s.usd, 0));

// Calendar heat map (weeks as rows).
function heatmap(values, unit) {
  const first = new Date(`${CAL[0]}T12:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const max = Math.max(...Object.values(values));
  const weeks = Math.ceil((lead + CAL.length) / 7);
  let cells = '';
  for (let k = 0; k < weeks * 7; k++) {
    const i = k - lead;
    const x = 4 + (k % 7) * 44,
      y = 22 + Math.floor(k / 7) * 36;
    if (i < 0 || i >= CAL.length) {
      cells += `<rect x="${x}" y="${y}" width="38" height="30" rx="8" fill="none" stroke="var(--line)" stroke-dasharray="3 3"/>`;
      continue;
    }
    const d = CAL[i],
      v = values[d] || 0,
      lvl = v ? Math.min(4, Math.ceil((v / max) * 4)) : 0;
    cells += `<g><rect class="heat l${lvl}" x="${x}" y="${y}" width="38" height="30" rx="8"><title>${dShort(d)}: ${fmt(v)} ${unit}</title></rect><text x="${x + 19}" y="${y + 20}" text-anchor="middle" class="heat-n l${lvl}">${+d.slice(8)}</text></g>`;
  }
  const dn = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    .map((d, i) => `<text class="axis" x="${23 + i * 44}" y="14" text-anchor="middle">${d}</text>`)
    .join('');
  return `<svg viewBox="0 0 312 ${22 + weeks * 36}" role="img" aria-label="${esc(unit)} por día">${dn}${cells}</svg>`;
}

// How the tutor's instruction evolved: a clickable timeline with a detail card underneath.
// The labels are the curated ones of content.mjs: the headings of prompt-history.md are internal.
const PROMPT_TEXT = TEXT.prompts;
const promptLabel = (p) => PROMPT_TEXT[p.v]?.[0] ?? p.title;
const promptDate = (p) =>
  (p.step && stepById[p.step]?.date) || (p.decision && decById[p.decision]?.date) || null;
function promptTimeline(start = D.prompts.length - 1) {
  const nodes = D.prompts
    .map(
      (p, i) =>
        `<button type="button" class="pt-node" data-pv="${i}" aria-pressed="${i === start}"><i aria-hidden="true"></i><b>${p.v}</b><span>${esc(promptLabel(p))}</span><small>${promptDate(p) ? dShort(promptDate(p)) : ''}</small></button>`,
    )
    .join('');
  return `<div class="pt" data-start="${start}"><p class="pt-intro">Ocho versiones de las instrucciones que convierten al modelo de IA en tutor. <b>Pulsa una</b> para ver qué aprendió en cada una.</p><div class="pt-line" role="group" aria-label="Versiones de la instrucción del tutor">${nodes}</div><div class="pt-card" aria-live="polite"></div></div>`;
}
function wirePromptTimeline(root = document) {
  for (const pt of $$('.pt', root)) {
    if (pt.dataset.wired) continue;
    pt.dataset.wired = '1';
    const card = $('.pt-card', pt);
    const show = (i) => {
      const p = D.prompts[i];
      const when = promptDate(p);
      for (const b of $$('.pt-node', pt))
        b.setAttribute('aria-pressed', String(+b.dataset.pv === i));
      const where = p.step ? `paso ${p.step}` : 'auditoría de seguridad';
      card.innerHTML = `<div class="pt-head"><b>${p.v} · ${esc(promptLabel(p))}</b><span>${where}${when ? ` · ${dLong(when)}` : ''}</span></div>
        <p>${esc(PROMPT_TEXT[p.v]?.[1] ?? '')}</p>`;
      card.style.setProperty('--x', `${((i + 0.5) / D.prompts.length) * 100}%`);
    };
    pt.addEventListener('click', (e) => {
      const b = e.target.closest('.pt-node');
      if (b) show(+b.dataset.pv);
    });
    pt.addEventListener('pointerover', (e) => {
      const b = e.target.closest('.pt-node');
      if (b && matchMedia('(hover: hover)').matches) show(+b.dataset.pv);
    });
    pt.addEventListener('focusin', (e) => {
      const b = e.target.closest('.pt-node');
      if (b) show(+b.dataset.pv);
    });
    show(+pt.dataset.start);
  }
}
