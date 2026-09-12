# CloudFront in front of the Vite SPA S3 bucket.
#
# Solves, at the edge:
#   - HTTP/2 + HTTP/3 (Site is served on HTTP/1.1 today)
#   - Brotli/Gzip compression, INCLUDING for the initial HTML document
#   - Long-lived browser/edge caching for hashed /assets/* (immutable)
#   - Keep the S3 bucket 100% private via Origin Access Control (OAC)
#   - SPA deep-link routing via a CloudFront Function
#
# Apply:  terraform init && terraform plan && terraform apply
# NOTE:  The frontend bucket must be pushed with correct Cache-Control
#        headers - see scripts/deploy-s3.sh (immutable for /assets/*,
#        no-store for index.html).

provider "aws" {
  # CloudFront + ACM certificates must live in us-east-1.
  region = "us-east-1"
}

# Reference the existing bucket (created out-of-band / with website hosting).
data "aws_s3_bucket" "frontend" {
  bucket = "7abeb-frontend"
}

# --- 1) Origin Access Control: only CloudFront may read the bucket ---
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "7abeb-frontend-oac"
  description                       = "Restrict S3 reads to the CloudFront distribution"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "cloudfront_read" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${data.aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_distribution.frontend.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "cloudfront_read" {
  bucket = data.aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.cloudfront_read.json
}

# --- 2) SPA rewrite: client-side routes -> /index.html, pass real files ---
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "7abeb-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite SPA routes to /index.html; keep /assets/* and extension files"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = (request.uri || '/').split('?')[0];

      // Leave the root, the entry document, hashed assets and real files alone.
      if (uri === '/' || uri === '/index.html') { return request; }
      if (uri.indexOf('/assets/') === 0)        { return request; }
      if (/\.\w+$/.test(uri))                   { return request; }

      request.uri = '/index.html';
      return request;
    }
  EOT
}

# --- 3) The distribution ---
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  comment             = "7abeb Vite SPA frontend (S3 origin, OAC)"

  # Add your domain here and uncomment the viewer_certificate block.
  # aliases = ["www.example.com"]

  origin {
    origin_id                = "s3-7abeb-frontend"
    domain_name              = data.aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Everything else (index.html and SPA routes): never cache at the edge.
  default_cache_behavior {
    target_origin_id       = "s3-7abeb-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    # Managed-CachingDisabled
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  # Hashed, immutable build assets: cache for a year at the edge too.
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "s3-7abeb-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    # Managed-CachingOptimized (MinTTL 1s, Default 1d, Max 1y)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Use https://dxxxx.cloudfront.net by default. For a custom domain add an
  # ACM cert (region us-east-1) here:
  # viewer_certificate {
  #   acm_certificate_arn = "arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/..."
  #   ssl_support_method  = "sni-only"
  #   minimum_protocol_version = "TLSv1.2_2021"
  # }
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment = "production"
    Project     = "7abeb-frontend"
  }
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_id" {
  value = aws_cloudfront_distribution.frontend.id
}