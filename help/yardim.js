// Yardım merkezi (2026-11-01): arama → soru listesi → seçilen sorunun adımları.
// Veri: veri-<dil>.js (window.YARDIM_VERI: makaleler, kategoriler, arayüz metinleri, dolgu kelimeleri; 10 dil).
// Kaynak metinler pazarlama/yardim/ altında; veri dosyalarını oradaki betik üretir, elle düzenleme.
(function () {
  var V = window.YARDIM_VERI;
  var M = window.YARDIM_METIN || (V && V.arayuz);
  if (!V || !M) return;
  var dil = V.dil, makaleler = V.makaleler;
  var TURKCE_KURAL = dil === 'tr' || dil === 'az';   // ek ve ünsüz yumuşaması kuralları (Türkçe, Azerbaycanca)
  var byId = {};
  makaleler.forEach(function (m) { byId[m.id] = m; });

  var $ = function (id) { return document.getElementById(id); };
  var giris = $('ara'), temizle = $('temizle'), liste = $('liste'), durum = $('durum'), sahne = $('sahne'), govde = $('govde');
  var seciliId = null;

  // Arayüz metinleri veriden (uygulama sayfası bunları boş getirir; sitede zaten yazılı, yeniden yazmak zararsız)
  if ($('yBaslik') && M.baslik) $('yBaslik').textContent = M.baslik;
  if ($('yAlt') && M.alt) $('yAlt').textContent = M.alt;
  if (M.ph) giris.placeholder = M.ph;
  if (M.ara) giris.setAttribute('aria-label', M.ara);
  if (M.temizle) temizle.setAttribute('aria-label', M.temizle);
  var sikKap = $('ySik');
  if (sikKap && !sikKap.children.length && M.sik) {
    var sb = document.createElement('span'); sb.textContent = M.sikBaslik || ''; sikKap.appendChild(sb);
    M.sik.forEach(function (q) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.dataset.ara = q; sikKap.appendChild(b);
    });
  }

  // Harfleri sadeleştir: "Şifremi" = "sifremi", "İçe" = "ice", "é" = "e", "ß" = "ss", Azerbaycanca "ə" = "e";
  // Arapçada harekeler atılır, elif/te-merbuta/elif-maksura birleştirilir. Harf olmayan her şey boşluk (her alfabe korunur).
  var HARF = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u', 'ə': 'e', 'ß': 'ss',
               'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ة': 'ه', 'ى': 'ي' };
  function sade(s) {
    return String(s || '').toLocaleLowerCase(TURKCE_KURAL ? 'tr-TR' : dil)
      .replace(/[çğıöşüâîûəßأإآةى]/g, function (h) { return HARF[h]; })
      .normalize('NFD').replace(/[̀-ًͯ-ٰٟـ]/g, '')
      .replace(/\*\*/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  var DOLGU = (V.dolgu || (dil === 'tr'
    ? ['nasil', 'ne', 'bir', 've', 'ile', 'mi', 'mu', 'icin', 'bu', 'da', 'de', 'yapilir', 'yaparim', 'yapabilirim', 'olur', 'nedir']
    : ['how', 'do', 'i', 'a', 'an', 'the', 'to', 'my', 'can', 'what', 'is', 'in', 'of', 'on', 'for', 'does'])).map(sade);

  // Alan ağırlıkları: başlık en değerli, adım metni en az.
  var ALANLAR = [['baslik', 5], ['anahtar', 4], ['kategori', 2], ['ozet', 2], ['adimlar', 1], ['ipuclari', 1]];
  function dolgusuz(s) { return sade(s).split(' ').filter(function (k) { return k && DOLGU.indexOf(k) === -1; }); }
  makaleler.forEach(function (m) {
    m._k = ALANLAR.map(function (a) {
      var v = m[a[0]]; v = Array.isArray(v) ? v.join(' ') : v;
      return { w: a[1], kelimeler: sade(v).split(' ').filter(Boolean) };
    });
    // Art arda eşleşme için ifadeler: başlık ve her anahtar ifade (dolgu kelimeleri atılmış)
    m._ifade = [dolgusuz(m.baslik)].concat((m.anahtar || []).map(dolgusuz));
    m._boy = m._ifade[0].length;
  });

  // Kelime eşleşmesi: biri ötekinin başıysa tam puan ("repertuvarimi" ~ "repertuvar"), içinde geçiyorsa yarım.
  // (2026-11-01) Türkçe ekler: "ekleme" ~ "eklerim" ~ "eklenir" — ortak baş en az 4 harf ve kısa kelimenin en çok son
  // 3 harfi farklıysa aynı kök sayılır (Emir: "eser ekleme" araması "favorilere eklerim"i öne çıkarıyordu).
  // Tam eşleşme önde: "not" → "not" 1, "nota" 0,9. Fiil ekleri: "silme" → "silerim", "kapanıyor" → "kapanmasın".
  // (Arama denemesi: pazarlama/yardim/arama-testi.json)
  // Ünsüz yumuşaması: grup → grubu, renk → rengi (sade() sonrası p→b, t→d, k→g)
  var YUMUSA = { p: 'b', t: 'd', k: 'g' };
  function kelimePuani(t, k) {
    if (t === k) return 1;
    if (k.indexOf(t) === 0) return 0.9;                                       // eser → eseri
    var y = TURKCE_KURAL && YUMUSA[t.slice(-1)];
    if (y && t.length >= 4 && k.indexOf(t.slice(0, -1) + y) === 0) return 0.85;  // grup → grubu
    var o = 0;
    while (o < t.length && o < k.length && t[o] === k[o]) o++;
    var kisa = Math.min(t.length, k.length);
    // Ayrışan ekler: ekleme ~ eklerim, kapanıyor ~ kapanmasın (biri ötekinin başı değilse)
    if (o < kisa && (o >= 5 || (o >= 4 && o >= kisa - 3))) return 0.8;
    var kok = TURKCE_KURAL ? t.replace(/(iyor|uyor|yor|mak|mek|ma|me)$/, '') : t;
    if (kok.length >= 2 && kok.length < t.length && k.indexOf(kok) === 0) return 0.7;  // silme → silerim
    // Aranan kelime uzun, belgedeki kısa ("eserlerim" ↔ "eser"): tutan kısmın oranı kadar
    if (k.length >= 4 && t.indexOf(k) === 0) return 0.9 * k.length / t.length;
    if (t.length >= 4 && k.indexOf(t) > 0) return 0.5;
    return 0;
  }
  // Aranan kelimeler bir ifadede art arda geçiyor mu ("eser ekleme" ~ anahtar "eser ekle")
  function ardisik(sozcukler, kelimeler) {
    for (var i = 0; i + sozcukler.length <= kelimeler.length; i++) {
      var tamam = true;
      for (var j = 0; j < sozcukler.length && tamam; j++) tamam = kelimePuani(sozcukler[j], kelimeler[i + j]) > 0;
      if (tamam) return true;
    }
    return false;
  }
  function puanla(m, sozcukler) {
    var toplam = 0, bulunan = 0;
    sozcukler.forEach(function (t) {
      var en = 0;
      m._k.forEach(function (alan) {
        for (var i = 0; i < alan.kelimeler.length; i++) {
          var p = kelimePuani(t, alan.kelimeler[i]) * alan.w;
          if (p > en) en = p;
        }
      });
      if (en > 0) { bulunan++; toplam += en; }
    });
    if (sozcukler.length > 1 && m._ifade.some(function (k) { return ardisik(sozcukler, k); })) toplam += 6;
    // Arama bir anahtar ifadenin kendisiyse ("eserlerim" = anahtar "eserlerim") ayrıca öne
    if (m._ifade.slice(1).some(function (k) { return k.length === sozcukler.length && ardisik(sozcukler, k); })) toplam += 4;
    return { puan: toplam, bulunan: bulunan };
  }
  function ara(q) {
    var s = sade(q).split(' ').filter(function (t) { return t.length > 1; });
    var anlamli = s.filter(function (t) { return DOLGU.indexOf(t) === -1; });
    if (anlamli.length) s = anlamli;
    if (!s.length) return null;
    var puanlar = makaleler.map(function (m) { var r = puanla(m, s); r.m = m; return r; });
    // Bütün kelimeleri içeren soru varsa yalnız onlar; yoksa kelimelerin en az yarısını içerenler.
    var tamami = puanlar.some(function (r) { return r.bulunan === s.length; });
    var gerek = tamami ? s.length : Math.max(1, Math.ceil(s.length / 2));
    return puanlar
      .filter(function (r) { return r.bulunan >= gerek; })
      // Eşitlikte kısa başlık (daha genel soru) önce
      .sort(function (a, b) { return (b.bulunan - a.bulunan) || (b.puan - a.puan) || (a.m._boy - b.m._boy); })
      // İlk sonucun puanının %40'ının altında kalanlar gürültü ("eser" neredeyse her soruda geçiyor)
      .filter(function (r, i, dizi) { return r.puan >= dizi[0].puan * 0.4; })
      .map(function (r) { return r.m; });
  }

  function el(tag, cls, metin) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (metin != null) e.textContent = metin;
    return e;
  }
  // **etiket** → <strong>; önce kaçış, sonra yalnız kalın.
  function zengin(s) {
    var d = el('span');
    d.innerHTML = String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    }).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return d;
  }

  function soruDugmesi(m, kategoriGoster) {
    var li = el('li'), b = el('button');
    b.type = 'button';
    b.dataset.id = m.id;
    b.appendChild(el('span', 'soru', m.baslik));
    if (kategoriGoster) {
      b.appendChild(el('span', 'ozet', m.ozet));
      b.appendChild(el('span', 'kat', m.kategori));
    }
    if (m.id === seciliId) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', function () { ac(m.id, true); });
    li.appendChild(b);
    return li;
  }

  function listele() {
    var q = giris.value;
    temizle.hidden = !q;
    liste.textContent = '';
    var sonuc = ara(q);
    if (sonuc === null) {
      durum.textContent = M.tumu.replace('{n}', makaleler.length);
      var gruplar = {};
      V.kategoriler.forEach(function (k) { gruplar[k] = []; });
      makaleler.forEach(function (m) { (gruplar[m.kategori] = gruplar[m.kategori] || []).push(m); });
      Object.keys(gruplar).forEach(function (k) {
        if (!gruplar[k].length) return;
        liste.appendChild(el('h2', null, k));
        var ul = el('ul');
        gruplar[k].forEach(function (m) { ul.appendChild(soruDugmesi(m, false)); });
        liste.appendChild(ul);
      });
      return;
    }
    if (!sonuc.length) {
      durum.textContent = '';
      var bos = el('div', 'bos');
      bos.appendChild(zengin(M.bulunamadi));
      bos.appendChild(document.createTextNode(' '));
      var a = el('a', null, 'support@repertuvar.app');
      a.href = 'mailto:support@repertuvar.app';
      bos.appendChild(a);
      liste.appendChild(bos);
      return;
    }
    durum.textContent = M.sonuc.replace('{n}', sonuc.length);
    var ul = el('ul');
    sonuc.forEach(function (m) { ul.appendChild(soruDugmesi(m, true)); });
    liste.appendChild(ul);
  }

  function bolum(baslik, icerik) {
    var f = document.createDocumentFragment();
    f.appendChild(el('h3', null, baslik));
    f.appendChild(icerik);
    return f;
  }

  function goster(m) {
    sahne.textContent = '';
    if (!m) {
      sahne.appendChild(el('p', 'bekle', M.bekle));
      return;
    }
    var geri = el('button', 'geri', M.geri);
    geri.type = 'button';
    geri.addEventListener('click', function () { kapat(true); });
    sahne.appendChild(geri);
    sahne.appendChild(el('p', 'yer', m.kategori));
    var h = el('h2', null, m.baslik);
    h.id = 'cevap-baslik';
    h.tabIndex = -1;
    sahne.appendChild(h);
    if (m.ozet) sahne.appendChild(el('p', 'cevap-ozet', m.ozet));
    var ol = el('ol', 'adimlar');
    m.adimlar.forEach(function (a) { var li = el('li'); li.appendChild(zengin(a)); ol.appendChild(li); });
    sahne.appendChild(ol);
    if (m.platform) {
      var n = el('p', 'not'); n.appendChild(zengin(m.platform));
      sahne.appendChild(bolum(M.platform, n));
    }
    if (m.ipuclari && m.ipuclari.length) {
      var ul = el('ul', 'ipucu');
      m.ipuclari.forEach(function (t) { var li = el('li'); li.appendChild(zengin(t)); ul.appendChild(li); });
      sahne.appendChild(bolum(M.ipuclari, ul));
    }
    var ilgili = (m.ilgili || []).filter(function (id) { return byId[id] && id !== m.id; });
    if (ilgili.length) {
      var d = el('div', 'ilgili');
      ilgili.forEach(function (id) {
        var b = el('button', null, byId[id].baslik);
        b.type = 'button';
        b.addEventListener('click', function () { ac(id, true); });
        d.appendChild(b);
      });
      sahne.appendChild(bolum(M.ilgili, d));
    }
    var yaz = el('p', 'yaz');
    yaz.appendChild(document.createTextNode(M.yaz + ' '));
    var a = el('a', null, 'support@repertuvar.app');
    a.href = 'mailto:support@repertuvar.app?subject=' + encodeURIComponent(m.baslik);
    yaz.appendChild(a);
    sahne.appendChild(yaz);
  }

  function isaretle() {
    Array.prototype.forEach.call(liste.querySelectorAll('button[data-id]'), function (b) {
      if (b.dataset.id === seciliId) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function ac(id, gecmiseYaz) {
    var m = byId[id];
    if (!m) return;
    seciliId = id;
    goster(m);
    isaretle();
    govde.classList.add('acik');
    document.title = m.baslik + ' | ' + M.sayfa;
    if (gecmiseYaz) history.pushState({ yardim: id }, '', '#' + id);
    sahne.scrollTop = 0;
    // Dar ekranda cevaba kaydır; üstteki boşluğu CSS'teki scroll-margin-top belirler (uygulamada sabit üst çubuk var).
    if (window.matchMedia('(max-width:820px)').matches) govde.scrollIntoView({ block: 'start' });
    var h = $('cevap-baslik');
    if (h) h.focus({ preventScroll: true });
  }
  function kapat(gecmiseYaz) {
    seciliId = null;
    goster(null);
    isaretle();
    govde.classList.remove('acik');
    document.title = M.sayfa;
    if (gecmiseYaz) history.pushState(null, '', location.pathname + location.search);
  }

  var bekleyen;
  giris.addEventListener('input', function () { clearTimeout(bekleyen); bekleyen = setTimeout(listele, 80); });
  giris.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      var ilk = liste.querySelector('button[data-id]');
      if (ilk) { e.preventDefault(); ilk.focus(); }
    } else if (e.key === 'Escape') { giris.value = ''; listele(); }
    else if (e.key === 'Enter') {
      var b = liste.querySelector('button[data-id]');
      if (b && giris.value.trim()) { e.preventDefault(); ac(b.dataset.id, true); }
    }
  });
  liste.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var bs = Array.prototype.slice.call(liste.querySelectorAll('button[data-id]'));
    var i = bs.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    if (e.key === 'ArrowUp' && i === 0) { giris.focus(); return; }
    var s = bs[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (s) s.focus();
  });
  temizle.addEventListener('click', function () { giris.value = ''; listele(); giris.focus(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-ara]'), function (b) {
    b.addEventListener('click', function () { giris.value = b.dataset.ara; listele(); giris.focus(); });
  });
  window.addEventListener('popstate', function () {
    var id = decodeURIComponent(location.hash.slice(1));
    if (byId[id]) ac(id, false); else kapat(false);
  });

  listele();
  var ilkId = decodeURIComponent(location.hash.slice(1));
  if (byId[ilkId]) { history.replaceState({ yardim: ilkId }, '', '#' + ilkId); ac(ilkId, false); }
  else goster(null);
})();
