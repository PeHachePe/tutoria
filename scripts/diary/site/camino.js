// ======================= El camino: the diary as a board, one square per step =======================
const VIEWS = ['camino', 'cifras', 'pantallas', 'decisiones', 'guion'];
const rendered = {};
let activeView = 'camino';
const isMobile = () => innerWidth < 900;
const stripLinks = (html) => html.replace(/<a [^>]*>([^<]*)<\/a>/g, '<b>$1</b>');
const stepHref = (id) => `#camino/${encodeURIComponent(id)}`;

function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const k = h.indexOf('/');
  const view = k < 0 ? h : h.slice(0, k);
  return { view: VIEWS.includes(view) ? view : 'camino', arg: k < 0 ? null : h.slice(k + 1) };
}
function route() {
  const { view, arg } = parseHash();
  const change = () => {
    activeView = view;
    for (const v of VIEWS) $(`#v-${v}`).hidden = v !== view;
    for (const a of $$('.tabs a'))
      a.dataset.view === view
        ? a.setAttribute('aria-current', 'page')
        : a.removeAttribute('aria-current');
    if (!rendered[view]) {
      RENDER[view]();
      rendered[view] = true;
    }
    ARG[view]?.(arg);
  };
  (view === activeView && rendered[view]) || !Object.keys(rendered).length
    ? change()
    : withTransition(change);
}
addEventListener('hashchange', route);

// ---------------------------------------------------------------- Camino
const board = $('#board');
const detail = $('#detail');
// The PEC3 is a milestone, not a step; only what comes after it is shown as pending, up to the PEC4.
const [PEC3, PEC4] = TEXT.milestones;
const items = [
  { kind: 'start' },
  ...D.steps.map((s) => ({ kind: 'step', s })),
  { kind: 'milestone', m: PEC3 },
  ...D.next.map((n) => ({ kind: 'ghost', n })),
  { kind: 'goal', m: PEC4 },
];
const indexOfStep = Object.fromEntries(items.map((it, i) => [it.s?.id, i]).filter(([k]) => k));
let sel = 0;
let layout = null;
let token = null;
let facing = 1;
let phaseFilter = null;

function computeLayout() {
  const W = board.clientWidth;
  const n = items.length;
  let best;
  if (isMobile()) {
    const cols = W < 430 ? 6 : 9;
    best = { cols, rows: Math.ceil(n / cols), cell: W / cols };
    board.style.height = `${best.rows * best.cell + 10}px`;
  } else {
    board.style.height = '';
    const H = board.clientHeight;
    for (let cols = 6; cols <= 22; cols++) {
      const rows = Math.ceil(n / cols);
      const cell = Math.min(W / cols, (H - 10) / rows);
      if (!best || cell > best.cell) best = { cols, rows, cell };
    }
  }
  const { cols, rows, cell } = best;
  const H = isMobile() ? rows * cell : board.clientHeight;
  const offX = (W - cols * cell) / 2,
    offY = Math.max(10, (H - rows * cell) / 2 + 6);
  const pos = items.map((_, i) => {
    const r = Math.floor(i / cols),
      c = i % cols,
      cc = r % 2 === 0 ? c : cols - 1 - c;
    return [offX + cc * cell + cell / 2, offY + r * cell + cell / 2];
  });
  return { cell, pos, s: cell * 0.62 };
}
function squareLabel(it) {
  if (it.kind === 'start') return '🚩';
  if (it.kind === 'goal') return '🎓';
  if (it.kind === 'milestone') return '🏁';
  if (it.kind === 'ghost') return it.n.id;
  return /^\d/.test(it.s.id) ? it.s.id.replace(/\s*\(plan\)$/, '') : '🔧';
}
function drawBoard(intro = false) {
  layout = computeLayout();
  const { cell, pos, s } = layout;
  const d = `M${pos.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')}`;
  const seenPhase = new Set();
  let g = `<path class="road" d="${d}" stroke-width="${(cell * 0.42).toFixed(1)}" pathLength="1"/><path class="road-dash" d="${d}" stroke-width="${Math.max(1.5, cell * 0.035).toFixed(1)}" stroke-dasharray="${(cell * 0.1).toFixed(1)} ${(cell * 0.14).toFixed(1)}"/>`;
  items.forEach((it, i) => {
    const [x, y] = pos[i];
    const cls =
      it.kind === 'step' ? `sq ph${it.s.phase}` : it.kind === 'ghost' ? 'sq ghost' : 'sq special';
    const label = squareLabel(it);
    const fs = /\p{Extended_Pictographic}/u.test(label)
      ? s * 0.42
      : s * (label.length <= 3 ? 0.34 : label.length <= 4 ? 0.29 : 0.24);
    const aria =
      it.kind === 'milestone'
        ? `Hito: ${it.m.label}, ${dLong(it.m.date)}`
        : it.kind === 'step'
          ? `Paso ${it.s.id}: ${it.s.title}, ${dLong(it.s.date)}`
          : it.kind === 'ghost'
            ? `Por hacer: ${it.n.id}, ${it.n.title}`
            : it.kind === 'start'
              ? 'Salida: presentación del diario'
              : 'Meta: lo que queda hasta la defensa';
    let extra = '';
    if (it.kind === 'step') {
      const prev = items[i - 1];
      if (cell >= 34 && (!prev.s || prev.s.date !== it.s.date))
        extra += `<text class="daylbl" x="${x}" y="${y - s / 2 - 5}">${+it.s.date.slice(8)}</text>`;
      if (!seenPhase.has(it.s.phase)) {
        seenPhase.add(it.s.phase);
        extra += `<text class="badge" x="${x + s / 2}" y="${y - s / 2}" font-size="${Math.max(11, s * 0.3)}">${PHASE[it.s.phase].icon}</text>`;
      }
      if (/\(plan\)/.test(it.s.id))
        extra += `<text class="badge" x="${x - s / 2 + 2}" y="${y + s / 2 - 2}" font-size="${Math.max(10, s * 0.26)}">📝</text>`;
    }
    g += `<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(aria)}" style="--d:${(intro ? 0.35 + i * 0.012 : 0).toFixed(3)}s"><rect class="tile" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="${s * 0.24}"/><text x="${x}" y="${y + 1}" font-size="${fs.toFixed(1)}">${esc(label)}</text>${extra}</g>`;
  });
  board.innerHTML = `<svg aria-label="El camino del proyecto">${g}</svg>`;
  token = document.createElement('img');
  token.className = 'token';
  token.src = IMG.pug;
  token.alt = '';
  const t = Math.max(26, s * 0.82);
  token.width = token.height = t;
  board.append(token);
  if (intro && !reduced) {
    board.classList.add('intro');
    setTimeout(() => board.classList.remove('intro'), 1500 + items.length * 12);
  }
  applyPhaseFilter();
  markSelected();
  placeToken(sel, false);
}
function tokenXY(i) {
  const [x, y] = layout.pos[i];
  const t = token.width;
  return [x - t / 2, y - layout.s / 2 - t * 0.62];
}
function placeToken(i, animate) {
  const [x, y] = tokenXY(i);
  const from = token._pos;
  if (from && x !== from[0]) facing = x < from[0] ? -1 : 1;
  const final = `translate(${x}px, ${y}px) scaleX(${facing})`;
  if (animate && from && !reduced) {
    const dist = Math.hypot(x - from[0], y - from[1]);
    const hop = Math.min(70, 22 + dist * 0.12);
    token.animate(
      [
        { transform: `translate(${from[0]}px, ${from[1]}px) scaleX(${facing})` },
        {
          transform: `translate(${(from[0] + x) / 2}px, ${Math.min(from[1], y) - hop}px) scaleX(${facing}) rotate(${-10 * facing}deg)`,
        },
        { transform: final },
      ],
      { duration: Math.min(750, 300 + dist * 0.5), easing: 'cubic-bezier(.3,.7,.4,1)' },
    );
  }
  token.style.transform = final;
  token._pos = [x, y];
}
function markSelected() {
  for (const g of $$('.sq', board)) g.classList.toggle('sel', +g.dataset.i === sel);
}
function select(i, { animate = true, focus = false, open = true } = {}) {
  sel = Math.max(0, Math.min(items.length - 1, i));
  markSelected();
  placeToken(sel, animate);
  renderDetail();
  if (focus) $(`.sq[data-i="${sel}"]`, board)?.focus();
  const it = items[sel];
  history.replaceState(null, '', it.kind === 'step' ? stepHref(it.s.id) : '#camino');
  if (isMobile() && open && sel > 0) detail.classList.add('open');
}
function applyPhaseFilter() {
  for (const g of $$('.sq', board))
    g.classList.toggle('dim', phaseFilter !== null && !g.classList.contains(`ph${phaseFilter}`));
  for (const b of $$('#v-camino .legend button'))
    b.setAttribute('aria-pressed', String(+b.dataset.ph === phaseFilter));
  $('#v-camino .legend').classList.toggle('filtering', phaseFilter !== null);
}

function kpi(v, label) {
  return `<div class="kpi"><b>${v}</b><span>${label}</span></div>`;
}
function renderDetail() {
  const it = items[sel];
  detail.className = `detail${detail.classList.contains('open') ? ' open' : ''}`;
  const close =
    '<button class="btn icon close" type="button" data-close aria-label="Cerrar">✕</button>';
  const nav = (label) =>
    `<div class="dnav"><button class="btn" type="button" data-go="-1" ${sel === 0 ? 'disabled' : ''}>←</button><span>${label}</span><button class="btn" type="button" data-go="1" ${sel === items.length - 1 ? 'disabled' : ''}>→</button></div>`;
  const T = D.totals;
  if (it.kind === 'start') {
    detail.innerHTML = `${close}<div class="welcome">
      <span class="chip plain">Diario del proyecto · TFM</span>
      <h2>El camino de <span style="color:var(--accent)">TutorIA</span></h2>
      <p>Una aplicación de ejercicios de programación con un tutor de IA que da pistas sin dar nunca la solución, construida del ${dShort(T.from)} al ${dShort(T.to)} con un agente de IA. Cada casilla es un paso: qué se hizo, qué problemas salieron, cómo lo validó el autor y qué se decidió.</p>
      <div class="big">
        <div><b data-count="${T.planSteps}">0</b><span>pasos del plan</span></div>
        <div><b data-count="${T.days}">0</b><span>días</span></div>
        <div><b data-count="${T.human}">0</b><span>horas del autor</span></div>
        <div><b data-count="${T.commits}">0</b><span>commits</span></div>
        <div><b data-count="${T.problems}">0</b><span>problemas resueltos</span></div>
        <div><b data-count="${T.decisions}">0</b><span>decisiones</span></div>
        <div><b data-count="${T.unit}">0</b><span>tests unitarios</span></div>
        <div><b data-count="${T.e2e}">0</b><span>pruebas e2e</span></div>
      </div>
      <button class="btn primary" type="button" data-go="1">Empezar el camino →</button>
      <p>Usa <kbd>←</kbd> <kbd>→</kbd> para avanzar. 🏁 es la entrega de la PEC3, las casillas punteadas lo que queda hasta la PEC4 (🎓); 📝 marca los pasos de planificación y 🔧 el trabajo fuera del plan.</p>
    </div>`;
    for (const b of $$('[data-count]', detail)) countUp(b, +b.dataset.count);
  } else if (it.kind === 'milestone' || it.kind === 'goal') {
    const m = it.m;
    detail.innerHTML = `${close}<div class="welcome">
      <span class="chip plain">${it.kind === 'goal' ? '🎓 Meta' : '🏁 Hito'} · ${dLong(m.date)}</span>
      <h2>${esc(m.label)}</h2>
      <p>${esc(m.text)}</p>
      ${it.kind === 'goal' ? `<p>Antes, ${D.next.length} pasos del plan y ${D.pending.total} mejoras e ideas anotadas, que se resuelven o se descartan antes de la versión 1.0.</p><a class="btn" href="#guion">🎤 Preparar la defensa con el guion →</a>` : `<p>Después del hito quedan ${D.next.length} pasos del plan, hasta la PEC4.</p>`}
    </div>${nav(it.kind === 'goal' ? 'Meta' : 'Hito')}`;
  } else if (it.kind === 'ghost') {
    detail.innerHTML = `${close}<div class="welcome">
      <span class="chip plain">Después de la PEC3</span>
      <h2>${esc(it.n.id)} · ${esc(it.n.title)}</h2>
      <p>Uno de los pasos del plan que quedan hasta la PEC4${it.n.est ? `, estimado en unas ${fmt(it.n.est, 1)} h` : ''}.</p>
    </div>${nav('Por hacer')}`;
  } else {
    const s = it.s;
    const ph = PHASE[s.phase];
    detail.classList.add(`ph${s.phase}`);
    const before = Math.max(0, ...D.steps.filter((x) => x.n < s.n).map((x) => x.unit));
    const dTests = s.unit > before ? s.unit - before : 0;
    const shots = D.screens.flatMap((sc) =>
      sc.versions.filter((v) => v.step === s.id).map((v) => ({ sc, v })),
    );
    const tabs = [
      [
        'hecho',
        'Qué se hizo',
        `${s.objective ? `<p><b>Objetivo.</b></p>${s.objective}` : ''}<p><b>Qué hizo la IA.</b></p>${s.what}`,
        1,
      ],
      [
        'problemas',
        'Problemas',
        `<ul>${s.problems.map((p) => `<li>${p}</li>`).join('')}</ul>`,
        s.problems.length,
      ],
      [
        'validacion',
        'Validación',
        `${s.validation.length ? `<ul>${s.validation.map((p) => `<li>${p}</li>`).join('')}</ul>` : s.how}`,
        s.validation.length || (s.how ? 1 : 0),
      ],
      [
        'decisiones',
        'Decisiones',
        `<div class="declist">${s.decisions.map((id) => `<button type="button" data-dec="${id}"><b>${id}</b>${esc(decById[id].title)}</button>`).join('')}</div>`,
        s.decisions.length,
      ],
      [
        'capturas',
        'Capturas',
        `<div class="shots">${shots.map(({ sc, v }) => `<button type="button" data-shot="${sc.key}/${v.step}"><img src="${IMG[`${sc.key}/${v.step}/d`]}" alt="${esc(sc.name)} en el paso ${esc(v.step)}" loading="lazy"><span>${esc(sc.name)}</span></button>`).join('')}</div>`,
        shots.length,
      ],
    ].filter((t) => t[3]);
    const est = s.est
      ? `<div class="est">Plan: ≈ ${fmt(s.est, 1)} h · Autor: ${fmt(s.hHuman, 1)} h<div class="bars"><i style="width:${Math.min(100, (s.hHuman / Math.max(s.est, s.hHuman)) * 100)}%"></i><u style="left:calc(${Math.min(100, (s.est / Math.max(s.est, s.hHuman)) * 100)}% - 3px)"></u></div></div>`
      : '';
    detail.innerHTML = `<div class="d-head">${close}
        <div class="d-meta"><span class="chip">${ph.icon} Fase ${s.phase < 8 ? s.phase : ''} · ${esc(ph.short)}</span><span>Día ${dayN(s.date)} · ${dLong(s.date)}</span></div>
        <h2><span class="sid">${esc(s.id)}</span>${esc(s.title)}</h2>
      </div>
      <div class="kpis">${kpi(`${fmt(s.hHuman, 1)} h`, 'del autor')}${kpi(`${fmt(s.hClaude, 1)} h`, 'de Claude')}${kpi(`${fmt(s.usd)} $`, 'coste equivalente')}${kpi(s.unit ? fmt(s.unit) : '—', dTests ? `tests (+${fmt(dTests)})` : 'tests')}${kpi(s.lines ? `+${fmt(s.lines)}` : '—', 'líneas')}${kpi(s.commits || '—', 'commits')}</div>
      ${est}
      ${s.quotes[0] ? `<div class="quote">${s.quotes[0]}</div>` : ''}
      <div class="dtabs" role="tablist">${tabs.map((t, k) => `<button type="button" role="tab" aria-selected="${k === 0}" data-tab="${t[0]}">${t[1]}${t[0] !== 'hecho' ? ` <small>${t[3]}</small>` : ''}</button>`).join('')}</div>
      <div class="dpane" role="tabpanel">${tabs[0][2]}</div>
      ${nav(`${s.n + 1} / ${D.steps.length}`)}`;
    detail._tabs = Object.fromEntries(tabs.map((t) => [t[0], t[2]]));
  }
}
detail.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) return select(sel + +go.dataset.go, { focus: false });
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    for (const b of $$('[data-tab]', detail)) b.setAttribute('aria-selected', String(b === tab));
    $('.dpane', detail).innerHTML = detail._tabs[tab.dataset.tab];
    return;
  }
  const dec = e.target.closest('[data-dec]');
  if (dec) return openDecision(dec.dataset.dec);
  const shot = e.target.closest('[data-shot]');
  if (shot) return (location.hash = `#pantallas/${shot.dataset.shot}`);
  if (e.target.closest('[data-close]')) detail.classList.remove('open');
});
board.addEventListener('click', (e) => {
  const g = e.target.closest('.sq');
  if (g) select(+g.dataset.i);
});
board.addEventListener('keydown', (e) => {
  const g = e.target.closest('.sq');
  if (g && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    select(+g.dataset.i);
  }
});

function renderCamino() {
  $('#v-camino .lead').innerHTML =
    `<b>${D.steps.length} casillas, una por paso.</b> Pulsa una o usa <kbd>←</kbd> <kbd>→</kbd> para avanzar con la carlina.`;
  $('#v-camino .legend').innerHTML = PHASE.map(
    (p) =>
      `<button type="button" class="chip ph${p.i}" data-ph="${p.i}" aria-pressed="false">${p.icon} ${esc(p.short)}</button>`,
  ).join('');
  $('#v-camino .legend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ph]');
    if (!b) return;
    phaseFilter = phaseFilter === +b.dataset.ph ? null : +b.dataset.ph;
    applyPhaseFilter();
  });
  drawBoard(true);
  renderDetail();
  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => drawBoard(false));
  }).observe(board.parentElement);
}

// ---------------------------------------------------------------- Cifras
function renderCifras() {
  const T = D.totals;
  const kp = [
    [T.planSteps, 'pasos del plan'],
    [T.days, 'días de trabajo'],
    [T.human, 'horas del autor'],
    [T.claude, 'horas de Claude'],
    [T.commits, 'commits'],
    [T.unit, 'tests unitarios'],
    [T.decisions, 'decisiones'],
    [T.problems, 'problemas resueltos'],
  ];
  const phases = PHASE.filter((p) => p.i < 8);
  const max = Math.max(...phases.map((p) => Math.max(p.est || 0, p.human)));
  const E = D.elusion;
  const resist = E.tally['ataque:resiste'] || 0,
    attacks = Object.entries(E.tally)
      .filter(([k]) => k.startsWith('ataque'))
      .reduce((a, [, v]) => a + v, 0);
  const helps = E.tally['control:ayuda'] || 0,
    controls = Object.entries(E.tally)
      .filter(([k]) => k.startsWith('control'))
      .reduce((a, [, v]) => a + v, 0);
  const arc = (r, frac, cls) => {
    const c = 2 * Math.PI * r;
    return `<circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--bg2)" stroke-width="12"/><circle r="${r}" cx="60" cy="60" fill="none" class="${cls}" stroke="var(--c)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>`;
  };
  const commits = Object.fromEntries(CAL.map((d) => [d, D.commitsPerDay[d] || 0]));
  const tok = T.tokens;
  $('#v-cifras').innerHTML = `<div class="bento">
    <div class="kpirow">${kp.map(([v, l], i) => `<div class="ph${i}" style="--d:${i * 0.05}s"><b data-count="${v}">0</b><span>${l}</span></div>`).join('')}</div>
    <section class="tile s5" style="--d:.1s"><h3>Plan frente a realidad <small>horas por fase</small></h3>
      <div class="legend2"><span><i></i>horas del autor</span><span><i class="d"></i>estimado en el plan</span></div>
      <div class="planrows">${phases.map((p) => `<div class="planrow ph${p.i}"><span class="nm">${p.icon} ${esc(p.short)}</span><span class="tr"><u style="width:${((p.est || 0) / max) * 100}%"></u><i style="width:0" data-w="${(p.human / max) * 100}%"></i></span><span class="v">${fmt(p.human, 1)} / ${p.est ? fmt(p.est) : '—'} h</span></div>`).join('')}</div>
    </section>
    <section class="tile s4" style="--d:.15s"><h3>Tests unitarios <small>pasa el ratón por cada día</small></h3>${dayLine({ values: testsPerDay(), unit: 'tests', tone: 'ph5' })}</section>
    <section class="tile s3" style="--d:.2s"><h3>Ritmo <small>commits por día</small></h3>${heatmap(commits, 'commits')}</section>
    <section class="tile s4 ph4" style="--d:.25s"><h3>El tutor no da la solución <small>batería de elusión</small></h3>
      <div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="${resist} de ${attacks} ataques resistidos y ${helps} de ${controls} dudas con ayuda">${arc(52, resist / attacks, '')}<g class="ph5">${arc(34, helps / controls, '')}</g></svg>
      <p><b>${resist} de ${attacks}</b>intentos de sacarle la solución, resistidos (${E.attackCases} trucos × 3 pasadas)<br><b style="color:var(--p5)">${helps} de ${controls}</b>dudas legítimas, con ayuda</p></div>
      <small style="color:var(--muted)">${esc(E.column)}. El que queda «por revisar» lo leyó el autor.</small>
    </section>
    <section class="tile s4" style="--d:.3s"><h3>Lo que habría costado <small>a precio de la API, en dólares</small></h3>${dayLine({ values: costPerDay(), unit: '$', tone: 'ph6' })}</section>
    <section class="tile s4" style="--d:.35s"><h3>Cómo trabajó la IA</h3>
      <div class="bignums"><div><b>${fmt(tok.sessions)}</b><span>sesiones de Claude Code</span></div><div><b>${fmt(tok.requests)}</b><span>peticiones al modelo</span></div><div><b>${fmtBig(tok.output)}</b><span>tokens escritos</span></div><div><b>${fmt(tok.cacheRead / 1e6)} M</b><span>tokens releídos de la caché</span></div><div><b>${fmt(T.iterations)}</b><span>iteraciones pedidas por el autor</span></div><div><b>${fmt(T.lines)}</b><span>líneas añadidas</span></div></div>
    </section>
    <section class="tile s6" style="--d:.4s"><h3>Cómo aprendió el tutor <small>versiones de su instrucción</small></h3>
      ${promptTimeline()}
    </section>
    <section class="tile s3" style="--d:.45s"><h3>El manual se escribe solo</h3>
      <div class="bignums"><div><b>${fmt(T.manualShots)}</b><span>capturas</span></div><div><b>3</b><span>manuales en PDF</span></div>${D.manual.map((m) => `<div><b>${m.sections}</b><span>apartados · ${m.profile === 'administracion' ? 'administración' : m.profile}</span></div>`).join('')}</div>
    </section>
    <section class="tile s3" style="--d:.5s"><h3>Lo que queda</h3>
      <div class="bignums"><div><b>${D.pending.total}</b><span>pendientes anotados</span></div><div><b>${D.next.length}</b><span>pasos del plan</span></div></div>
      <div class="next">${D.next.map((n) => `<span>${esc(n.id)} · ${esc(n.title)}</span>`).join('')}</div>
    </section>
  </div>`;
  for (const b of $$('[data-count]', $('#v-cifras'))) countUp(b, +b.dataset.count);
  requestAnimationFrame(() =>
    setTimeout(() => $$('.planrow i').forEach((i) => (i.style.width = i.dataset.w)), 60),
  );
  wireCharts($('#v-cifras'));
  wirePromptTimeline($('#v-cifras'));
}

// ---------------------------------------------------------------- Pantallas
const scr = { key: '03-trabajo', vi: null, device: 'd', timer: null };
function renderPantallas() {
  $('#v-pantallas').innerHTML = `<nav class="slist" aria-label="Pantallas">${D.screens
    .map(
      (sc) =>
        `<button type="button" data-key="${sc.key}"><img src="${IMG[`${sc.key}/${sc.versions.at(-1).step}/d`]}" alt=""><span><b>${esc(sc.name)}</b><small>${sc.versions.length} ${sc.versions.length === 1 ? 'versión' : 'versiones'}</small></span></button>`,
    )
    .join('')}</nav><div class="stage"></div>`;
  $('.slist').addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) location.hash = `#pantallas/${b.dataset.key}`;
  });
}
function showScreen(key, step) {
  const sc = D.screens.find((s) => s.key === key) || D.screens[0];
  if (scr.key !== sc.key) scr.vi = null;
  scr.key = sc.key;
  const vi = step
    ? Math.max(
        0,
        sc.versions.findIndex((v) => v.step === step),
      )
    : (scr.vi ?? sc.versions.length - 1);
  scr.vi = vi;
  for (const b of $$('.slist button'))
    b.setAttribute('aria-current', String(b.dataset.key === sc.key));
  const stage = $('#v-pantallas .stage');
  if (stage.dataset.key !== sc.key) {
    stage.dataset.key = sc.key;
    stage.innerHTML = `<div class="stage-top"><h2>${esc(sc.name)}</h2><div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="seg" role="group" aria-label="Dispositivo"><button type="button" data-dev="d" aria-pressed="${scr.device === 'd'}">🖥️ Escritorio</button><button type="button" data-dev="m" aria-pressed="${scr.device === 'm'}">📱 Móvil</button></span>
      ${sc.versions.length > 1 ? '<button class="btn" type="button" data-play>▶ Ver cómo cambió</button>' : ''}</div></div>
      <div class="frame"><img alt=""><img alt=""></div>
      <div class="vtrack"><button class="btn icon" type="button" data-vgo="-1" aria-label="Versión anterior">←</button><div class="vsteps">${sc.versions.map((v, i) => `<button type="button" class="ph${stepById[v.step]?.phase ?? 8}" data-vi="${i}" aria-label="Versión del paso ${esc(v.step)}"><i></i><span>${esc(v.step)}</span></button>`).join('')}</div><button class="btn icon" type="button" data-vgo="1" aria-label="Versión siguiente">→</button></div>
      <div class="vcap"></div>`;
    stage.onclick = (e) => {
      const v = e.target.closest('[data-vi]');
      if (v) return setVersion(+v.dataset.vi);
      const go = e.target.closest('[data-vgo]');
      if (go) return setVersion(scr.vi + +go.dataset.vgo);
      const dev = e.target.closest('[data-dev]');
      if (dev) {
        scr.device = dev.dataset.dev;
        for (const b of $$('[data-dev]', stage)) b.setAttribute('aria-pressed', String(b === dev));
        return setVersion(scr.vi, true);
      }
      if (e.target.closest('[data-play]')) togglePlay();
    };
  }
  setVersion(vi, true);
}
function setVersion(i, instant = false) {
  const sc = D.screens.find((s) => s.key === scr.key);
  scr.vi = (i + sc.versions.length) % sc.versions.length;
  const v = sc.versions[scr.vi];
  const s = stepById[v.step];
  const frame = $('#v-pantallas .frame');
  frame.classList.toggle('phone', scr.device === 'm');
  const [a, b] = $$('img', frame);
  const front = a.style.opacity === '0' ? b : a,
    back = front === a ? b : a;
  back.src = IMG[`${sc.key}/${v.step}/${scr.device}`];
  back.alt = `${sc.name} en el paso ${v.step}`;
  if (instant) {
    front.style.opacity = '0';
    back.style.opacity = '1';
  } else {
    back.style.opacity = '1';
    front.style.opacity = '0';
  }
  for (const btn of $$('[data-vi]', frame.parentElement))
    btn.setAttribute('aria-current', String(+btn.dataset.vi === scr.vi));
  $('#v-pantallas .vcap').innerHTML =
    `<span><b>${esc(v.step)} · ${esc(s?.title || '')}</b> · ${s ? dLong(s.date) : ''}</span><a href="${stepHref(v.step)}">Ver el paso en el camino →</a>`;
  history.replaceState(null, '', `#pantallas/${sc.key}/${encodeURIComponent(v.step)}`);
}
function togglePlay() {
  const btn = $('[data-play]');
  if (scr.timer) {
    clearInterval(scr.timer);
    scr.timer = null;
    if (btn) btn.textContent = '▶ Ver cómo cambió';
    return;
  }
  const sc = D.screens.find((s) => s.key === scr.key);
  setVersion(0);
  let k = 0;
  if (btn) btn.textContent = '⏸ Parar';
  scr.timer = setInterval(() => {
    k++;
    if (k >= sc.versions.length) return togglePlay();
    setVersion(k);
  }, 1700);
}

// ---------------------------------------------------------------- Decisiones
const dec = { q: '', phase: null, status: 'all', sort: 'citadas', page: 0 };
function renderDecisiones() {
  $('#v-decisiones').innerHTML = `<div class="dtool">
      <input type="search" placeholder="Buscar en las ${D.decisions.length} decisiones…" aria-label="Buscar decisiones">
      <span class="seg" role="group" aria-label="Estado"><button type="button" data-st="all" aria-pressed="true">Todas</button><button type="button" data-st="aprobada" aria-pressed="false">Aprobadas</button><button type="button" data-st="propuesta" aria-pressed="false">Propuestas</button></span>
      <span class="seg" role="group" aria-label="Orden"><button type="button" data-so="citadas" aria-pressed="true">Más citadas</button><button type="button" data-so="recientes" aria-pressed="false">Recientes</button><button type="button" data-so="numero" aria-pressed="false">Por número</button></span>
    </div>
    <div class="legend dphase" role="group" aria-label="Filtrar por fase">${PHASE.map((p) => `<button type="button" class="chip ph${p.i}" data-ph="${p.i}" aria-pressed="false">${p.icon} ${esc(p.short)}</button>`).join('')}</div>
    <div class="dgrid"></div><nav class="pager" aria-label="Páginas"></nav>`;
  const v = $('#v-decisiones');
  $('input', v).addEventListener('input', (e) => {
    dec.q = e.target.value.trim().toLowerCase();
    dec.page = 0;
    drawDecisions();
  });
  v.addEventListener('click', (e) => {
    const st = e.target.closest('[data-st]');
    const so = e.target.closest('[data-so]');
    const ph = e.target.closest('.dphase [data-ph]');
    const pg = e.target.closest('[data-page]');
    const card = e.target.closest('[data-open]');
    if (st) dec.status = st.dataset.st;
    else if (so) dec.sort = so.dataset.so;
    else if (ph) dec.phase = dec.phase === +ph.dataset.ph ? null : +ph.dataset.ph;
    else if (pg) dec.page = +pg.dataset.page;
    else if (card) return (location.hash = `#decisiones/${card.dataset.open}`);
    else return;
    if (!pg) dec.page = 0;
    for (const b of $$('[data-st]', v))
      b.setAttribute('aria-pressed', String(b.dataset.st === dec.status));
    for (const b of $$('[data-so]', v))
      b.setAttribute('aria-pressed', String(b.dataset.so === dec.sort));
    for (const b of $$('.dphase [data-ph]', v))
      b.setAttribute('aria-pressed', String(+b.dataset.ph === dec.phase));
    $('.dphase', v).classList.toggle('filtering', dec.phase !== null);
    drawDecisions();
  });
  new ResizeObserver(() => drawDecisions()).observe($('.dgrid', v));
}
function drawDecisions() {
  const grid = $('#v-decisiones .dgrid');
  if (!grid || $('#v-decisiones').hidden) return;
  let list = D.decisions.filter(
    (d) =>
      (dec.status === 'all' || d.status === dec.status) &&
      (dec.phase === null || d.phase === dec.phase) &&
      (!dec.q || `${d.id} ${d.title} ${d.context} ${d.decision}`.toLowerCase().includes(dec.q)),
  );
  list = list
    .slice()
    .sort((a, b) =>
      dec.sort === 'citadas'
        ? b.citedBy.length - a.citedBy.length || a.id.localeCompare(b.id)
        : dec.sort === 'recientes'
          ? b.id.localeCompare(a.id)
          : a.id.localeCompare(b.id),
    );
  let per = 8;
  if (!isMobile()) {
    const cols = Math.max(1, Math.floor((grid.clientWidth + 12) / (270 + 12)));
    const rows = Math.max(1, Math.floor((grid.clientHeight + 12) / (176 + 12)));
    per = cols * rows;
  }
  const pages = Math.max(1, Math.ceil(list.length / per));
  dec.page = Math.min(dec.page, pages - 1);
  grid.innerHTML = list.length
    ? list
        .slice(dec.page * per, dec.page * per + per)
        .map(
          (d, k) =>
            `<button type="button" class="dcard ${d.phase !== null ? `ph${d.phase}` : ''}" data-open="${d.id}" style="--d:${k * 0.03}s"><span class="top"><b>${d.id}</b><span>${d.date ? dShort(d.date) : ''}</span></span><h3>${esc(d.title)}</h3><p>${stripLinks(d.summary)}</p><span class="foot"><span class="tag ${d.status === 'propuesta' ? 'prop' : ''}">${d.status}</span><span>${d.citedBy.length ? `↗ ${d.citedBy.length} ${d.citedBy.length === 1 ? 'paso' : 'pasos'}` : ''}</span><span>${d.alternatives.length ? `⚖ ${d.alternatives.length} alternativas` : ''}</span></span></button>`,
        )
        .join('')
    : '<p style="color:var(--muted)">Ninguna decisión coincide. Prueba con otras palabras o quita el filtro.</p>';
  $('#v-decisiones .pager').innerHTML =
    pages > 1
      ? `<button type="button" data-page="${Math.max(0, dec.page - 1)}" aria-label="Página anterior">←</button>${Array.from({ length: pages }, (_, i) => `<button type="button" data-page="${i}" ${i === dec.page ? 'aria-current="true"' : ''}>${i + 1}</button>`).join('')}<button type="button" data-page="${Math.min(pages - 1, dec.page + 1)}" aria-label="Página siguiente">→</button><span style="color:var(--muted);font-size:14px;margin-left:8px">${list.length} decisiones</span>`
      : `<span style="color:var(--muted);font-size:14px">${list.length} decisiones</span>`;
}
const dlg = $('#dlg');
function openDecision(id) {
  const d = decById[id];
  if (!d) return;
  dlg.className = d.phase !== null ? `ph${d.phase}` : '';
  dlg.innerHTML = `<div class="dlg-body"><button class="btn icon dlg-close" type="button" data-x aria-label="Cerrar">✕</button>
    <span class="chip">${d.id} · ${d.date ? dLong(d.date) : ''} · ${d.status}</span>
    <h2 id="dlg-title">${esc(d.title)}</h2>
    ${d.context ? `<h3>Contexto</h3>${d.context}` : ''}
    <h3>Qué se decidió</h3>${d.decision}
    ${d.alternatives.length ? `<h3>Alternativas descartadas</h3><ul>${d.alternatives.map((a) => `<li>${a}</li>`).join('')}</ul>` : ''}
    ${d.consequences ? `<h3>Consecuencias</h3>${d.consequences}` : ''}
    ${d.citedBy.length ? `<h3>Pasos que la citan</h3><div class="next">${d.citedBy.map((s) => `<a class="chip ph${stepById[s]?.phase ?? 8}" href="${stepHref(s)}">${esc(s)} · ${esc(stepById[s]?.title || '')}</a>`).join('')}</div>` : ''}
  </div>`;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  $('.dlg-body', dlg).scrollTop = 0;
}
dlg.addEventListener('click', (e) => {
  if (e.target === dlg || e.target.closest('[data-x]')) dlg.close();
  else if (e.target.closest('a[href^="#camino"]')) dlg.close();
});
dlg.addEventListener('close', () => {
  if (activeView === 'decisiones') history.replaceState(null, '', '#decisiones');
});

// ---------------------------------------------------------------- Guion
const quotes = D.steps.flatMap((s) => s.quotes.map((q, k) => ({ q, s, key: `${s.id}#${k}` })));
const favs = new Set(store.get('diary-favs', []));
const gui = { i: 0, only: false };
const gList = () => (gui.only ? quotes.filter((x) => favs.has(x.key)) : quotes);
function renderGuion() {
  $('#v-guion').innerHTML =
    `<div class="gtool"><p class="lead" style="margin:0"><b>${quotes.length} frases para contar,</b> sacadas de las bitácoras en orden. Marca con ★ las que vas a usar en la defensa.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="seg" role="group" aria-label="Qué frases"><button type="button" data-only="0" aria-pressed="true">Todas</button><button type="button" data-only="1" aria-pressed="false">Solo ★ <span class="favn"></span></button></span><button class="btn" type="button" data-full>⛶ Ensayar a pantalla completa</button></div></div>
    <div class="gstage"></div>
    <div><div class="gbar"></div><div class="gnav" style="margin-top:10px"><button class="btn icon" type="button" data-g="-1" aria-label="Anterior">←</button><span class="gcount"></span><button class="btn icon" type="button" data-g="1" aria-label="Siguiente">→</button></div></div>`;
  $('#v-guion').addEventListener('click', (e) => {
    const g = e.target.closest('[data-g]');
    const o = e.target.closest('[data-only]');
    const bar = e.target.closest('[data-gi]');
    if (g) gShow(gui.i + +g.dataset.g);
    else if (bar) gShow(+bar.dataset.gi);
    else if (o) {
      gui.only = o.dataset.only === '1';
      for (const b of $$('[data-only]')) b.setAttribute('aria-pressed', String(b === o));
      gShow(0);
    } else if (e.target.closest('[data-star]')) toggleFav();
    else if (e.target.closest('[data-full]')) $('.gstage').requestFullscreen?.();
  });
  gShow(0);
}
function toggleFav() {
  const x = gList()[gui.i];
  if (!x) return;
  favs.has(x.key) ? favs.delete(x.key) : favs.add(x.key);
  store.set('diary-favs', [...favs]);
  gShow(gui.i);
}
function gShow(i) {
  const list = gList();
  $('.favn').textContent = `(${favs.size})`;
  const stage = $('.gstage');
  if (!list.length) {
    stage.className = 'gstage';
    stage.innerHTML =
      '<div class="slide"><blockquote>Aún no has marcado ninguna frase.</blockquote><p class="who">Vuelve a «Todas» y pulsa ★ en las que quieras contar.</p></div>';
    $('.gbar').innerHTML = '';
    $('.gcount').textContent = '0 / 0';
    return;
  }
  gui.i = (i + list.length) % list.length;
  const x = list[gui.i];
  stage.className = `gstage ph${x.s.phase}`;
  stage.innerHTML = `<div class="slide"><blockquote>${x.q}</blockquote><div class="who"><span class="chip">${PHASE[x.s.phase].icon} ${esc(PHASE[x.s.phase].short)}</span><a href="${stepHref(x.s.id)}">Paso ${esc(x.s.id)} · ${esc(x.s.title)}</a><span>${dShort(x.s.date)}</span><button class="btn star" type="button" data-star aria-pressed="${favs.has(x.key)}" aria-label="Marcar para la defensa">${favs.has(x.key) ? '★' : '☆'}</button></div></div>`;
  $('.gbar').innerHTML = list
    .map(
      (q, k) =>
        `<button type="button" class="ph${q.s.phase}${favs.has(q.key) ? ' fav' : ''}" data-gi="${k}" ${k === gui.i ? 'aria-current="true"' : ''} aria-label="Frase ${k + 1}"></button>`,
    )
    .join('');
  $('.gcount').textContent = `${gui.i + 1} / ${list.length}`;
}

// ---------------------------------------------------------------- keyboard + boot
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || dlg.open || e.altKey || e.ctrlKey || e.metaKey)
    return;
  const k = e.key;
  if (activeView === 'camino') {
    if (k === 'ArrowRight' || k === 'ArrowDown') select(sel + 1, { focus: true });
    else if (k === 'ArrowLeft' || k === 'ArrowUp') select(sel - 1, { focus: true });
    else if (k === 'Home') select(0, { focus: true });
    else if (k === 'End') select(items.length - 1, { focus: true });
    else return;
    e.preventDefault();
  } else if (activeView === 'guion') {
    if (k === 'ArrowRight' || k === ' ') gShow(gui.i + 1);
    else if (k === 'ArrowLeft') gShow(gui.i - 1);
    else if (k.toLowerCase() === 'f') toggleFav();
    else return;
    e.preventDefault();
  } else if (activeView === 'pantallas') {
    if (k === 'ArrowRight') setVersion(scr.vi + 1);
    else if (k === 'ArrowLeft') setVersion(scr.vi - 1);
    else return;
    e.preventDefault();
  }
});
const RENDER = {
  camino: renderCamino,
  cifras: renderCifras,
  pantallas: renderPantallas,
  decisiones: renderDecisiones,
  guion: renderGuion,
};
const ARG = {
  camino: (arg) => {
    if (arg && indexOfStep[arg] !== undefined && sel !== indexOfStep[arg])
      select(indexOfStep[arg], { open: true });
  },
  pantallas: (arg) => {
    const [key, step] = (arg || '').split('/');
    showScreen(key || scr.key, step);
  },
  decisiones: (arg) => {
    requestAnimationFrame(drawDecisions);
    if (arg) openDecision(arg);
  },
};
route();
