/* auth-site.js — landing giriş/kayıt ortak kodu (giris.html, kayit.html).
 *
 * Uygulama app.repertuvar.app'te (başka köken), localStorage paylaşılmaz. Giriş burada
 * Supabase ile yapılır, oturum uygulamanın login.html'ine adres #'iyle devredilir:
 *   https://app.repertuvar.app/login.html?lang=en&invite=…#access_token=…&refresh_token=…&type=landing
 * app/login.html bu hash'i setSession ile alıp mesajsız index.html'e geçer. # kısmı sunucuya gitmez.
 *
 * Google: Google Identity Services butonu + signInWithIdToken. Supabase'in OAuth yönlendirmesi
 * kullanılmadığı için Google penceresinde "…supabase.co" değil, uygulama adı ve repertuvar.app görünür.
 * Apple: kod hazır, APPLE_AKTIF=false (Apple Developer üyeliği onaylanınca açılacak — app/_not.md).
 */
window.RA = (function () {
  var SUPA_URL = 'https://ehytkzxdhjyjuubizdnl.supabase.co';
  var SUPA_KEY = 'sb_publishable_f_WsYxzN06B5dGROrkGyPQ_UDxKSbtO';   // herkese açık anahtar (uygulamadakiyle aynı)
  var APP = 'https://app.repertuvar.app';
  var GOOGLE_CLIENT_ID = '33396018913-5h3jfncqf93a4js20k4e3gfgluc3v4l8.apps.googleusercontent.com';
  var APPLE_AKTIF = false;
  var APPLE_CLIENT_ID = 'app.repertuvar.web';                       // Apple Services ID (onaydan sonra oluşturulacak)

  // persistSession:false → landing kendi oturumunu saklamaz, devrettiği refresh token'ı döndürmez.
  var sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  var davet = new URLSearchParams(location.search).get('invite');
  var t = function (s) { return window.t ? window.t(s) : s; };

  function devret(sess, tur) {
    var q = new URLSearchParams();
    if (davet) q.set('invite', davet);
    q.set('lang', window.siteLang || 'tr');
    var h = new URLSearchParams({ access_token: sess.access_token, refresh_token: sess.refresh_token, type: tur || 'landing' });
    location.assign(APP + '/login.html?' + q.toString() + '#' + h.toString());
  }

  function hata(e) {
    var m = (e && e.message) || String(e || '');
    if (/Invalid login credentials/i.test(m)) return t('E-posta veya şifre hatalı.');
    if (/Email not confirmed/i.test(m)) return t('E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.');
    if (/already registered|already been registered|already exists/i.test(m)) return t('Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.');
    if (/Password should be at least|weak password/i.test(m)) return t('Şifre en az 6 karakter olmalı.');
    if (/rate limit|too many|security purposes/i.test(m)) return t('Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.');
    if (/Token has expired|invalid.*otp|otp.*invalid/i.test(m)) return t('Kod hatalı veya süresi dolmuş.');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('Bağlantı kurulamadı. İnternet bağlantını kontrol et.');
    return m || t('Bir şeyler ters gitti. Tekrar dene.');
  }

  // Kayıtta girilen adı profile yaz (uygulamadaki writeSignupProfile ile aynı istek).
  function profilAdi(sess, ad) {
    if (!ad) return Promise.resolve();
    return fetch(SUPA_URL + '/rest/v1/profiles?id=eq.' + sess.user.id, {
      method: 'PATCH',
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + sess.access_token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ display_name: ad, full_name: ad })
    }).catch(function () {});
  }

  function betik(src) {
    return new Promise(function (ok, no) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = function () { no(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  // Supabase id_token girişi: ham nonce Supabase'e, SHA-256'sı sağlayıcıya verilir.
  async function nonceUret() {
    var ham = Array.from(crypto.getRandomValues(new Uint8Array(24)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ham));
    return { ham: ham, ozet: Array.from(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0'); }).join('') };
  }

  /* Google: kutu = butonun çizileceği öğe; metin 'signin_with' | 'signup_with' | 'continue_with';
     basarili(sess) ve hataGoster(mesaj) sayfa tarafından verilir. Dil değişince buton yeniden çizilir. */
  async function google(kutu, metin, basarili, hataGoster) {
    var n = await nonceUret();
    try { await betik('https://accounts.google.com/gsi/client'); }
    catch (e) { kutu.textContent = t('Google ile giriş şu an yüklenemedi.'); return; }
    google_ilk(n);
    function google_ilk(nn) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID, nonce: nn.ozet, ux_mode: 'popup', itp_support: true, use_fedcm_for_button: true,
        callback: async function (r) {
          var res = await sb.auth.signInWithIdToken({ provider: 'google', token: r.credential, nonce: nn.ham });
          if (res.error || !res.data.session) { hataGoster(hata(res.error || 'Google')); n = await nonceUret(); google_ilk(n); return; }
          basarili(res.data.session);
        }
      });
      ciz();
    }
    function ciz() {
      kutu.innerHTML = '';
      window.google.accounts.id.renderButton(kutu, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: metin, logo_alignment: 'center',
        width: Math.min(400, Math.max(240, Math.round(kutu.getBoundingClientRect().width || 400))), locale: window.siteLang === 'en' ? 'en' : 'tr'
      });
    }
    window.addEventListener('dil-degisti', ciz);
  }

  /* Apple: APPLE_AKTIF=false iken buton gizli kalır. */
  async function apple(btn, basarili, hataGoster) {
    if (!APPLE_AKTIF) { btn.hidden = true; return; }
    btn.hidden = false;
    var n = await nonceUret();
    await betik('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js');
    window.AppleID.auth.init({ clientId: APPLE_CLIENT_ID, scope: 'name email', redirectURI: location.origin + location.pathname, usePopup: true, nonce: n.ozet });
    btn.addEventListener('click', async function () {
      try {
        var r = await window.AppleID.auth.signIn();
        var res = await sb.auth.signInWithIdToken({ provider: 'apple', token: r.authorization.id_token, nonce: n.ham });
        if (res.error || !res.data.session) { hataGoster(hata(res.error || 'Apple')); return; }
        var ad = r.user && r.user.name ? [r.user.name.firstName, r.user.name.lastName].filter(Boolean).join(' ') : '';
        await profilAdi(res.data.session, ad);
        basarili(res.data.session);
      } catch (e) { if (!(e && e.error === 'popup_closed_by_user')) hataGoster(hata(e)); }
    });
  }

  /* şifre göster/gizle */
  var GOZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var GOZ_KAPALI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function gozler() {
    document.querySelectorAll('.eye').forEach(function (b) {
      b.innerHTML = GOZ;
      b.onclick = function () {
        var i = b.previousElementSibling, gizli = i.type === 'password';
        i.type = gizli ? 'text' : 'password'; b.innerHTML = gizli ? GOZ_KAPALI : GOZ;
        b.setAttribute('aria-label', gizli ? t('Şifreyi gizle') : t('Şifreyi göster'));
      };
    });
  }
  /* görünüme girince netleşme (sağ panel) */
  function netlesme() {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '-10% 0px' });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  }

  return { sb: sb, devret: devret, hata: hata, profilAdi: profilAdi, google: google, apple: apple, gozler: gozler, netlesme: netlesme, t: t };
})();
