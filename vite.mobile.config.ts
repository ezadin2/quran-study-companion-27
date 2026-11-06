import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: 'mobile',
  publicDir: '../public',
  base: '/',
  plugins: [react(), tailwindcss()],
  // Tells the root route to skip its <html>/<body> shell inside the app's #root element.
  define: { __MOBILE_SHELL__: 'true' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: ['es2019', 'chrome79'], cssTarget: ['chrome79'], outDir: '../dist-mobile', emptyOutDir: true },
});
