#!/usr/bin/env bash
set -euo pipefail

# Deploy the Vite build to the S3 bucket with correct Cache-Control headers.
#   assets/*         -> hashed + immutable  -> cache forever (browser)
#   index.html       -> never cache          -> new releases appear instantly
#   everything else  -> 5 minutes
#
# Usage:
#   CLOUDFRONT_DISTRIBUTION_ID=EXxxxxxxxxxxxx bash scripts/deploy-s3.sh
#   (omit the env var to skip the invalidation step)

BUCKET="7abeb-frontend"
DIST="dist"
DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

npm run build

echo "==> Uploading immutable assets (/assets/*)"
aws s3 sync "$DIST/assets" "s3://$BUCKET/assets" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

echo "==> Uploading the rest"
aws s3 sync "$DIST" "s3://$BUCKET" \
  --exclude "assets/*" \
  --cache-control "public, max-age=300"

echo "==> index.html must revalidate on every visit"
aws s3 cp "$DIST/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"

if [ -n "$DIST_ID" ]; then
  echo "==> Invalidating CloudFront ($DIST_ID)"
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
fi

echo "==> Done."