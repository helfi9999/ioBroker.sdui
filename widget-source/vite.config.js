import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/types-vis-2/modulefederation.vis.config';
import { readFileSync } from 'node:fs';
const pack = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  plugins: [federation({
    name: 'sdui', filename: 'customWidgets.js',
    exposes: { './SduiWeekWidget': './src/SduiWeekWidget.jsx', './SduiNewsWidget': './src/SduiNewsWidget.js', './translations': './src/translations.js' },
    manifest: true, remotes: {},
    shared: moduleFederationShared(pack), dts: false,
  }), react()],
  base: './',
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { target: 'chrome89', outDir: 'widgets/vis-2-widgets-sdui', emptyOutDir: true },
});
