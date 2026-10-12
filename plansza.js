// Kable na planie 6 – strona interaktywna (szablon; kopiowany do wynik/html/ przez eksport_html.py).
// Dane: window.PLANSZA z dane.js – PW, PH (rozmiar planszy, pt), plan [x0, y0, x1, y1] (prostokąt rzutu), podkład:
// obrazy [{k, src, x, y, w, h}] (PNG w kilku wielkościach, k – px na pt; rysowany ten, który pasuje do przybliżenia)
// albo podklad [{g, d, k, w}] (ścieżki SVG: k – kolor kreski, k = null – maska na biało, w – grubość),
// kable {wpis: {n, c, t, j, z, b, karta: {t, l}}} (nazwa, kolor linii, kolor tekstu, blady kolor tła,
// skąd → dokąd, boksy z tym kablem, karta: tytuł i linijki).
// Plansza (kable, odnośniki, boksy) – SVG w index.html.
'use strict';
(function () {
  const {PW, PH, podklad, obrazy: OBRAZY = [], kable: DANE} = window.PLANSZA;
  const scena = document.getElementById('scena'), pod = document.getElementById('pod'), ctx = pod.getContext('2d');
  const svg = document.getElementById('svg'), swiat = document.getElementById('swiat');
  const warstwaKabli = document.getElementById('kable');
  const sciezki = podklad.map(g => ({...g, p: new Path2D(g.d)}));
  const obrazy = OBRAZY.map(o => {           // podkład jako obrazki (PNG, od najmniejszego)
    const img = new Image(); img.onload = () => odswiez(false); img.src = o.src;
    return {...o, img};
  }).sort((a, b) => a.k - b.k);
  function obrazDla(potrzeba) {              // najmniejszy wczytany obrazek z co najmniej tyloma px na pt
    let best = null;
    for (const o of obrazy) {
      if (!(o.img.complete && o.img.naturalWidth)) continue;
      best = o;
      if (o.k >= potrzeba) break;
    }
    return best;
  }
  let v = {s: 1, tx: 0, ty: 0};            // ekran = świat · s + t
  let W = 0, H = 0, dpr = 1;

  // ---------- podkład: pełne rysowanie, a w trakcie ruchu – szybko ze zdjęcia ostatniego widoku ----------
  const zdj = document.createElement('canvas'), zctx = zdj.getContext('2d');
  let zdjV = null, czasomierz = null;
  function rozmiar() {
    dpr = window.devicePixelRatio || 1; W = scena.clientWidth; H = scena.clientHeight;
    pod.width = zdj.width = Math.round(W * dpr); pod.height = zdj.height = Math.round(H * dpr);
  }
  function rysujPelny() {
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, pod.width, pod.height);
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
    const o = obrazDla(v.s * dpr);
    if (o) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const g of sciezki) {
      if (g.k === null) { ctx.fillStyle = '#fff'; ctx.fill(g.p); }
      else { ctx.strokeStyle = g.k; ctx.lineWidth = g.w; ctx.stroke(g.p); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    zctx.setTransform(1, 0, 0, 1, 0, 0); zctx.clearRect(0, 0, zdj.width, zdj.height); zctx.drawImage(pod, 0, 0);
    zdjV = {...v};
    window.PLANSZA.czasRysowania = performance.now() - t0;
  }
  function rysujSzybki() {
    if (!zdjV) return rysujPelny();
    const k = v.s / zdjV.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, pod.width, pod.height);
    ctx.setTransform(k, 0, 0, k, dpr * (v.tx - zdjV.tx * k), dpr * (v.ty - zdjV.ty * k));
    ctx.drawImage(zdj, 0, 0);
  }
  // grubość świecenia kabla i sygnału: px ekranu × gr – rośnie z przybliżeniem, ale wolniej (pierwiastek): przy małym
  // przybliżeniu cieńsze, w dużym trochę grubsze (do GR.max); gr = 1 przy s = GR.s (--gr w plansza.css)
  const GR = {s: 2.5, min: .3, max: 1.3};
  let gr = 0;
  function grubosc() {
    const x = Math.min(GR.max, Math.max(GR.min, Math.sqrt(v.s / GR.s)));
    if (Math.abs(x / gr - 1) < .01) return;
    gr = x; warstwaKabli.style.setProperty('--gr', gr.toFixed(3));
  }
  function odswiez(szybko) {
    swiat.setAttribute('transform', `matrix(${v.s} 0 0 ${v.s} ${v.tx} ${v.ty})`);
    grubosc();
    if (szybko) {
      rysujSzybki();
      clearTimeout(czasomierz); czasomierz = setTimeout(rysujPelny, 140);
    } else rysujPelny();
  }
  function calosc() {                        // cała plansza z marginesem
    const s = Math.min((W - 40) / PW, (H - 40) / PH);
    v = {s, tx: (W - PW * s) / 2, ty: (H - PH * s) / 2};
    odswiez(false);
  }

  // ---------- zoom kółkiem (wokół kursora), przesuwanie środkowym albo lewym przyciskiem ----------
  scena.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
    const s = Math.min(Math.max(v.s * k, 0.05), 80);
    const r = scena.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    v = {s, tx: mx - (mx - v.tx) * s / v.s, ty: my - (my - v.ty) * s / v.s};
    odswiez(true);
  }, {passive: false});
  let ruch = null, ostatniSrodkowy = 0;
  scena.addEventListener('mousedown', e => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();                       // środkowy: bez autoprzewijania przeglądarki
    if (e.button === 1) {                     // dwuklik środkowym – całość (jak w CAD)
      const t = performance.now();
      if (t - ostatniSrodkowy < 350) { calosc(); ostatniSrodkowy = 0; return; }
      ostatniSrodkowy = t;
    }
    ruch = {x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false};
  });
  window.addEventListener('mousemove', e => {
    if (!ruch) return;
    const dx = e.clientX - ruch.x, dy = e.clientY - ruch.y;
    if (!ruch.moved && Math.hypot(dx, dy) < 3) return;
    ruch.moved = true; scena.classList.add('przesuw');
    v = {...v, tx: ruch.tx + dx, ty: ruch.ty + dy};
    odswiez(true);
  });
  let poRuchu = false;                        // kliknięcie po przeciągnięciu – nie przypina
  window.addEventListener('mouseup', () => {
    poRuchu = !!(ruch && ruch.moved); ruch = null; scena.classList.remove('przesuw');
  });
  scena.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F' || e.key === 'Home') calosc();
    if (e.key === 'Escape') odepnij();
  });
  window.addEventListener('resize', () => { rozmiar(); odswiez(false); });

  // ---------- podświetlanie kabla: rzut (grubo, świecenie), boksy (szare tło), nazwy (tło w kolorze kabla) ----------
  const grupy = {}, pozycje = {}, boksy = {}, odnosniki = {};
  for (const g of document.querySelectorAll('.kabel')) grupy[g.dataset.w] = g;
  for (const p of document.querySelectorAll('.poz')) (pozycje[p.dataset.w] ||= []).push(p);
  for (const b of document.querySelectorAll('.box')) boksy[b.dataset.kod] = b;
  for (const o of document.querySelectorAll('.odnosnik')) odnosniki[o.dataset.kod] = o;
  const pasek = document.getElementById('kabel');
  let akt = null;
  function ustaw(w) {
    if (w === akt) return;
    if (akt) {
      grupy[akt]?.classList.remove('hl');
      for (const p of pozycje[akt] || []) p.classList.remove('on');
      for (const kod of DANE[akt]?.b || []) {
        boksy[kod]?.classList.remove('on');
        odnosniki[kod]?.classList.remove('on');
      }
    }
    akt = w;
    const g = w ? grupy[w] : null;
    if (g && g !== warstwaKabli.lastElementChild) {   // na wierzch – zanim reszta przygaśnie, a on się zapali (płynnie)
      warstwaKabli.appendChild(g); void g.getBoundingClientRect();
    }
    svg.classList.toggle('dim', !!w);
    sygnal(w);
    if (!w) { if (pasek) pasek.style.display = 'none'; return; }
    if (DANE[w]) svg.style.setProperty('--jasny', DANE[w].j);
    g?.classList.add('hl');
    for (const p of pozycje[w] || []) p.classList.add('on');
    for (const kod of DANE[w]?.b || []) {         // boksy z tym kablem (i ich odnośniki) – reszta przygaszona
      boksy[kod]?.classList.add('on');
      odnosniki[kod]?.classList.add('on');
    }
    const d = DANE[w];
    if (d && pasek) {                         // pasek z nazwą kabla – wyłączony (brak #kabel w index.html)
      pasek.querySelector('i').style.background = d.c;
      pasek.querySelector('b').textContent = d.n;
      pasek.querySelector('span').textContent = d.z;
      pasek.style.display = 'block';
    }
  }
  svg.addEventListener('pointermove', e => {
    if ((ruch && ruch.moved) || przypiety) return;
    const el = e.target.closest('[data-w]');
    ustaw(el ? el.dataset.w : null);
  });
  svg.addEventListener('pointerleave', () => { if (!przypiety) ustaw(null); });

  // ---------- sygnał na podświetlonym kablu (najechanie albo przypięcie) – jakby płynął prąd: biały świecący punkt
  // biegnie po linii od początku do końca (skąd → dokąd) z gasnącym ogonem, na końcu błyska i gaśnie; chwila przerwy
  // i znowu. Poświata biała, ku brzegom przezroczysta. Rozmiary w px ekranu × gr (jak świecenie kabla – przy małym
  // przybliżeniu mniejsze), jądro nie węższe niż linia kabla (duże przybliżenie); czas przebiegu (0,28–1,3 s) rośnie
  // wolniej niż długość kabla (krótki i długi – podobnie żwawo) ----------
  const SYG = {przerwa: 700, blysk: 380, wejscie: 70, slad: 48,
               glowa: [22, 3],               // promień głowy (px, gr = 1): biała poświata, białe jądro
               profil: .33,                  // poświata: krycie jak rozkład Gaussa (σ – część promienia), na brzegu 0
               ogon: [6, 1.5, .6],           // ogon – miękkie białe punkty: promień przy głowie i na końcu (px), krycie
               ogonDl: [60, 150]};           // długość ogona (px, gr = 1): zwykle i najwięcej (szybki ruch)
  const iskry = {}, aktywne = new Map();     // wpis -> sygnał; rysowane: podświetlony i gasnące (do końca przygasania)
  let klatka = 0;
  function iskra(w) {                        // punkty linii kabla i elementy sygnału – przy pierwszym podświetleniu
    if (iskry[w]) return iskry[w];
    const g = grupy[w], lin = g.querySelector('.linia');
    const pts = [], dl = [], odc = [];       // punkty (pt planszy), odległość od początku linii, początki odcinków
    const t = lin.getAttribute('d').match(/[Ml]|-?[\d.]+/g);
    for (let i = 0, c = 'M'; i < t.length;) {
      if (t[i] === 'M' || t[i] === 'l') { c = t[i++]; continue; }
      const a = +t[i++], b = +t[i++], p = pts[pts.length - 1], d = dl.length ? dl[dl.length - 1] : 0;
      if (c === 'M') { odc.push(d); pts.push([a, b]); dl.push(d); }
      else { pts.push([p[0] + a, p[1] + b]); dl.push(d + Math.hypot(a, b)); }
    }
    if (!document.getElementById('iskra')) {          // poświata – jeden gradient dla wszystkich sygnałów
      const d = document.createElementNS(svg.namespaceURI, 'defs');
      const g2 = x => Math.exp(-.5 * (x / SYG.profil) ** 2), op = x => (g2(x) - g2(1)) / (1 - g2(1));
      d.innerHTML = '<radialGradient id="iskra">' + Array.from({length: 11}, (_, i) =>
        `<stop offset="${i / 10}" stop-opacity="${f3(op(i / 10))}"/>`).join('') + '</radialGradient>';
      svg.prepend(d);
    }
    const el = document.createElementNS(svg.namespaceURI, 'g');
    el.setAttribute('class', 'sygnal');
    el.innerHTML = '<g>' + '<circle fill="url(#iskra)"/>'.repeat(SYG.slad + 1) + '<circle class="jadro"/></g>';
    g.appendChild(el);
    const L = dl[dl.length - 1], cz = el.firstElementChild, kola = [...cz.children];
    return (iskry[w] = {pts, dl, odc, L, T: Math.min(1300, Math.max(275, 175 + 25 * Math.sqrt(L))), cz,
                        szer: +lin.getAttribute('stroke-width') || 0, glowy: kola.slice(-2), slad: kola.slice(0, -2)});
  }
  function punkt(s, d) {                     // punkt linii w odległości d od początku
    const {pts, dl} = s;
    let a = 0, b = dl.length - 1;
    if (d >= dl[b]) return pts[b];
    while (b - a > 1) { const m = (a + b) >> 1; if (dl[m] <= d) a = m; else b = m; }
    const k = (d - dl[a]) / (dl[b] - dl[a]);
    return [pts[a][0] + (pts[b][0] - pts[a][0]) * k, pts[a][1] + (pts[b][1] - pts[a][1]) * k];
  }
  const f3 = x => x.toFixed(3);
  function kolo(c, P, r, op) {
    c.setAttribute('cx', f3(P[0])); c.setAttribute('cy', f3(P[1])); c.setAttribute('r', f3(r));
    if (op !== undefined) c.setAttribute('opacity', f3(op));
  }
  function rysujIskre(s, t) {
    const {L, T} = s, u = Math.max(0, t - s.t0) % (T + SYG.blysk + SYG.przerwa);
    if (u > T + SYG.blysk) { s.cz.setAttribute('display', 'none'); return; }       // przerwa
    s.cz.removeAttribute('display');
    const k = v.s, droga = L * u / T, dg = Math.min(L, droga);                         // dg – głowa
    const pocz = s.odc.reduce((p, o) => o <= dg ? o : p, 0);                           // początek jej odcinka
    const j = u < T ? Math.min(1, u / SYG.wejscie) : 1 - (u - T) / SYG.blysk;         // zapala się / gaśnie
    const roz = u < T ? 1 : 1 + .8 * (u - T) / SYG.blysk;                              // błysk na końcu
    s.cz.setAttribute('opacity', f3(j * j * (3 - 2 * j)));
    const G = punkt(s, dg), [rp, rj] = SYG.glowa, p = gr / k;                          // px ekranu → pt planszy
    const jr = Math.max(rj * p, .5 * s.szer);                                           // jądro – promień (pt)
    kolo(s.glowy[0], G, Math.max(rp * p, 4 * jr) * roz);
    kolo(s.glowy[1], G, jr);
    // ogon: miękkie punkty za głową, coraz mniejsze i bledsze – gęsto (co ~2,5 px · gr), zlewają się w smugę
    const [r0, r1, a] = SYG.ogon;
    const og = Math.min(.4 * L * k, Math.max(SYG.ogonDl[0] * gr, Math.min(SYG.ogonDl[1] * gr, L / T * 90 * k)));  // px
    const n = Math.min(s.slad.length, Math.max(4, Math.round(og / (2.5 * gr))));
    s.slad.forEach((c, i) => {
      const f = (i + 1) / n, d = droga - og / k * f;
      if (i >= n || d > dg || d < pocz) { c.setAttribute('r', 0); return; }
      kolo(c, punkt(s, d), (r0 + (r1 - r0) * f) * p, a * (1 - f) * (1 - f));
    });
  }
  function klatkaSygnalu(t) {
    klatka = 0;
    for (const [w, s] of aktywne) {
      if (s.zgas && t - s.zgas > 450) aktywne.delete(w);      // zgasł razem ze świeceniem kabla (--t-off)
      else rysujIskre(s, t);
    }
    if (aktywne.size) klatka = requestAnimationFrame(klatkaSygnalu);
  }
  function sygnal(w) {                       // z ustaw(): podświetlony kabel – sygnał od początku, poprzedni gaśnie
    const t = performance.now();
    for (const [x, s] of aktywne) if (x !== w && !s.zgas) s.zgas = t;
    if (w && grupy[w]) {
      const s = iskra(w);
      s.t0 = t; s.zgas = 0; aktywne.set(w, s);
    }
    if (!klatka && aktywne.size) klatka = requestAnimationFrame(klatkaSygnalu);
  }

  // ---------- dymek z nazwą kabla (jak podpowiedź w CAD): kursor zatrzymany na kablu na rzucie – po chwili;
  // ruch myszą (więcej niż drgnięcie), kółko albo przycisk – znika ----------
  const dymek = document.createElement('div');
  dymek.id = 'dymek';
  document.body.appendChild(dymek);
  let dymekCzas = null, dymekXY = null;
  function ukryjDymek() { clearTimeout(dymekCzas); dymek.style.display = 'none'; dymekXY = null; }
  function pokazDymek(t, x, y) {
    dymek.textContent = t;
    dymek.style.display = 'block';
    const r = dymek.getBoundingClientRect();
    dymek.style.left = Math.max(4, Math.min(x + 12, window.innerWidth - r.width - 6)) + 'px';
    dymek.style.top = (y + 20 + r.height > window.innerHeight ? y - 8 - r.height : y + 20) + 'px';
    dymekXY = [x, y];
  }
  svg.addEventListener('pointermove', e => {
    if (dymekXY && Math.hypot(e.clientX - dymekXY[0], e.clientY - dymekXY[1]) < 3) return;   // drgnięcie – zostaje
    ukryjDymek();
    if (ruch || e.buttons) return;
    const g = e.target.closest('.kabel'), x = e.clientX, y = e.clientY;
    if (g && DANE[g.dataset.w]) dymekCzas = setTimeout(() => pokazDymek(DANE[g.dataset.w].n, x, y), 450);
  });
  svg.addEventListener('pointerleave', ukryjDymek);
  scena.addEventListener('wheel', ukryjDymek, {passive: true});
  scena.addEventListener('mousedown', ukryjDymek);

  // ---------- kliknięcie: przypięcie kabla (zostaje podświetlony) i karta kabla ----------
  // Karta – w stylu boksów planszy (ramka, tytuł z kreską pod spodem, krój ISOCPEUR, tło – blady kolor kabla), na stałe
  // w lewym dolnym rogu ekranu: nie przesuwa się ani nie skaluje z planszą (przesuwanie i zoom działają też nad nią);
  // znika po odpięciu – klik obok albo w ten sam kabel, Esc.
  const karta = document.createElement('div');
  karta.id = 'karta';
  scena.appendChild(karta);
  let przypiety = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  function pokazKarte(w) {
    const d = DANE[w], c = d?.karta;
    if (!c) { usunKarte(); return; }
    karta.style.background = d.j;
    karta.innerHTML = `<div class="tytul">${esc(c.t)}</div>` + c.l.map(t => `<div>${esc(t)}</div>`).join('');
    karta.classList.add('widoczna');
  }
  function usunKarte() { karta.classList.remove('widoczna'); }
  function odepnij() { przypiety = null; usunKarte(); ustaw(null); }
  svg.addEventListener('click', e => {
    if (poRuchu) { poRuchu = false; return; }
    const el = e.target.closest('[data-w]'), w = el ? el.dataset.w : null;
    if (!w || w === przypiety) { odepnij(); return; }
    przypiety = null; ustaw(w); przypiety = w;
    pokazKarte(w);
  });

  rozmiar();
  calosc();
  const gotowe = performance.now();          // od początku wczytywania strony
  if (document.fonts) document.fonts.ready.then(() => odswiez(false));

  // test (bez myszy): index.html#kabel=<wpis>&zoom=<s>&x=<pt>&y=<pt> – podświetlenie i widok na punkt planszy
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('zoom')) {
    const s = +h.get('zoom'), x = +(h.get('x') || PW / 2), y = +(h.get('y') || PH / 2);
    v = {s, tx: W / 2 - x * s, ty: H / 2 - y * s}; odswiez(false);
  }
  if (h.get('kabel')) ustaw(h.get('kabel'));
  if (h.get('karta')) {                      // test: przypięcie i karta kabla
    const w = h.get('karta');
    ustaw(w); przypiety = w; pokazKarte(w);
  }
  if (h.has('pomiar')) {                     // czas pełnego rysowania podkładu (ms) – w tytule strony
    const t = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now(); rysujPelny();
      try { ctx.getImageData(0, 0, 1, 1); } catch (e) { /* obrazek z dysku – płótno „skażone”, bez odczytu */ }
      t.push(performance.now() - t0);
    }
    document.title = 'pomiar ' + t.map(x => x.toFixed(0)).join(' ') + ' | gotowe po ' + gotowe.toFixed(0) + ' ms';
  }
  window.PLANSZA.ustaw = ustaw;
}());
