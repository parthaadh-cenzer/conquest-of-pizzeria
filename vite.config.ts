import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: 'apps/client', base: './', plugins: [react()], build: { outDir: '../../dist/client', emptyOutDir: true, rollupOptions: { output: { manualChunks: { 'three-renderer': ['three'], 'scene-tools': ['@react-three/fiber', '@react-three/drei'] } } } }, server: { allowedHosts: true } });
