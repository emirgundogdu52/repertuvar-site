/* yasal-dil.js — Gizlilik, Koşullar ve Destek sayfalarının dili (2026-10-30, 10 dil).
 *
 * Her dil ayrı sayfa: /privacy/ (tr), /privacy/en/, /privacy/de/ … (terms, support aynı düzen).
 * Sayfa <html lang> ile kendi dilini, <body data-yasal="privacy|terms|support"> ile türünü bildirir.
 * - Hangi dil gösterilecek: ?lang=<dil> (uygulamadan gelen bağlantı) → landing'le ortak seçim (localStorage 'siteLang')
 *   → tarayıcı dilleri → İngilizce. Sayfa o dilde değilse o dilin sayfasına `replace` ile geçilir (geri tuşu döngüye girmez).
 * - #dilListesi öğesine 10 dilin bağlantıları yazılır; tıklanınca seçim 'siteLang'a kaydedilir.
 * - Türkçe ve İngilizce dışındaki sayfalar çeviridir; bağlayıcı metin notu sayfanın kendisinde yazılı.
 */
(function () {
  var DILLER = { tr: 'Türkçe', en: 'English', de: 'Deutsch', nl: 'Nederlands', fr: 'Français', es: 'Español',
                 it: 'Italiano', pt: 'Português', az: 'Azərbaycanca', ar: 'العربية' };
  var tur = document.body && document.body.getAttribute('data-yasal');
  if (!tur) return;
  var bu = (document.documentElement.lang || 'tr').slice(0, 2).toLowerCase();
  function adres(d) { return '/' + tur + '/' + (d === 'tr' ? '' : d + '/'); }
  function istenen() {
    var h = null;
    try { h = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (DILLER[h]) return h;
    try { h = localStorage.getItem('siteLang'); } catch (e) {}
    if (DILLER[h]) return h;
    var tl = []; try { tl = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || '']; } catch (e) {}
    for (var i = 0; i < tl.length; i++) { var k = String(tl[i] || '').slice(0, 2).toLowerCase(); if (DILLER[k]) return k; }
    return 'en';
  }
  var hedef = istenen();
  if (hedef !== bu) { try { location.replace(adres(hedef) + location.hash); return; } catch (e) {} }
  function liste() {
    var kap = document.getElementById('dilListesi'); if (!kap) return;
    kap.innerHTML = '';
    Object.keys(DILLER).forEach(function (d) {
      if (d === bu) return;
      var a = document.createElement('a');
      a.href = adres(d); a.lang = d; a.textContent = DILLER[d]; a.className = 'dil';
      a.addEventListener('click', function () { try { localStorage.setItem('siteLang', d); } catch (e) {} });
      kap.appendChild(a);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liste); else liste();
})();
