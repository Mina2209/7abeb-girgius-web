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

export default defineConfig({
  plugins: [react(), tailwindcss(), moveCssFirst()],
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
            return 'vendor-misc';
          }
        },
      },
    },
  },
})
