/* site-i18n.js — landing sayfalarının TR/EN dili (index.html, giris.html, kayit.html).
 *
 * Eski sitedeki yöntemin devamı: sayfa Türkçe yazılır, İngilizce seçilince görünen
 * metin düğümleri ve öznitelikler (aria-label, placeholder, alt, title) TR→EN
 * sözlükle (assets/site-en.js → window.SITE_EN) değiştirilir; asıllar saklanır,
 * Türkçeye dönüş sayfa yenilemeden olur.
 *
 * - Seçim localStorage 'siteLang'da (yasal sayfalar /privacy, /terms de bunu okur).
 *   Kayıt yoksa: tarayıcı dili tr ise TR, değilse EN.
 * - JS'in çalışırken yazdığı metinler için window.t('Türkçe') kullanılır; dil
 *   değişince 'dil-degisti' olayı yayılır, sayfalar kendi etiketlerini yeniden çizer.
 * - İngilizce açıkken sonradan eklenen düğümler de (MutationObserver) çevrilir.
 * - data-noi18n işaretli öğelerin içine dokunulmaz (ör. Do-Re-Mi nota adları).
 */
(function () {
  var EN = window.SITE_EN || {};
  var ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
  var asilMetin = new Map();          // metin düğümü → Türkçe asıl
  var asilOz = new Map();             // öğe → {öznitelik: Türkçe asıl}
  var dil = 'tr', izleyici = null;

  function anahtar(s) { return s.replace(/\s+/g, ' ').trim(); }
  function atla(el) { return !el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.nodeName) || (el.closest && el.closest('[data-noi18n]')); }

  function metniCevir(n) {
    if (atla(n.parentNode)) return;
    var t = anahtar(n.nodeValue);
    if (!t || !EN[t]) return;
    if (!asilMetin.has(n)) asilMetin.set(n, n.nodeValue);
    var asil = asilMetin.get(n), bas = asil.match(/^\s*/)[0], son = asil.match(/\s*$/)[0];
    n.nodeValue = bas + EN[t] + son;
  }
  function ozCevir(el) {
    if (atla(el)) return;
    ATTRS.forEach(function (a) {
      var v = el.getAttribute(a); if (!v) return;
      var k = anahtar(v); if (!EN[k]) return;
      var kayit = asilOz.get(el) || {}; if (!(a in kayit)) kayit[a] = v; asilOz.set(el, kayit);
      el.setAttribute(a, EN[k]);
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
  function isaretle() {
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      var on = b.getAttribute('data-lang') === dil;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  window.t = function (tr) { return dil === 'en' && EN[tr] != null ? EN[tr] : tr; };
  window.setSiteLang = function (hedef, kaydet) {
    if (hedef !== 'tr' && hedef !== 'en') return;
    if (kaydet !== false) { try { localStorage.setItem('siteLang', hedef); } catch (e) {} }
    if (hedef === dil) { isaretle(); return; }
    dil = window.siteLang = hedef;
    document.documentElement.lang = hedef;
    if (izleyici) { izleyici.disconnect(); izleyici = null; }
    if (dil === 'en') {
      agaciCevir(document.body);
      izleyici = new MutationObserver(function (ml) {
        ml.forEach(function (m) {
          if (m.type === 'attributes') { if (ATTRS.indexOf(m.attributeName) > -1) { var k = asilOz.get(m.target); if (!k || !(m.attributeName in k) || EN[anahtar(m.target.getAttribute(m.attributeName) || '')]) ozCevir(m.target); } return; }
          m.addedNodes.forEach(agaciCevir);
        });
      });
      izleyici.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    } else geriAl();
    isaretle();
    window.dispatchEvent(new CustomEvent('dil-degisti', { detail: dil }));
  };
  window.siteLang = 'tr';

  function basla() {
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { window.setSiteLang(b.getAttribute('data-lang')); });
    });
    var hedef = null;
    // (2026-10-11) ?lang=tr|en adresle gelen dili zorlar (ör. Türkü Radyo uygulamasındaki bağlantı); kalıcı seçimi değiştirmez
    try { hedef = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (hedef !== 'tr' && hedef !== 'en') hedef = null;
    if (!hedef) { try { hedef = localStorage.getItem('siteLang'); } catch (e) {} }
    if (!hedef) hedef = ((navigator.language || 'tr').slice(0, 2).toLowerCase() === 'tr') ? 'tr' : 'en';
    if (hedef === 'en') window.setSiteLang('en', false); else isaretle();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla); else basla();
})();
