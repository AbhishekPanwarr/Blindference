import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [],
        providerImportSource: '@mdx-js/react',
      }),
      tailwindcss(),
      {
        name: 'blindference-wasm-mime',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.includes('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            }
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.includes('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            }
            next();
          });
        },
      },
      // Patch @reineira-os/sdk so it always uses dynamic import() instead
      // of require() for @cofhe/sdk. Vite cannot dynamically require() ESM.
      {
        name: 'fix-reineira-require',
        transform(code, id) {
          if (id.includes('@reineira-os') && id.endsWith('.js')) {
            return code.replace(/typeof\s+(__)?require\s*!==\s*["']undefined["']/g, 'false');
          }
        },
      },
    ],
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      // Only exclude tfhe from pre-bundling. It is a WASM-heavy ESM package
      // with relative .wasm imports that break when hoisted into .vite/deps/.
      // @cofhe/sdk and other deps are pre-bundled normally so CJS interop
      // (e.g. iframe-shared-storage) works correctly.
      exclude: ['tfhe'],
      force: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        tfhe: path.resolve(__dirname, 'src/lib/tfhe-wrapper.ts'),
        tweetnacl: path.resolve(__dirname, 'src/lib/tweetnacl-wrapper.ts'),
        'tweetnacl/nacl-fast.js': path.resolve(__dirname, 'src/lib/tweetnacl-wrapper.ts'),
        // Redirect CoFHE node SDK to web bundle so @reineira-os/sdk works in browser
        '@cofhe/sdk/node': path.resolve(__dirname, 'node_modules/@cofhe/sdk/dist/web.js'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      host: '127.0.0.1',
      port: 3000,
    },
  };
});
