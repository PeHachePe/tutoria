// ======================= Láminas: the deck, built from the curated SLIDES =======================
const T = D.totals;
const deck = $('#deck');
const E = D.elusion;
const sumTally = (pre) =>
  Object.entries(E.tally)
    .filter(([k]) => k.startsWith(pre))
    .reduce((a, [, v]) => a + v, 0);
const VARS = {
  desde: dShort(T.from),
  hasta: dShort(T.to),
  pasos: T.planSteps,
  decisiones: T.decisions,
  tests: fmt(T.unit),
  e2e: T.e2e,
  capturas: T.manualShots,
  dias: T.days,
  horas_autor: fmt(T.human),
  horas_claude: fmt(T.claude),
  coste: fmt(T.usd),
  resiste: E.tally['ataque:resiste'] || 0,
  ataques: sumTally('ataque'),
  ayuda: E.tally['control:ayuda'] || 0,
  controles: sumTally('control'),
  trucos: E.attackCases,
};
const fill = (s) => esc(s).replace(/\{(\w+)\}/g, (_, k) => VARS[k] ?? `{${k}}`);
const blobs = (n = 2) =>
  Array.from(
    { length: n },
    (_, k) =>
      `<span class="blob" style="width:${26 + k * 14}vw;aspect-ratio:1;${k % 2 ? 'left:-8vw;bottom:-14vw' : 'right:-6vw;top:-12vw'};opacity:${0.55 - k * 0.15}" aria-hidden="true"></span>`,
  ).join('');
const head = (s, i = 0) =>
  `${s.kicker ? `<p class="kicker in" style="--i:${i}">${fill(s.kicker)}</p>` : ''}<h2 class="in" style="--i:${i + 1}">${fill(s.title)}</h2>`;
const points = (s, from = 2) =>
  `<ul class="points">${(s.points || []).map((p, k) => `<li class="in" style="--i:${from + k}">${fill(p)}</li>`).join('')}</ul>`;
const lastOf = (key) => {
  const sc = D.screens.find((x) => x.key === key);
  return sc ? { sc, v: sc.versions.at(-1) } : null;
};
const STAT = {
  tests: [T.unit, 'tests unitarios'],
  e2e: [T.e2e, 'pruebas de extremo a extremo'],
  capturas: [T.manualShots, 'capturas en el manual'],
};

function visual(v) {
  if (!v) return '';
  if (v.shot) {
    const s = lastOf(v.shot);
    if (!s) return '';
    return `<button type="button" class="browser in shot" style="--i:3" data-lb="${s.sc.key}" aria-label="Ver ${esc(s.sc.name)} en grande"><span class="bar"><i></i><i></i><i></i><span>${esc(s.sc.name)}</span></span><img src="${IMG[`${s.sc.key}/${s.v.step}/d`]}" alt="${esc(s.sc.name)}"></button>`;
  }
  if (v.icon) return `<div class="big-emoji in" style="--i:3" aria-hidden="true">${v.icon}</div>`;
  if (v.prompts) return `<div class="in pt-box" style="--i:3">${promptTimeline()}</div>`;
  if (v.stats)
    return `<div class="statcol">${v.stats.map((k, i) => `<div class="in" style="--i:${3 + i}"><b data-count="${STAT[k][0]}">0</b><span>${STAT[k][1]}</span></div>`).join('')}</div>`;
  return '';
}

const RENDER = {
  cover: (s) => `<section class="sheet center ph-bg ph${s.phase}">${blobs()}
    <img class="cover-pug in" src="${IMG.pug}" alt="La carlina, mascota de TutorIA" style="--i:0">
    <p class="kicker in" style="--i:1;--c:var(--muted)">Trabajo Fin de Máster · ${VARS.desde} – ${VARS.hasta} de 2026</p>
    <h1 class="in" style="--i:2">Tutor<span class="hl">IA</span></h1>
    <p class="sub in" style="--i:3">${fill(s.sub)}</p>
    <div class="stats">${[
      [T.planSteps, 'pasos'],
      [T.days, 'días'],
      [T.unit, 'tests unitarios'],
      [T.e2e, 'pruebas e2e'],
      [T.decisions, 'decisiones'],
    ]
      .map(
        ([v, l], i) =>
          `<div class="ph${[0, 1, 5, 2, 4][i]}"><div class="in" style="--i:${4 + i}"><span class="num" data-count="${v}">0</span><span class="lbl">${l}</span></div></div>`,
      )
      .join('')}</div>
  </section>`,

  points: (s) => `<section class="sheet split ph-bg ph${s.phase}">${blobs()}
    <div class="col-text">${head(s)}${points(s)}</div>
    <div class="col-visual">${visual(s.visual)}</div>
  </section>`,

  cards: (s) => `<section class="sheet stack ph-bg ph${s.phase}">${blobs(1)}
    ${head(s)}
    <div class="cards3">${[
      ['🎒', 'ph1'],
      ['🧑‍🏫', 'ph4'],
      ['🛠️', 'ph5'],
    ]
      .map(([ico, ph], i) => {
        const p = D.profiles[i] || { name: '', text: '' };
        return `<div class="in ${ph}" style="--i:${2 + i}"><span class="ico">${ico}</span><h3 style="color:var(--c)">${esc(p.name)}</h3><p>${p.text.charAt(0).toUpperCase() + p.text.slice(1)}</p></div>`;
      })
      .join('')}</div>
    <div class="rule in" style="--i:5"><span style="font-size:30px" aria-hidden="true">🛡️</span> ${fill(s.rule)}</div>
  </section>`,

  ring: (s) => {
    const ring = (r, frac, color) => {
      const c = 2 * Math.PI * r;
      return `<circle r="${r}" cx="100" cy="100" fill="none" stroke="var(--bg2)" stroke-width="20"/><circle class="anim" r="${r}" cx="100" cy="100" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="round" stroke-dasharray="0 ${c.toFixed(1)}" data-to="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 100 100)"/>`;
    };
    return `<section class="sheet stack ph-bg ph${s.phase}">${blobs()}
      ${head(s)}
      <div class="ring-wrap"><svg class="in" style="--i:2" viewBox="0 0 200 200" role="img" aria-label="${VARS.resiste} de ${VARS.ataques} intentos resistidos; ${VARS.ayuda} de ${VARS.controles} dudas con ayuda">${ring(86, VARS.resiste / VARS.ataques, 'var(--p4)')}${ring(58, VARS.ayuda / VARS.controles, 'var(--p5)')}<text x="100" y="98" text-anchor="middle" font-size="34" font-weight="800" fill="var(--ink)">${Math.round((VARS.resiste / VARS.ataques) * 100)} %</text><text x="100" y="122" text-anchor="middle" font-size="13" fill="var(--muted)">resiste</text></svg>
      <div>${points(s, 3)}</div></div>
      <div class="attacks in" style="--i:6">${E.cases
        .filter((c) => !/control/.test(c))
        .map((c) => `<span>${esc(c.replace(/^\w+ · /, ''))}</span>`)
        .join('')}</div>
    </section>`;
  },

  compare: (s) => {
    const sc = evolving.find((x) => x.key === compareKey);
    return `<section class="sheet ph-bg ph${s.phase} sheet-compare">${blobs(1)}
      <div class="cmp-side">${head(s)}
      <p class="hint in" style="--i:2">Elige una pantalla y arrastra la línea para comparar su primera versión con la última.</p>
      <div class="screen-pick in" role="group" aria-label="Elegir pantalla" style="--i:3">${evolving.map((x) => `<button type="button" data-cmp="${x.key}" aria-pressed="${x.key === compareKey}">${esc(x.name)} <small>${x.versions.length} versiones</small></button>`).join('')}</div></div>
      <div class="compare in" style="--i:3">${compareInner(sc)}</div>
    </section>`;
  },

  build: (s) => `<section class="sheet stack ph-bg ph${s.phase}">${blobs()}
    ${head(s)}
    <div class="duo">
      <div class="side in" style="--i:2"><h3>🧑‍💻 El autor</h3><ul><li><span>horas de trabajo</span><b data-count="${T.human}">0</b></li><li><span>pasos validados</span><b data-count="${T.planSteps}">0</b></li><li><span>commits</span><b data-count="${T.commits}">0</b></li></ul></div>
      <div class="mid in" style="--i:3"><div><b data-count="${T.decisions}">0</b><span class="lbl">decisiones</span></div><div style="background:var(--t4)"><b data-count="${T.problems}">0</b><span class="lbl">problemas resueltos</span></div></div>
      <div class="side in" style="--i:4"><h3>🤖 El agente</h3><ul><li><span>horas de trabajo</span><b data-count="${T.claude}">0</b></li><li><span>sesiones</span><b data-count="${T.tokens.sessions}">0</b></li><li><span>peticiones al modelo</span><b data-count="${T.tokens.requests}">0</b></li></ul></div>
    </div>
    ${points(s, 5)}
  </section>`,

  timeline: (s) => {
    const n = CAL.length;
    const rows = PHASE.filter((p) => p.i < 8 && p.from)
      .map((p, k) => {
        const a = CAL.indexOf(p.from),
          b = CAL.indexOf(p.to);
        const dots = D.steps
          .filter((x) => x.phase === p.i)
          .map(
            (x) =>
              `<i class="dot" style="left:${((CAL.indexOf(x.date) + 0.5) / n) * 100}%" title="${esc(x.id)}"></i>`,
          )
          .join('');
        return `<div class="grow ph${p.i} in" style="--i:${k + 2}"><span class="nm">${p.icon} <span>${esc(p.short)}</span></span><span class="lane"><span class="bar" style="--i:${k};left:${(a / n) * 100}%;width:${((b - a + 1) / n) * 100}%"></span>${dots}</span></div>`;
      })
      .join('');
    const kp = [
      [T.human, 'horas del autor'],
      [T.claude, 'horas del agente'],
      [T.commits, 'commits'],
      [T.usd, '$ a precio de la API'],
    ];
    return `<section class="sheet stack ph-bg ph${s.phase}">${blobs(1)}
      ${head(s)}
      <div class="gantt">${rows}<div class="gaxis"><span></span><div>${CAL.filter(
        (_, i) => i % 3 === 0 || i === n - 1,
      )
        .map((d) => `<span>${dShort(d)}</span>`)
        .join('')}</div></div></div>
      <div class="facts in" style="--i:11">${kp.map(([v, l]) => `<div><b data-count="${v}">0</b><span>${l}</span></div>`).join('')}</div>
    </section>`;
  },

  next: (s) => {
    const [pec3, pec4] = TEXT.milestones;
    const ms = (m, i) =>
      `<div class="milestone in" style="--i:${i}"><span class="flag" aria-hidden="true">🏁</span><div><b>Hito · ${esc(m.label)}</b><span>${dLong(m.date)}</span><p>${esc(m.text)}</p></div></div>`;
    return `<section class="sheet stack ph-bg ph${s.phase}">${blobs(1)}
      ${head(s)}
      <div class="road">
        ${ms(pec3, 2)}
        <div class="next2">${D.next.map((x, i) => `<div class="in" style="--i:${3 + i}"><b>${esc(x.id)}</b>${esc(x.title)}${x.est ? ` <small style="color:var(--muted)">≈ ${fmt(x.est)} h</small>` : ''}</div>`).join('')}</div>
        ${ms(pec4, 3 + D.next.length)}
      </div>
      <p class="hint in" style="--i:${4 + D.next.length}">Y ${D.pending.total} mejoras e ideas anotadas por el camino, que se resuelven o se descartan antes de la versión 1.0.</p>
    </section>`;
  },

  thanks: (s) => `<section class="sheet center ph-bg ph${s.phase}">${blobs()}
    <img class="cover-pug in" src="${IMG.pug}" alt="" style="--i:0">
    <h1 class="in" style="--i:1">${fill(s.title)}</h1>
    <p class="sub in" style="--i:2">${fill(s.sub)}</p>
  </section>`,
};
const AFTER = {
  ring: (el) => {
    const draw = () =>
      $$('circle.anim', el).forEach((c) => c.setAttribute('stroke-dasharray', c.dataset.to));
    // The delay lets the ring fill up on screen; printed, it is drawn at once.
    if (printing) draw();
    else setTimeout(draw, 250);
  },
  points: (el) => wirePromptTimeline(el),
  compare: (el) => wireCompare(el),
};

// Before/after, for any screen with more than one version.
const evolving = D.screens.filter((s) => s.versions.length > 1);
let compareKey = evolving.find((s) => s.key === '03-trabajo')?.key || evolving[0].key;
function compareInner(sc) {
  const a = sc.versions[0],
    b = sc.versions.at(-1);
  return `<div class="browser-bar"><i></i><i></i><i></i><span class="tag l">◀ Antes · ${esc(a.step)} · ${dShort(stepById[a.step].date)}</span><span class="bar-name">${esc(sc.name)}</span><span class="tag r">Ahora · ${esc(b.step)} · ${dShort(stepById[b.step].date)} ▶</span></div>
    <div class="compare-view"><img src="${IMG[`${sc.key}/${b.step}/d`]}" alt="${esc(sc.name)} en el paso ${esc(b.step)}"><img class="before" src="${IMG[`${sc.key}/${a.step}/d`]}" alt="${esc(sc.name)} en el paso ${esc(a.step)}"><span class="handle"></span>
    <input type="range" min="0" max="100" value="50" aria-label="Comparar la primera y la última versión de ${esc(sc.name)}"></div>`;
}
function wireCompare(el) {
  const box = $('.compare', el);
  const wire = () => {
    const view = $('.compare-view', box);
    const range = $('input', view);
    range.addEventListener('input', () => view.style.setProperty('--pos', `${range.value}%`));
    if (reduced) return;
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      view.style.setProperty('--pos', `${50 + 32 * Math.sin(t / 9)}%`);
      if (t > 56) {
        clearInterval(id);
        view.style.setProperty('--pos', '50%');
      }
    }, 30);
    range.addEventListener('pointerdown', () => clearInterval(id), { once: true });
  };
  wire();
  $('.screen-pick', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmp]');
    if (!b) return;
    compareKey = b.dataset.cmp;
    for (const x of $$('[data-cmp]', el)) x.setAttribute('aria-pressed', String(x === b));
    box.innerHTML = compareInner(evolving.find((s) => s.key === compareKey));
    wire();
  });
}

// Lightbox: one screen large, with its versions.
const lb = document.createElement('dialog');
lb.className = 'lightbox';
lb.setAttribute('aria-labelledby', 'lb-title');
document.body.append(lb);
const lbs = { key: null, vi: 0 };
function openLightbox(key, vi) {
  const sc = D.screens.find((s) => s.key === key);
  lbs.key = key;
  lbs.vi = (vi + sc.versions.length) % sc.versions.length;
  const v = sc.versions[lbs.vi];
  const s = stepById[v.step];
  lb.innerHTML = `<div class="lb-top"><h2 id="lb-title">${esc(sc.name)}</h2><span>${esc(v.step)} · ${esc(s?.title || '')} · ${s ? dLong(s.date) : ''}</span><button class="btn icon" type="button" data-lbx aria-label="Cerrar">✕</button></div>
    <div class="lb-img"><img src="${IMG[`${sc.key}/${v.step}/d`]}" alt="${esc(sc.name)} en el paso ${esc(v.step)}"></div>
    ${sc.versions.length > 1 ? `<div class="lb-nav"><button class="btn icon" type="button" data-lbgo="-1" aria-label="Versión anterior">←</button>${sc.versions.map((x, i) => `<button type="button" class="lb-v ph${stepById[x.step]?.phase ?? 8}" data-lbv="${i}" aria-current="${i === lbs.vi}">${esc(x.step)}</button>`).join('')}<button class="btn icon" type="button" data-lbgo="1" aria-label="Versión siguiente">→</button></div>` : ''}`;
  if (!lb.open) lb.showModal();
}
lb.addEventListener('click', (e) => {
  if (e.target === lb || e.target.closest('[data-lbx]')) return lb.close();
  const go = e.target.closest('[data-lbgo]');
  const v = e.target.closest('[data-lbv]');
  if (go) openLightbox(lbs.key, lbs.vi + +go.dataset.lbgo);
  else if (v) openLightbox(lbs.key, +v.dataset.lbv);
});
lb.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    e.stopPropagation();
    openLightbox(lbs.key, lbs.vi + (e.key === 'ArrowRight' ? 1 : -1));
  }
});
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-lb]');
  if (t)
    openLightbox(t.dataset.lb, D.screens.find((s) => s.key === t.dataset.lb).versions.length - 1);
});

// ---------------------------------------------------------------- navigation
const SHEETS = TEXT.slides.map((s) => ({
  ...s,
  html: () => RENDER[s.type](s),
  after: AFTER[s.type],
}));
const titleOf = (s) => (s.kicker ? fill(s.kicker) : fill(s.title));
let cur = -1;
let busy = false;
const dots = $('.dots');
dots.innerHTML = SHEETS.map(
  (s, i) =>
    `<button type="button" class="ph${s.phase}" data-to="${i}" aria-label="${i + 1}. ${titleOf(s)}"></button>`,
).join('');
const progress = document.createElement('div');
progress.className = 'progress';
document.body.append(progress);
const notes = document.createElement('aside');
notes.className = 'notes';
notes.hidden = true;
notes.setAttribute('aria-label', 'Notas del orador');
document.body.append(notes);
const renderNotes = () => {
  const s = SHEETS[cur];
  notes.innerHTML = `<b>Notas · ${cur + 1}. ${titleOf(s)}</b><ul>${(s.notes || []).map((n) => `<li>${fill(n)}</li>`).join('')}</ul>${SHEETS[cur + 1] ? `<small>Siguiente: ${titleOf(SHEETS[cur + 1])}</small>` : ''}`;
};
const toggleNotes = () => {
  notes.hidden = !notes.hidden;
  $('[data-notes]').setAttribute('aria-pressed', String(!notes.hidden));
  if (!notes.hidden) renderNotes();
};

function show(i, instant = false) {
  i = Math.max(0, Math.min(SHEETS.length - 1, i));
  if (i === cur || busy) return;
  const back = i < cur;
  const old = $('.sheet', deck);
  const wrap = document.createElement('div');
  wrap.innerHTML = SHEETS[i].html();
  const el = wrap.firstElementChild;
  el.setAttribute('aria-label', `${i + 1} de ${SHEETS.length}: ${titleOf(SHEETS[i])}`);
  if (!instant && !reduced) {
    el.classList.add('enter');
    if (back) el.classList.add('back');
  }
  deck.append(el);
  if (old) {
    if (instant || reduced) old.remove();
    else {
      busy = true;
      old.classList.add('leave');
      if (back) old.classList.add('back');
      setTimeout(() => {
        old.remove();
        busy = false;
      }, 380);
    }
  }
  cur = i;
  for (const b of $$('[data-count]', el)) countUp(b, +b.dataset.count);
  SHEETS[i].after?.(el);
  for (const b of $$('button', dots)) b.setAttribute('aria-current', String(+b.dataset.to === i));
  $(`[data-to="${i}"]`, dots).scrollIntoView({ inline: 'center', block: 'nearest' });
  $('.count').textContent = `${i + 1} / ${SHEETS.length}`;
  progress.style.width = `${((i + 1) / SHEETS.length) * 100}%`;
  history.replaceState(null, '', `#${i + 1}`);
  $('.prev').disabled = i === 0;
  $('.next').disabled = i === SHEETS.length - 1;
  if (!notes.hidden) renderNotes();
}
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  const to = e.target.closest('[data-to]');
  if (go) show(cur + +go.dataset.go);
  else if (to) {
    show(+to.dataset.to);
    if (toc.open) toc.close();
  } else if (e.target.closest('[data-index]')) openToc();
  else if (e.target.closest('[data-notes]')) toggleNotes();
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input') || e.altKey || e.ctrlKey || e.metaKey || lb.open) return;
  const k = e.key;
  if (toc.open && k !== 'i') return;
  if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') show(cur + 1);
  else if (k === 'ArrowLeft' || k === 'PageUp') show(cur - 1);
  else if (k === 'Home') show(0);
  else if (k === 'End') show(SHEETS.length - 1);
  else if (k.toLowerCase() === 'i') toc.open ? toc.close() : openToc();
  else if (k.toLowerCase() === 'n') toggleNotes();
  else return;
  e.preventDefault();
});
let sx = null;
deck.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('input, a, button')) sx = e.clientX;
});
deck.addEventListener('pointerup', (e) => {
  if (sx !== null && Math.abs(e.clientX - sx) > 60) show(cur + (e.clientX < sx ? 1 : -1));
  sx = null;
});
const toc = $('#toc');
function openToc() {
  toc.innerHTML = `<div class="toc"><h2 id="toc-title">Índice <button class="btn icon" type="button" data-close-toc aria-label="Cerrar">✕</button></h2><div class="toc-grid">${SHEETS.map((s, i) => `<a href="#${i + 1}" class="ph${s.phase}" data-to="${i}" ${i === cur ? 'aria-current="true"' : ''}><small>${String(i + 1).padStart(2, '0')}</small><b>${titleOf(s)}</b></a>`).join('')}</div></div>`;
  toc.showModal();
}
toc.addEventListener('click', (e) => {
  if (e.target === toc || e.target.closest('[data-close-toc]')) toc.close();
  if (e.target.closest('a')) e.preventDefault();
});
if (printing) {
  // The PDF: every sheet, one after another, one per page.
  for (const sheet of SHEETS) {
    const wrap = document.createElement('div');
    wrap.innerHTML = sheet.html();
    const el = wrap.firstElementChild;
    deck.append(el);
    for (const b of $$('[data-count]', el)) b.textContent = fmt(+b.dataset.count);
    sheet.after?.(el);
  }
  document.documentElement.dataset.ready = 'true';
} else {
  show(Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1), true);
}
