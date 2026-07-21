#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# repertuvar.app LANDING — tek komutla deploy
#
#   ./deploy-site.sh "commit mesaji"
#   ./deploy-site.sh                  → mesaj vermezsen tarih/saat
#
# Uygulama deposu AYRI: onun icin ../Repertuvar/deploy.sh kullan.
# Burada www/ ve Capacitor YOK, service worker surumu artirilmaz
# (buradaki SW kendini imha eden surum, versiyonu yok).
# ────────────────────────────────────────────────────────────
set -uo pipefail

SITE="$HOME/Desktop/Yeni Repertuvar/Repertuvar App Claude/repertuvar-site"
cd "$SITE" || { echo "Repo bulunamadi: $SITE"; exit 1; }

MSG="${1:-site $(date '+%Y-%m-%d %H:%M')}"
echo "Klasor: $SITE"

MISS=0
for f in index.html CNAME 404.html service-worker.js robots.txt assets/logo.png assets/baglama.png assets/guitar.png; do
  [ -f "$f" ] || { echo "  EKSIK: $f"; MISS=$((MISS+1)); }
done
grep -q "APP_BASE" index.html || { echo "  UYARI: index.html icinde APP_BASE yok"; MISS=$((MISS+1)); }
grep -q "repertuvar.app" CNAME || { echo "  UYARI: CNAME beklenen alan adini icermiyor"; MISS=$((MISS+1)); }
if [ "$MISS" -gt 0 ]; then
  echo "$MISS sorun var. Yine de devam edilsin mi? (e/h)"
  read -r yn
  [ "$yn" = "e" ] || exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "Commit edilecek degisiklik yok."
else
  git commit -m "$MSG" && echo "Commit: $MSG"
  git push origin main && echo "Push edildi (GitHub Pages ~1-2 dk)"
fi

echo ""
echo "Yayin kontrolu (60 sn)..."
for i in 1 2 3 4 5 6; do
  sleep 10
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://repertuvar.app/?nocache=$(date +%s)")
  echo "  deneme $i: HTTP $CODE"
  [ "$CODE" = "200" ] && break
done

LIVE=$(curl -s "https://repertuvar.app/?nocache=$(date +%s)" | grep -c "APP_BASE")
if [ "$LIVE" -gt 0 ]; then
  echo "OK — canli sayfa guncel surumu iceriyor."
else
  echo "UYARI — canli sayfada APP_BASE bulunamadi. Pages ayari acik mi, birkac dk daha bekle."
fi

for a in assets/logo.png assets/baglama.png assets/guitar.png; do
  C=$(curl -s -o /dev/null -w "%{http_code}" "https://repertuvar.app/$a")
  echo "  $a -> HTTP $C"
done
