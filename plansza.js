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
  const przytnij = s => Math.min(Math.max(s, 0.05), 80);   // granice przybliżenia (kółko, palce)
  let vCalosc = null;                        // widok z calosc() – dopóki v to ten sam obiekt, nikt widoku nie ruszył
  function calosc(plynnie) {                 // cała plansza z marginesem, obok wcięć ekranu (padding #scena – telefon)
    const c = getComputedStyle(scena), l = parseFloat(c.paddingLeft) || 0, p = parseFloat(c.paddingRight) || 0,
          g = parseFloat(c.paddingTop) || 0, d = parseFloat(c.paddingBottom) || 0;
    const s = Math.min((W - 40 - l - p) / PW, (H - 40 - g - d) / PH);
    vCalosc = {s, tx: l + (W - l - p - PW * s) / 2, ty: g + (H - g - d - PH * s) / 2};
    if (plynnie) przejdz(vCalosc); else { v = vCalosc; odswiez(false); }
  }
  // płynne przejście do widoku cel (dotyk: dwa stuknięcia, „Całość”): zoom wokół punktu, który w obu widokach jest
  // w tym samym miejscu ekranu (ta sama skala – sam przesuw), z wyhamowaniem; inna zmiana widoku (palec, kółko, mysz,
  // klawisz) – koniec przejścia
  let anim = 0;
  function przejdz(cel, czas = 250) {
    cancelAnimationFrame(anim);
    const a = v, k = cel.s / a.s, t0 = performance.now();
    let ost = a;
    anim = requestAnimationFrame(function krok(t) {
      if (v !== ost) { anim = 0; return; }
      const u = Math.min(1, Math.max(0, (t - t0) / czas)), e = 1 - (1 - u) ** 3;
      const s = a.s * k ** e, f = Math.abs(k - 1) < 1e-6 ? e : (1 - k ** e) / (1 - k);
      v = ost = u < 1 ? {s, tx: a.tx + (cel.tx - a.tx) * f, ty: a.ty + (cel.ty - a.ty) * f} : cel;
      odswiez(true);
      anim = u < 1 ? requestAnimationFrame(krok) : 0;
    });
  }

  // ---------- zoom kółkiem (wokół kursora), przesuwanie środkowym albo lewym przyciskiem ----------
  scena.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
    const s = przytnij(v.s * k);
    const r = scena.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    v = {s, tx: mx - (mx - v.tx) * s / v.s, ty: my - (my - v.ty) * s / v.s};
    odswiez(true);
  }, {passive: false});
  let ruch = null, ostatniSrodkowy = 0;
  scena.addEventListener('mousedown', e => {
    if ((e.button !== 0 && e.button !== 1) || poDotyku()) return;   // mysz udawana po dotyku palcem – pomijana
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
  window.addEventListener('resize', () => {  // telefon, tablet (obrót): cała plansza zostaje cała, a inny widok – z tym
    const w0 = W, h0 = H;                    // samym punktem planszy w środku ekranu; komputer – jak dotąd
    rozmiar();
    if (matchMedia('(pointer: coarse)').matches) {
      if (v === vCalosc) return calosc();
      v = {...v, tx: v.tx + (W - w0) / 2, ty: v.ty + (H - h0) / 2};
    }
    odswiez(false);
  });

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
    if ((ruch && ruch.moved) || przypiety || e.pointerType === 'touch') return;   // palec – bez podświetlania pod nim
    const el = e.target.closest('[data-w]');
    ustaw(el ? el.dataset.w : null);
  });
  svg.addEventListener('pointerleave', e => { if (!przypiety && e.pointerType !== 'touch') ustaw(null); });

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
  // ruch myszą (więcej niż drgnięcie), kółko albo przycisk – znika; palec – bez dymka (nazwa w karcie) ----------
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
    if (ruch || e.buttons || e.pointerType === 'touch') return;
    const g = e.target.closest('.kabel'), x = e.clientX, y = e.clientY;
    if (g && DANE[g.dataset.w]) dymekCzas = setTimeout(() => pokazDymek(DANE[g.dataset.w].n, x, y), 450);
  });
  svg.addEventListener('pointerleave', ukryjDymek);
  scena.addEventListener('wheel', ukryjDymek, {passive: true});
  scena.addEventListener('mousedown', ukryjDymek);

  // ---------- kliknięcie: przypięcie kabla (zostaje podświetlony) i karta kabla ----------
  // Karta – w stylu boksów planszy (ramka, tytuł z kreską pod spodem, krój ISOCPEUR, tło – blady kolor kabla), na stałe
  // w lewym dolnym rogu ekranu: nie przesuwa się ani nie skaluje z planszą (przesuwanie i zoom działają też nad nią);
  // znika po odpięciu – klik obok albo w ten sam kabel, Esc (palec: stuknięcie obok, w ten sam kabel albo w kartę).
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
  function przypnij(w) {                     // kliknięcie (stuknięcie) w kabel albo nazwę – przypięcie i karta; obok
    if (!w || w === przypiety) { odepnij(); return; }   // albo w ten sam – odpięcie
    przypiety = null; ustaw(w); przypiety = w;
    pokazKarte(w);
  }
  svg.addEventListener('click', e => {
    if (poRuchu) { poRuchu = false; return; }
    if (poDotyku()) return;                  // kliknięcie udawane po dotyku palcem – stuknięcie obsłużone niżej
    const el = e.target.closest('[data-w]');
    przypnij(el ? el.dataset.w : null);
  });

  // ---------- dotyk (telefon, tablet): jeden palec – przesuwanie, dwa – zoom wokół środka między palcami razem
  // z przesuwaniem (trzeci i dalsze – pomijane; palec dołożony albo podniesiony – bez skoku). Stuknięcie – jak
  // kliknięcie, także trochę obok kabla albo nazwy (palec gruby, linie cienkie – wygrywa linia najbliżej palca, nie
  // wierzchnia), ale po chwili (DOTYK.dwa – może będzie drugie): dwa stuknięcia – przybliżenie bez przypinania,
  // stuknięcie dwoma palcami – oddalenie, w kartę – odpięcie (telefon nie ma Esc). Przesuwanie i szczypanie nie
  // przypinają; bez podświetlania pod palcem i dymka. Mysz i pióro – jak dotąd (mousedown, click) ----------
  const DOTYK = {prog: 10, dwa: 300, dwaOdl: 40, dwaPalce: 400, zasieg: 20};   // px ekranu, ms
  const palce = new Map();                   // pointerId -> {x, y, x0, y0} (px w scenie), w kolejności dotknięcia
  let gest = null, stuk = null, ostatniDotyk = -1e9, klatkaWidoku = 0, rs = null;   // rs – położenie sceny
  function poDotyku() {                      // palce na ekranie albo przed chwilą: mysz udawana przez przeglądarkę
    return palce.size > 0 || performance.now() - ostatniDotyk < 800;
  }
  function kotwica() {                       // zmiana liczby palców: dalszy ruch od bieżącego widoku – bez skoku
    const [a, b = a] = palce.values();
    gest.od = {v, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y)};
  }
  function widokPalcami() {                  // punkt planszy spod środka dwóch pierwszych palców idzie za nim,
    const [a, b = a] = palce.values(), o = gest.od, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;   // rozstaw – zoom
    const k = o.d ? Math.hypot(b.x - a.x, b.y - a.y) / o.d : 1, s = o.d ? przytnij(o.v.s * k) : o.v.s;
    v = {s, tx: x - (o.x - o.v.tx) * s / o.v.s, ty: y - (o.y - o.v.ty) * s / o.v.s};
    if (s !== o.v.s * k) kotwica();          // granica przybliżenia: zsuwanie od razu oddala (bez martwej strefy)
    klatkaWidoku ||= requestAnimationFrame(() => { klatkaWidoku = 0; odswiez(true); });   // rysowanie raz na klatkę
  }
  function pojedyncze() {                    // stuknięcie sprzed tego dotyku – jednak pojedyncze: wykonane teraz
    if (gest.drugi) { gest.drugi.akcja(); gest.drugi = null; }
  }
  function ruszyl() { gest.ruch = true; pojedyncze(); }   // przesunięcie, szczypanie, przerwanie – nie stuknięcie
  function ruchPalca(p, e) {                 // palec przesunięty: jeden – po progu (plansza go dogania), dwa – od razu
    p.x = e.clientX - rs.left; p.y = e.clientY - rs.top;
    if (!gest.ruch && Math.hypot(p.x - p.x0, p.y - p.y0) > DOTYK.prog) ruszyl();
    if (gest.ruch || palce.size > 1) widokPalcami();
  }
  scena.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();                      // bez udawanej myszy (mousedown, mouseup) i zaznaczania
    ostatniDotyk = performance.now(); ukryjDymek();
    if (e.isPrimary || !gest) {              // pierwszy palec – nowy gest (palce zgubione w poprzednim – zapomniane)
      if (gest) pojedyncze();
      palce.clear(); cancelAnimationFrame(anim); rs = scena.getBoundingClientRect();
      gest = {t0: ostatniDotyk, cel: e.target, x0: e.clientX - rs.left, y0: e.clientY - rs.top, n: 0, ruch: false};
      const s = stuk;                        // stuknięcie przed chwilą: to drugie (blisko, na planszy) albo co innego
      if (s) {
        stuk = null; clearTimeout(s.czas);
        if (svg.contains(e.target) && Math.hypot(gest.x0 - s.x, gest.y0 - s.y) < DOTYK.dwaOdl) gest.drugi = s;
        else s.akcja();
      }
    }
    const x = e.clientX - rs.left, y = e.clientY - rs.top;
    palce.set(e.pointerId, {x, y, x0: x, y0: y});
    gest.n = Math.max(gest.n, palce.size);
    kotwica();
    if (palce.size > 1) pojedyncze();        // drugi palec – stuknięcie sprzed niego było pojedyncze
    if (palce.size === 2) gest.m = [gest.od.x, gest.od.y];   // stuknięcie dwoma palcami – oddalenie wokół środka
  });
  window.addEventListener('pointermove', e => {
    const p = palce.get(e.pointerId);
    if (p && e.pointerType === 'touch') ruchPalca(p, e);
  });
  function puszczony(e) {
    const p = palce.get(e.pointerId);
    if (!p || e.pointerType !== 'touch') return;
    ostatniDotyk = performance.now();
    if (e.type === 'pointerup') ruchPalca(p, e);
    else ruszyl();                           // pointercancel (dotyk zabrany): nie stuknięcie, położenie bywa zerowe
    palce.delete(e.pointerId);
    if (palce.size) kotwica();               // zostały palce – dalej od bieżącego widoku, bez skoku
    else koniec();
  }
  window.addEventListener('pointerup', puszczony);
  window.addEventListener('pointercancel', puszczony);
  function koniec() {                        // ostatni palec podniesiony: co to było
    const g = gest; gest = null;
    if (g.ruch) return;
    if (g.n === 2 && performance.now() - g.t0 < DOTYK.dwaPalce) { przybliz(g.m[0], g.m[1], .5); return; }
    if (g.n !== 1) return;
    if (karta.contains(g.cel)) { odepnij(); return; }   // stuknięcie w kartę – odpięcie
    if (!svg.contains(g.cel)) return;
    if (g.drugi) { przybliz(g.x0, g.y0, 2); return; }   // dwa stuknięcia – przybliżenie, bez przypinania
    const w = najblizszy(g.x0, g.y0, g.cel), s = stuk = {x: g.x0, y: g.y0, akcja: () => przypnij(w)};
    s.czas = setTimeout(() => { if (stuk === s) stuk = null; s.akcja(); }, DOTYK.dwa);   // po chwili (może drugie)
  }
  function przybliz(x, y, k) {               // płynnie: przybliżenie (k > 1) albo oddalenie wokół punktu ekranu
    const s = przytnij(v.s * k);
    przejdz({s, tx: x - (x - v.tx) * s / v.s, ty: y - (y - v.ty) * s / v.s});
  }
  // stuknięcie obok: najbliższy kabel albo nazwa w zasięgu DOTYK.zasieg px ekranu; na boksie – tylko nazwy z niego
  // (kable pod boksem są zasłonięte)
  let linie = null;                          // wpis -> łamane kabla [[x, y, x, y, …], …] (pt planszy)
  function najblizszy(x, y, cel) {
    if (!linie) {
      linie = {};
      for (const w in grupy) {
        const t = grupy[w].querySelector('.linia').getAttribute('d').match(/[Ml]|-?[\d.]+/g), L = linie[w] = [];
        for (let i = 0, c = 'M', p; i < t.length;) {
          if (t[i] === 'M' || t[i] === 'l') { c = t[i++]; continue; }
          const a = +t[i++], b = +t[i++];
          if (c === 'M') L.push(p = [a, b]); else p.push(p[p.length - 2] + a, p[p.length - 1] + b);
        }
      }
    }
    const px = (x - v.tx) / v.s, py = (y - v.ty) / v.s, boks = cel.closest('.box');
    let best = null, min = DOTYK.zasieg / v.s;   // pt planszy
    const blizej = (w, d) => { if (d < min) { min = d; best = w; } };
    if (!boks) for (const w in linie) for (const L of linie[w]) for (let i = 2; i < L.length; i += 2) {
      const ax = L[i - 2], ay = L[i - 1], dx = L[i] - ax, dy = L[i + 1] - ay, l = dx * dx + dy * dy;
      const k = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
      blizej(w, Math.hypot(px - ax - k * dx, py - ay - k * dy));
    }
    for (const r of (boks || svg).querySelectorAll('.poz .tlo')) {
      const [rx, ry, rw, rh] = ['x', 'y', 'width', 'height'].map(a => +r.getAttribute(a));
      const d = Math.hypot(Math.max(rx - px, 0, px - rx - rw), Math.max(ry - py, 0, py - ry - rh));
      blizej(r.parentNode.dataset.w, d);
    }
    return best;
  }
  // palec: bez kliknięcia, zdarzeń myszy, menu i zaznaczania po dotyku (pióro – jak dotąd, jego kliknięcie zostaje);
  // iOS: dwa palce – bez zoomu całej strony
  scena.addEventListener('touchstart', e => { if (palce.size) e.preventDefault(); }, {passive: false});
  scena.addEventListener('contextmenu', e => { if (poDotyku()) e.preventDefault(); });   // przytrzymanie – bez menu
  for (const t of ['gesturestart', 'gesturechange'])
    document.addEventListener(t, e => { if (palce.size) e.preventDefault(); });
  // przycisk „Całość” – na ekranie dotykowym (plansza.css): nie ma klawisza F ani środkowego przycisku myszy
  const przycisk = document.createElement('button');
  przycisk.id = 'calosc'; przycisk.type = 'button'; przycisk.textContent = 'Całość'; przycisk.title = 'Cała plansza';
  przycisk.addEventListener('click', () => calosc(true));
  przycisk.addEventListener('touchstart', () => {}, {passive: true});   // iOS: bez nasłuchu nie ma stanu :active
  document.body.appendChild(przycisk);

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
