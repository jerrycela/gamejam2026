import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/gamejam2026/' : './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    open: true,
  },
});
