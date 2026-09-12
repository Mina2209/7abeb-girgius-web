// @ts-expect-error Node.js type declarations are not included in this client config's tsconfig.
import { readFileSync, writeFileSync } from 'node:fs'
// @ts-expect-error Node.js type declarations are not included in this client config's tsconfig.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function moveCssFirst(): import('vite').Plugin {
  return {
    name: 'move-css-first',
    enforce: 'post',
    transformIndexHtml(html) {
      const cssMatch = html.match(/(<link rel="stylesheet"[^>]*>\s*)/);
      if (!cssMatch) return html;
      const cssTag = cssMatch[1].trim();
      const withoutCss = html.replace(cssMatch[0], '');
      const lastPreconnectIdx = withoutCss.lastIndexOf('preconnect');
      if (lastPreconnectIdx === -1) return html;
      const afterPreconnect = withoutCss.indexOf('/>', lastPreconnectIdx) + 2;
      return withoutCss.slice(0, afterPreconnect) + '\n\n    ' + cssTag + withoutCss.slice(afterPreconnect);
    },
  };
}

/**
 * Loads the main Vite-emitted stylesheet asynchronously (media="print" swap trick)
 * and inlines a tiny "critical" shell so the page never paints unstyled (no FOUC).
 *
 * The critical block only covers theme variables + base element styles that are
 * needed before React hydrates. The full Tailwind stylesheet still loads, just
 * without blocking first paint, and is cached immediately/browser + edge.
 */
function nonBlockingCss(): import('vite').Plugin {
  let outDir = 'dist';
  return {
    name: 'non-blocking-css',
    enforce: 'post',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const htmlPath = resolve(outDir, 'index.html');
      const html = readFileSync(htmlPath, 'utf8');

      const cssLinkRe = /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)"\s*\/?>/;
      const cssMatch = html.match(cssLinkRe);
      if (!cssMatch) return;

      const criticalCss = [
        ':root{--background:#ffffff;--foreground:oklch(0.145 0 0);--primary:#1A4F9E;--card:#f7f7f7;--muted:#ececf0;--muted-foreground:#717182;--accent:#1A4F9E;--sidebar:#f7f7f7;--sidebar-foreground:#374151}',
        '.dark{--background:#0f0f0f;--foreground:#f5f5f5;--primary:#c2410c;--card:#1a1a1a;--muted:#2a2a2a;--muted-foreground:#a1a1a1;--accent:#ea580c;--sidebar:#1a1a1a;--sidebar-foreground:#f5f5f5}',
        'html,body{background-color:var(--background);color:var(--foreground);font-family:"Tajawal",sans-serif;overflow:hidden;min-height:100%}',
      ].join('');

      const replacement = [
        `    <style id="critical-shell">${criticalCss}</style>`,
        `    <link rel="stylesheet" href="${cssMatch[1]}" media="print" onload="this.media='all'" />`,
        '    <noscript>',
        `      <link rel="stylesheet" href="${cssMatch[1]}" />`,
        '    </noscript>',
      ].join('\n');

      writeFileSync(htmlPath, html.replace(cssMatch[0], replacement), 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), moveCssFirst(), nonBlockingCss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2018',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    cssCodeSplit: true,
    cssMinify: 'esbuild',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 500,
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react-dom';
            }
            if (id.includes('/react/')) {
              return 'vendor-react';
            }
            if (id.includes('react-router-dom') || id.includes('react-router')) {
              return 'vendor-router';
            }
            if (id.includes('@radix-ui') || id.includes('react-remove-scroll') || id.includes('aria-hidden') || id.includes('use-sidecar') || id.includes('use-callback-ref') || id.includes('react-style-singleton') || id.includes('get-nonce')) {
              return 'vendor-radix';
            }
            if (id.includes('sonner')) {
              return 'vendor-sonner';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('react-responsive-masonry')) {
              return 'vendor-masonry';
            }
            if (id.includes('pptx-preview') || id.includes('echarts') || id.includes('lodash')) {
              // Only used by the lazily-loaded PowerPoint previewer; keep out of the
              // initial bundle so echarts (~700 kB) isn't downloaded on first paint.
              return 'vendor-pptx';
            }
            return 'vendor-misc';
          }
        },
      },
    },
  },
})
