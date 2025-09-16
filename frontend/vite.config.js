import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist'
  },
  // Optional: Set base if your app is served from a subpath (not needed here)
  base: '/'
});