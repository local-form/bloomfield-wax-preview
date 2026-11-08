(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const AREAS = window.BW_AREAS || [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  // ---------- the figure: one smooth outline, drawn from the right half and mirrored ----------
  const W_RIGHT = [[100,10],[113,13],[121,24],[123,40],[119,56],[111,66],[110,78],[118,88],[134,93],[147,100],[153,114],[156,140],[159,170],[162,198],[167,228],[172,256],[177,272],[178,288],[172,300],[165,296],[162,282],[158,262],[151,232],[145,202],[140,172],[136,146],
    [134,170],[129,196],[132,220],[139,244],[141,270],[139,305],[134,340],[133,360],[134,384],[130,420],[124,446],[127,462],[122,472],[108,472],[106,458],[108,440],[107,410],[106,380],[106,350],[104,310],[101,282],[100,276]];
  const M_RIGHT = W_RIGHT.map(([x, y], i) => {
    if (i >= 8 && i <= 25) return [x + (i <= 9 ? 3 : 4), y];
    if (i === 26) return [135, y];
    if (i === 27) return [134, y];
    if (i === 28) return [134, y];
    if (i === 29) return [136, y];
    if (i === 30) return [138, y];
    return [x, y];
  });
  const full = right => right.concat(right.slice(1, -1).reverse().map(([x, y]) => [200 - x, y]));
  const smooth = pts => {           // closed Catmull-Rom -> cubic Bezier
    const n = pts.length, P = i => pts[(i + n) % n];
    let d = `M${P(0)[0]},${P(0)[1]}`;
    for (let i = 0; i < n; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), k = 6;
      d += `C${(p1[0] + (p2[0] - p0[0]) / k).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / k).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / k).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / k).toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d + 'Z';
  };
  const OUT = { w: smooth(full(W_RIGHT)), m: smooth(full(M_RIGHT)) };

  // zones are washed in, clipped to the outline. x is mirrored where noted.
  const R = (x, y, w, h) => ({ t: 'rect', a: { x, y, width: w, height: h } });
  const E = (cx, cy, rx, ry) => ({ t: 'ellipse', a: { cx, cy, rx, ry } });
  const P = pts => ({ t: 'polygon', a: { points: pts.map(p => p.join(',')).join(' ') } });
  const mir = sh => { const a = { ...sh.a };
    if (sh.t === 'rect') a.x = 200 - a.x - a.width; else if (sh.t === 'ellipse') a.cx = 200 - a.cx;
    else a.points = a.points.split(' ').map(p => { const [x, y] = p.split(','); return `${200 - x},${y}`; }).join(' ');
    return { t: sh.t, a }; };
  const both = sh => [sh, mir(sh)];
  const ZONES = {
    head: [E(100, 40, 28, 32)],
    pits: both(E(134, 132, 9, 13)),
    upperarms: both(P([[136, 92], [170, 100], [172, 200], [140, 204]])),
    lowerarms: both(P([[140, 200], [172, 196], [190, 268], [150, 270]])),
    arms: both(P([[136, 92], [170, 100], [190, 268], [150, 270]])),
    hands: both(P([[150, 262], [195, 262], [195, 305], [150, 305]])),
    chest: [R(60, 90, 80, 72)],
    stomach: [R(60, 160, 80, 72)],
    bikini: [P([[58, 228], [142, 228], [146, 262], [100, 296], [54, 262]])],
    thighs: [R(80, 270, 40, 66)],
    legs: [R(0, 262, 200, 220)],
    lowerlegs: [R(0, 346, 200, 136)],
    knees: [R(0, 338, 200, 36)],
    feet: [R(0, 440, 200, 40)],
    neck: [R(80, 58, 40, 36)],
    shoulders: both(E(130, 100, 22, 13)),
    back: [R(58, 90, 84, 146)],
    lowerback: [R(58, 168, 84, 68)],
    seat: [R(56, 232, 88, 62)]
  };
  const DETAILS = {
    front: ['M88,96 Q100,102 112,96', 'M100,226 L100,232'],
    back: ['M100,84 L100,232', 'M84,112 Q90,134 96,140', 'M116,112 Q110,134 104,140', 'M100,256 L100,282']
  };

  // ---------- state ----------
  const state = { menu: 'w', view: 'front', sugar: false, picks: new Map(), open: null };   // picks: optionKey -> {area, opt}
  const qs = new URLSearchParams(location.search);
  const priceOf = o => state.sugar ? (o.s ?? o.p) : (o.p ?? o.s);
  const isSugar = o => (state.sugar && o.s != null) || o.p == null;
  const optsOf = a => a[state.menu] || [];
  const money = n => '$' + n;

  const svg = $('#figure svg'), zonesG = $('#zones'), detailsG = $('#details'), pinsEl = $('#pins');
  function drawOutline() {
    const d = OUT[state.menu];
    ['#clip-path', '#body-fill', '#body-line'].forEach(s => $(s).setAttribute('d', d));
    detailsG.innerHTML = '';
    DETAILS[state.view].forEach(d => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); detailsG.appendChild(p); });
  }
  function drawZones() {
    zonesG.innerHTML = '';
    const lit = new Set();
    state.picks.forEach(({ area, opt }) => {
      const view = area.view === 'both' ? state.view : area.view;
      if (view !== state.view) return;
      lit.add(opt.zone || area.zone);
    });
    Object.entries(ZONES).forEach(([k, shapes]) => shapes.forEach(sh => {
      const el = document.createElementNS(NS, sh.t);
      Object.entries(sh.a).forEach(([a, v]) => el.setAttribute(a, v));
      el.dataset.z = k; zonesG.appendChild(el);
    }));
    requestAnimationFrame(() => $$('#zones > *').forEach(el => el.classList.toggle('lit', lit.has(el.dataset.z))));
  }
  function drawPins() {
    pinsEl.innerHTML = '';
    let i = 0;
    AREAS.forEach(area => {
      if (!optsOf(area).length) return;
      if (area.view !== 'both' && area.view !== state.view) return;
      const chosen = [...state.picks.values()].filter(p => p.area.id === area.id);
      area.pins.forEach(([x, y], pi) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pin' + (chosen.length ? ' on' : '');
        b.style.left = (x / 2) + '%'; b.style.top = (y / 5) + '%';
        b.style.setProperty('--pd', (i++ * .37 % 3.2).toFixed(2) + 's');
        b.setAttribute('aria-label', area.name + (chosen.length ? ': ' + chosen.map(c => c.opt.l).join(', ') : ''));
        if (pi > 0) b.tabIndex = -1;
        b.addEventListener('click', () => openPicker(area));
        pinsEl.appendChild(b);
        if (pi === 0 && chosen.length) {
          const t = document.createElement('span');
          const right = x >= 100;
          t.className = 'tag ' + (right ? 'r' : 'l');
          t.style.left = (x / 2) + '%'; t.style.top = (y / 5) + '%';
          const sum = chosen.reduce((s, c) => s + priceOf(c.opt), 0);
          t.innerHTML = `${chosen.length > 1 ? area.name : chosen[0].opt.l} <b>${money(sum)}</b>`;
          pinsEl.appendChild(t);
        }
      });
    });
  }

  // ---------- picker ----------
  const picker = $('#picker'), optsEl = $('#opts');
  function openPicker(area) {
    state.open = area;
    $('#picker-title').textContent = area.name;
    renderOpts();
    picker.hidden = false;
    if (matchMedia('(max-width:1079px)').matches) $('#plan').classList.add('away');
    $('#picker-close').focus({ preventScroll: true, focusVisible: false });
  }
  function closePicker() {
    if (!state.open) return;
    const id = state.open.id; state.open = null; picker.hidden = true;
    $('#plan').classList.remove('away');
    const pin = [...pinsEl.querySelectorAll('.pin')].find(b => b.getAttribute('aria-label').startsWith(AREAS.find(a => a.id === id).name));
    pin && pin.focus({ preventScroll: true });
  }
  function renderOpts() {
    const area = state.open; if (!area) return;
    optsEl.innerHTML = '';
    optsOf(area).forEach(o => {
      const key = area.id + ':' + o.id, on = state.picks.has(key);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt'; b.setAttribute('aria-pressed', on);
      const sugarNote = o.p == null ? 'Sugar wax only · ' : (state.sugar && o.s != null ? 'Sugar wax · ' : '');
      b.innerHTML = `<span class="box" aria-hidden="true"></span><span class="nm">${o.l}</span><span class="pr">${money(priceOf(o))}</span>
        <span class="meta">${sugarNote}about ${o.t} min typical${o.c ? '<br>' + o.c : ''}</span>`;
      b.addEventListener('click', () => toggle(area, o));
      optsEl.appendChild(b);
    });
  }
  function toggle(area, o) {
    const key = area.id + ':' + o.id;
    if (state.picks.has(key)) state.picks.delete(key);
    else {
      [...state.picks.entries()].forEach(([k, v]) => { if (v.area.id === area.id && v.opt.g === o.g) state.picks.delete(k); });
      state.picks.set(key, { area, opt: o });
    }
    refresh();
  }

  // ---------- plan ----------
  const TIPS = {
    grow: 'Let the hair grow to about 1/4 inch, roughly two weeks without shaving.',
    skip: 'Skip waxing over a sunburn or laser burn, or while you use Retin-A, Renova or Accutane.',
    face: 'For your face especially: no Retin-A or Renova before you come in.',
    ibu: 'An ibuprofen 30 minutes before may help with the discomfort.',
    period: 'On your period? You can still come in. Wear a clean tampon; you may be a little more sensitive.',
    preg: 'Pregnant? Yes, you can. Check with your doctor first.',
    after: 'Afterwards: no oils or creams except the homecare your specialist gives you, and no tanning for about 48 hours.',
    vaj: 'Ask about the Vajacial ($45), made to follow a Brazilian.'
  };
  function refresh() {
    const picks = [...state.picks.values()];
    const total = picks.reduce((s, p) => s + priceOf(p.opt), 0);
    const mins = picks.reduce((s, p) => s + p.opt.t, 0);
    const rounded = Math.max(5, Math.round(mins / 5) * 5);
    const timeTxt = mins ? (rounded >= 60 ? `about ${Math.floor(rounded / 60)} hr${rounded % 60 ? ' ' + (rounded % 60) + ' min' : ''}` : `about ${rounded} min`) : '';
    $('#tot-time').textContent = mins ? timeTxt.replace(/^a/, 'A') : 'Pick an area';
    $('#tot-price').textContent = picks.length ? money(total) : '';
    const list = $('#picks'); list.innerHTML = '';
    if (!picks.length) list.innerHTML = '<li class="empty">' + (state.menu === 'w'
      ? 'First time here? We\'re the home of the <strong>$35 Brazilian</strong>. Tap the dot at the bikini line to see what it covers.'
      : 'Tap a dot on the figure. Our men\'s menu runs from brows to the Manzilian.') + '</li>';
    picks.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${p.opt.l}${isSugar(p.opt) ? ' <span class="t">(sugar)</span>' : ''}<br><span class="t">about ${p.opt.t} min</span></span><span class="p">${money(priceOf(p.opt))}</span>`;
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove ' + p.opt.l);
      rm.addEventListener('click', () => { state.picks.delete(p.area.id + ':' + p.opt.id); refresh(); });
      li.appendChild(rm); list.appendChild(li);
    });
    // prep
    const ids = new Set(picks.map(p => p.area.id));
    const tips = [];
    if (picks.length) {
      tips.push(['grow', 0]);
      if (ids.has('bikini')) tips.push(['ibu', 1], ['period', 0], ['preg', 0]);
      tips.push([ids.has('face') ? 'face' : 'skip', ids.has('face') ? 1 : 0]);
      if (ids.has('face')) tips.push(['skip', 0]);
      tips.push(['after', 0]);
      if ([...state.picks.keys()].includes('bikini:brazilian')) tips.push(['vaj', 0]);
    }
    $('#prep').hidden = !tips.length;
    const li = ([k, key]) => `<li${key ? ' class="k"' : ''}>${TIPS[k]}</li>`;
    $('#prep-list').innerHTML = tips.slice(0, 3).map(li).join('');
    $('#prep-more').hidden = tips.length <= 3;
    $('#prep-more ul').innerHTML = tips.slice(3).map(li).join('');
    // bar
    $('#bar-sum').textContent = picks.length ? picks.map(p => p.opt.l).join(' + ') : 'Nothing picked yet';
    $('#bar-sub').textContent = picks.length ? `${timeTxt} · ${money(total)} before tip` : 'Tap a dot on the figure';
    $('#hint').classList.toggle('gone', picks.length > 0);
    drawZones(); drawPins(); renderOpts();
    document.dispatchEvent(new CustomEvent('bw:plan', { detail: { picks, total, timeTxt, menu: state.menu } }));
  }
  window.BW_PLAN = () => {
    const picks = [...state.picks.values()];
    return { picks, total: picks.reduce((s, p) => s + priceOf(p.opt), 0), menu: state.menu, sugar: state.sugar,
      text: picks.map(p => p.opt.l + (isSugar(p.opt) ? ' (sugar)' : '')).join(' + ') };
  };

  // ---------- controls ----------
  $$('[data-menu]').forEach(b => b.addEventListener('click', () => {
    if (state.menu === b.dataset.menu) return;
    state.menu = b.dataset.menu; state.picks.clear(); closePicker();
    $$('[data-menu]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    drawOutline(); refresh();
  }));
  const fig = $('#figure');
  function setView(v) {
    if (state.view === v) return;
    $$('[data-view]').forEach(x => { const on = x.dataset.view === v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    closePicker();
    const swap = () => { state.view = v; drawOutline(); drawZones(); drawPins(); };
    if (reduce) return swap();
    fig.classList.remove('turned-in'); fig.classList.add('turning');
    setTimeout(() => { swap(); fig.classList.add('turned-in'); fig.classList.remove('turning'); }, 320);
  }
  $$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#sugar').addEventListener('change', e => { state.sugar = e.target.checked; refresh(); });
  $('#picker-close').addEventListener('click', closePicker);
  $('#picker-done').addEventListener('click', closePicker);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePicker(); setSheet(false); } });
  const plan = $('#plan'), barBtn = $('#bar-open');
  function setSheet(open) {
    plan.classList.toggle('open', open); barBtn.setAttribute('aria-expanded', open);
    barBtn.textContent = open ? 'Close' : 'Your plan';
    document.documentElement.classList.toggle('sheet-open', open && matchMedia('(max-width:1079px)').matches);
  }
  barBtn.addEventListener('click', () => setSheet(!plan.classList.contains('open')));
  $('#to-book').addEventListener('click', () => setSheet(false));

  // today's hours (from their site; Google agrees)
  const HOURS = ['Sun 10am–4pm', 'Mon 9am–8pm', 'Tue 9am–8pm', 'Wed 9am–8pm', 'Thu 9am–8pm', 'Fri 9am–8pm', 'Sat 8am–6pm'];
  const day = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
  $('#today-hours').textContent = HOURS[day].replace(/^\w+ /, '');

  // ?plan=bikini:brazilian,underarm:underarm opens with a plan (for pitching)
  const preset = (attr, val) => $$(`[data-${attr}]`).forEach(x => { const on = x.dataset[attr] === val; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
  if (qs.get('view') === 'back') { state.view = 'back'; preset('view', 'back'); }
  if (qs.get('menu') === 'm') { state.menu = 'm'; preset('menu', 'm'); }
  drawOutline();
  (qs.get('plan') || '').split(',').filter(Boolean).forEach(k => {
    const [aid, oid] = k.split(/[:.]/); const area = AREAS.find(a => a.id === aid);
    const o = area && optsOf(area).find(x => x.id === (oid || aid)); if (o) state.picks.set(area.id + ':' + o.id, { area, opt: o });
  });
  refresh();
  if (qs.get('sheet') === '1') setSheet(true);
  if (qs.get('pick')) { const a = AREAS.find(x => x.id === qs.get('pick')); a && openPicker(a); }
})();

// ---------- the rest of the page ----------
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

  // menu tabs (arrow keys move between them)
  const tabs = $$('[role=tab]');
  const pick = t => { tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }); };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      const n = tabs[(i + d + tabs.length) % tabs.length]; pick(n); n.focus(); e.preventDefault();
    });
  });

  // today's row in the hours table (New York time)
  const day = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
  $$('.hours tr').forEach(r => r.classList.toggle('today', r.dataset.d.split(',').includes(String(day))));

  // the request form, fed by the planner
  const form = $('#form'), done = $('#done'), svcText = $('#svc-text');
  const showPlan = () => {
    const p = window.BW_PLAN ? window.BW_PLAN() : { picks: [] };
    svcText.textContent = p.picks.length ? `${p.text} · $${p.total} before tip` : 'Nothing picked yet. Tap the figure at the top, or tell us below.';
  };
  document.addEventListener('bw:plan', showPlan); showPlan();
  const d = new Date(), iso = x => new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  $('#day').min = iso(d);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form); let ok = true;
    ['name', 'phone'].forEach(n => { const el = form.elements[n], bad = !String(f.get(n) || '').trim() || (n === 'phone' && String(f.get(n)).replace(/\D/g, '').length < 10);
      el.classList.toggle('bad', bad); el.setAttribute('aria-invalid', bad); if (bad && ok) { el.focus(); ok = false; } });
    if (!ok) return;
    const p = window.BW_PLAN ? window.BW_PLAN() : { picks: [] };
    const what = p.picks.length ? p.text : 'An appointment';
    let when = String(f.get('time')).toLowerCase();
    if (f.get('day')) { const dt = new Date(f.get('day') + 'T12:00'); when = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + (when === 'any time' ? '' : ' ' + when); }
    $('#done-title').textContent = `${what}, ${when}, for ${String(f.get('name')).trim()}`;
    const bits = [f.get('first') === 'First visit' ? 'First visit' : 'Returning guest'];
    if (p.picks.length) bits.push(`$${p.total} before tip`);
    if (String(f.get('who') || '').trim()) bits.push('with ' + String(f.get('who')).trim());
    $('#done-sub').textContent = bits.join(' · ') + '. We call to confirm 24–48 hours before.';
    form.hidden = true; done.hidden = false; done.focus();
  });
  $('#again').addEventListener('click', () => { form.reset(); done.hidden = true; form.hidden = false; showPlan(); form.elements.name.focus(); });

  // the docked plan bar steps aside at the form and the footer (phones)
  const plan = $('#plan');
  if ('IntersectionObserver' in window) {
    // steps aside at the form and footer, and after the hero when nothing is picked yet
    const seen = new Set(), hero = $('.hero'); let inHero = true;
    const upd = () => { const empty = !(window.BW_PLAN && window.BW_PLAN().picks.length); plan.classList.toggle('gone', seen.size > 0 || (!inHero && empty)); };
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.target === hero) inHero = e.isIntersecting; else e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); }); upd(); }, { threshold: 0.05 });
    [$('#book'), $('.foot'), hero].forEach(el => io.observe(el));
    document.addEventListener('bw:plan', upd);
  }

  // reveal on scroll (PREVIEW-STANDARD)
  const els = $$('[data-reveal]');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-visible')); return; }
  const n = new Map();
  els.forEach(e => { const p = e.parentElement, i = n.get(p) || 0; e.style.setProperty('--d', i * .08 + 's'); n.set(p, i + 1); });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }), { threshold: .01, rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('is-visible'); }), 1500);
})();

// ---------- phone menu ----------
(() => {
  const btn = document.getElementById('nav-btn'), nav = document.getElementById('nav'), root = document.documentElement;
  if (!btn || !nav) return;
  const set = open => { root.classList.toggle('nav-open', open); btn.setAttribute('aria-expanded', open); };
  btn.addEventListener('click', () => set(!root.classList.contains('nav-open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('nav-open')) { set(false); btn.focus(); } });
  document.addEventListener('click', e => { if (root.classList.contains('nav-open') && !e.target.closest('.top')) set(false); });
  matchMedia('(min-width:1080px)').addEventListener('change', e => { if (e.matches) set(false); });
})();
