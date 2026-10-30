/* site-i18n.js — landing sayfalarının dili (index.html, giris.html, kayit.html).
 *
 * Eski sitedeki yöntemin devamı: sayfa Türkçe yazılır, başka dil seçilince görünen
 * metin düğümleri ve öznitelikler (aria-label, placeholder, alt, title) TR→hedef dil
 * sözlüğüyle değiştirilir; asıllar saklanır, Türkçeye dönüş sayfa yenilemeden olur.
 *
 * (2026-10-30) 10 DİL (uygulamayla aynı: tr en de nl fr es it pt az ar). Sözlükler:
 *   assets/site-en.js → window.SITE_EN (anahtar: sayfadaki Türkçe metin)
 *   assets/site-<dil>.js → window.SITE_DIL[dil] (aynı anahtarlar). Bir dilde eksik metin İngilizceye, o da yoksa Türkçeye düşer.
 *   Seçili dilin sözlüğü sayfa ayrıştırılırken eşzamanlı yüklenir (metin bir an Türkçe görünmesin), sonradan seçilirse
 *   script öğesiyle.
 * - İlk dil (Emir, 2026-10-30): ?lang=<dil> → kayıtlı seçim (localStorage 'siteLang'; yasal sayfalar da bunu okur) →
 *   tarayıcı dilleri (navigator.languages, telefonda telefonun dili) içinde ilk desteklenen → saat diliminden ülke tahmini
 *   → İngilizce. IP kullanılmaz: ziyaretçi bilgisi dışarı gitmez, onay bandı gerekmez.
 * - Dil seçici: sayfadaki .lang / .lang-s grupları açılır listeye çevrilir (10 düğme sığmaz).
 * - JS'in çalışırken yazdığı metinler için window.t('Türkçe') kullanılır; dil değişince 'dil-degisti' olayı yayılır,
 *   sayfalar kendi etiketlerini yeniden çizer.
 * - Türkçe dışındaki dilde sonradan eklenen düğümler de (MutationObserver) çevrilir.
 * - data-noi18n işaretli öğelerin içine dokunulmaz (ör. Do-Re-Mi nota adları). Arapçada sayfa sağdan sola.
 */
(function () {
  var DILLER = { tr: 'Türkçe', en: 'English', de: 'Deutsch', nl: 'Nederlands', fr: 'Français', es: 'Español',
                 it: 'Italiano', pt: 'Português', az: 'Azərbaycanca', ar: 'العربية' };
  var KOK = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^\/]*$/, '') : 'assets/'; })();
  window.SITE_DIL = window.SITE_DIL || {};
  function sozluk(d) {
    if (d === 'en') return window.SITE_EN || window.SITE_DIL.en || {};
    return window.SITE_DIL[d] || null;
  }
  function karsilik(d, k) {
    var s = sozluk(d); if (s && s[k] != null) return s[k];
    var en = window.SITE_EN || {}; if (en[k] != null) return en[k];
    return null;
  }
  var ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
  var asilMetin = new Map();          // metin düğümü → Türkçe asıl
  var asilOz = new Map();             // öğe → {öznitelik: Türkçe asıl}
  var dil = 'tr', izleyici = null;

  function anahtar(s) { return s.replace(/\s+/g, ' ').trim(); }
  function atla(el) { return !el || /^(SCRIPT|STYLE|NOSCRIPT|SELECT|OPTION)$/.test(el.nodeName) || (el.closest && el.closest('[data-noi18n]')); }

  function metniCevir(n) {
    if (atla(n.parentNode)) return;
    var asil = asilMetin.has(n) ? asilMetin.get(n) : n.nodeValue;
    var t = anahtar(asil); if (!t) return;
    var v = karsilik(dil, t); if (v == null) return;
    if (!asilMetin.has(n)) asilMetin.set(n, n.nodeValue);
    var bas = asil.match(/^\s*/)[0], son = asil.match(/\s*$/)[0];
    n.nodeValue = bas + v + son;
  }
  function ozCevir(el) {
    if (atla(el)) return;
    ATTRS.forEach(function (a) {
      var kayit = asilOz.get(el) || {};
      var v = (a in kayit) ? kayit[a] : el.getAttribute(a); if (!v) return;
      var c = karsilik(dil, anahtar(v)); if (c == null) return;
      if (!(a in kayit)) { kayit[a] = v; asilOz.set(el, kayit); }
      el.setAttribute(a, c);
    });
  }
  function agaciCevir(kok) {
    if (kok.nodeType === 3) { metniCevir(kok); return; }
    if (kok.nodeType !== 1 || atla(kok)) return;
    var w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) metniCevir(n);
    ozCevir(kok);
    kok.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach(ozCevir);
  }
  function geriAl() {
    asilMetin.forEach(function (eski, n) { n.nodeValue = eski; }); asilMetin.clear();
    asilOz.forEach(function (k, el) { for (var a in k) el.setAttribute(a, k[a]); }); asilOz.clear();
  }
  // Sekme başlığı da sözlükten (anahtar sayfanın Türkçe <title>'ı); eskiden İngilizcede bile Türkçe kalıyordu.
  var asilBaslik = null;
  function basligiCevir() {
    if (asilBaslik === null) asilBaslik = document.title;
    if (dil === 'tr') { document.title = asilBaslik; return; }
    var v = karsilik(dil, anahtar(asilBaslik));
    // Tamamı sözlükte yoksa " | " ile ayrılmış parçalar tek tek ("Giriş Yap | Repertuvar.app")
    if (v == null) v = asilBaslik.split(' | ').map(function (p) { var c = karsilik(dil, anahtar(p)); return c != null ? c : p; }).join(' | ');
    document.title = v;
  }
  function isaretle() {
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      var on = b.getAttribute('data-lang') === dil;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('select.dil-sec').forEach(function (s) { s.value = dil; });
  }

  // Sözlüğü yükle: sayfa hâlâ ayrıştırılıyorsa eşzamanlı (document.write), değilse script öğesiyle.
  function yukle(d, bitince) {
    if (d === 'tr' || sozluk(d)) { bitince(); return; }
    var src = KOK + 'site-' + d + '.js';
    if (document.readyState === 'loading') { document.write('<script src="' + src + '"><\/script>'); bitince(); return; }
    var s = document.createElement('script'); s.src = src;
    s.onload = s.onerror = function () { bitince(); };
    (document.head || document.documentElement).appendChild(s);
  }

  window.t = function (tr) { if (dil === 'tr') return tr; var v = karsilik(dil, tr); return v != null ? v : tr; };
  function uygula(hedef) {
    dil = window.siteLang = hedef;
    document.documentElement.lang = hedef;
    document.documentElement.dir = hedef === 'ar' ? 'rtl' : 'ltr';
    if (izleyici) { izleyici.disconnect(); izleyici = null; }
    geriAl();
    if (dil !== 'tr') {
      agaciCevir(document.body);
      izleyici = new MutationObserver(function (ml) {
        ml.forEach(function (m) {
          if (m.type === 'attributes') { if (ATTRS.indexOf(m.attributeName) > -1) { var k = asilOz.get(m.target); if (!k || !(m.attributeName in k) || karsilik(dil, anahtar(m.target.getAttribute(m.attributeName) || '')) != null) ozCevir(m.target); } return; }
          m.addedNodes.forEach(agaciCevir);
        });
      });
      izleyici.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    }
    basligiCevir();
    isaretle();
    window.dispatchEvent(new CustomEvent('dil-degisti', { detail: dil }));
  }
  window.setSiteLang = function (hedef, kaydet) {
    if (!DILLER[hedef]) return;
    if (kaydet !== false) { try { localStorage.setItem('siteLang', hedef); } catch (e) {} }
    if (hedef === dil) { isaretle(); return; }
    yukle(hedef, function () { uygula(hedef); });
  };
  window.siteLang = 'tr';
  window.SITE_DILLER = DILLER;

  // Saat diliminden ülke → dil (yalnız tarayıcı dili desteklenmiyorsa; ör. Rusça tarayıcı İstanbul'da → Türkçe).
  var SAAT = {
    'Europe/Istanbul': 'tr', 'Asia/Istanbul': 'tr', 'Europe/Nicosia': 'tr', 'Asia/Baku': 'az',
    'Europe/Amsterdam': 'nl', 'Europe/Berlin': 'de', 'Europe/Vienna': 'de', 'Europe/Zurich': 'de', 'Europe/Busingen': 'de',
    'Europe/Paris': 'fr', 'Europe/Luxembourg': 'fr', 'Europe/Monaco': 'fr', 'Europe/Madrid': 'es', 'Atlantic/Canary': 'es',
    'Europe/Rome': 'it', 'Europe/Lisbon': 'pt', 'Atlantic/Madeira': 'pt', 'Atlantic/Azores': 'pt'
  };
  function saatDili() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (SAAT[tz]) return SAAT[tz];
      if (/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha)$/.test(tz)) return 'pt';
      if (/^America\/(Mexico_City|Monterrey|Bogota|Lima|Santiago|Caracas|Guayaquil|La_Paz|Asuncion|Montevideo|Argentina\/.+|Guatemala|Costa_Rica|Panama|Havana|Santo_Domingo|El_Salvador|Tegucigalpa|Managua)$/.test(tz)) return 'es';
      if (/^(Asia\/(Riyadh|Dubai|Qatar|Kuwait|Bahrain|Muscat|Baghdad|Amman|Beirut|Damascus|Aden|Gaza|Hebron)|Africa\/(Cairo|Algiers|Tunis|Tripoli|Casablanca|Khartoum))$/.test(tz)) return 'ar';
    } catch (e) {}
    return null;
  }
  function ilkDil() {
    var h = null;
    // ?lang=<dil> adresle gelen dili zorlar (ör. Türkü Radyo uygulamasındaki bağlantı); kalıcı seçimi değiştirmez
    try { h = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (DILLER[h]) return h;
    try { h = localStorage.getItem('siteLang'); } catch (e) {}
    if (DILLER[h]) return h;
    var tl = []; try { tl = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || '']; } catch (e) {}
    for (var i = 0; i < tl.length; i++) { var k = String(tl[i] || '').slice(0, 2).toLowerCase(); if (DILLER[k]) return k; }
    return saatDili() || 'en';
  }

  // .lang / .lang-s düğme gruplarını açılır listeye çevir (aynı yerde, aynı görünüme yakın)
  function seciciKur() {
    if (!document.getElementById('dilSecStil')) {
      var st = document.createElement('style'); st.id = 'dilSecStil';
      st.textContent = 'select.dil-sec{font:inherit;font-size:12px;font-weight:600;letter-spacing:.3px;border:0;border-radius:200px;' +
        'padding:6px 26px 6px 12px;cursor:pointer;-webkit-appearance:none;appearance:none;background-repeat:no-repeat;' +
        'background-position:right 9px center;background-size:10px 6px;' +
        'background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 6%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%271.5%27/%3E%3C/svg%3E")}' +
        '.lang select.dil-sec{background-color:rgba(255,255,255,.08);color:var(--sand,#e8e2d5)}' +
        '.lang select.dil-sec option{color:#111}' +
        '.lang-s select.dil-sec{background-color:rgba(17,23,34,.07);color:var(--ink-3,#444)}' +
        '[dir=rtl] select.dil-sec{padding:6px 12px 6px 26px;background-position:left 9px center}' +
        /* Arapça: harf aralığı bitişik yazıyı koparır; yön okları (geri, gönder, bağlantı okları) sağdan sola düzende aynalanır */
        'html[lang=ar] body, html[lang=ar] body *{letter-spacing:0!important}' +
        '[dir=rtl] .back svg, [dir=rtl] button.submit svg, [dir=rtl] .btn svg.ok, [dir=rtl] .arr{transform:scaleX(-1)}';
      document.head.appendChild(st);
    }
    document.querySelectorAll('.lang[role=group], .lang-s[role=group]').forEach(function (g) {
      if (g.querySelector('select.dil-sec')) return;
      var s = document.createElement('select');
      s.className = 'dil-sec'; s.setAttribute('aria-label', 'Dil / Language');
      Object.keys(DILLER).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = DILLER[k]; o.lang = k; s.appendChild(o); });
      s.addEventListener('change', function () { window.setSiteLang(s.value); });
      g.innerHTML = ''; g.style.padding = '0'; g.style.background = 'none'; g.appendChild(s);
    });
  }

  // Sözlük, sayfa ayrıştırılırken (bu betik gövdenin sonunda) eşzamanlı istenir; uygulama DOMContentLoaded'da.
  var ilk = ilkDil();
  yukle(ilk, function () {});
  function basla() {
    seciciKur();
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { window.setSiteLang(b.getAttribute('data-lang')); });
    });
    if (ilk !== 'tr') yukle(ilk, function () { uygula(ilk); }); else isaretle();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla); else basla();
})();
