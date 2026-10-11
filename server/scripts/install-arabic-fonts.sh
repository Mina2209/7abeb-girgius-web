#!/usr/bin/env bash
#
# Install the PowerPoint -> PDF preview fonts and fontconfig alias, system-wide.
#
# Why this exists
# ---------------
# The hymn decks tag their Arabic lyric runs with cs="Times New Roman", a family
# that is not installed on the conversion host. fontconfig then substitutes
# Noto Naskh Arabic and LibreOffice emits unshaped (disconnected) Arabic for
# those runs. Times New Roman is aliased to Tajawal (OFL, and already embedded
# inside the decks), which LibreOffice shapes correctly.
#
# The Docker image applies this at build time (see ../Dockerfile). A host that
# runs the API directly -- e.g. PM2 on EC2, which is how the church API runs --
# never ran a Dockerfile build, so LibreOffice there still substitutes Noto and
# freshly converted (uncached) decks come out with broken Arabic. Run THIS once
# per host, as root, so the fonts are visible to every user LibreOffice runs as.
#
# Idempotent: safe to re-run after a rebuild or on a fresh instance.
#
# Usage
# -----
#   sudo bash server/scripts/install-arabic-fonts.sh
#
#   # Verify as the *service* user -- fonts must be visible to it, not just root:
#   sudo -u ec2-user fc-match "Times New Roman"     # expect: ...: "Tajawal"
#   sudo -u ec2-user fc-match -s "Times New Roman" | head
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (e.g. sudo bash \"$0\")." >&2
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fonts_src="$here/../fonts"
fonts_dir="/usr/share/fonts/truetype/tajawal"
conf_dir="/etc/fonts/conf.d"

for f in Tajawal-Regular.ttf Tajawal-Bold.ttf OFL.txt 90-tajawal-times-new-roman.conf; do
  if [ ! -f "$fonts_src/$f" ]; then
    echo "Missing $fonts_src/$f -- run this from a full checkout of the server." >&2
    exit 1
  fi
done

if ! command -v fc-cache >/dev/null 2>&1; then
  echo "fontconfig is not installed. Install it first, for example:" >&2
  echo "  apt-get update && apt-get install -y fontconfig" >&2
  exit 1
fi

install -d -m 0755 "$fonts_dir"
install -m 0644 \
  "$fonts_src/Tajawal-Regular.ttf" \
  "$fonts_src/Tajawal-Bold.ttf" \
  "$fonts_src/OFL.txt" \
  "$fonts_dir/"
install -m 0644 "$fonts_src/90-tajawal-times-new-roman.conf" \
  "$conf_dir/90-tajawal-times-new-roman.conf"

# Rebuild the font cache (system-wide: /var/cache/fontconfig).
fc-cache -f

echo "Installed Tajawal + fontconfig alias."
printf 'fc-match "Times New Roman" -> '
fc-match "Times New Roman"

if fc-match "Times New Roman" | grep -qi tajawal; then
  echo "OK: Arabic CS font resolves to Tajawal."
else
  echo "WARNING: 'Times New Roman' did not resolve to Tajawal." >&2
  echo "Check that $conf_dir/90-tajawal-times-new-roman.conf is being loaded:" >&2
  echo "  fc-conflist | grep -i tajawal      # expect the 90-... file listed" >&2
  echo "  fc-match -s \"Times New Roman\" | head" >&2
  exit 2
fi
