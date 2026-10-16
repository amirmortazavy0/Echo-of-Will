import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(() => ({
 plugins:[react(),tailwindcss(),VitePWA({
  registerType:'autoUpdate',includeAssets:['favicon.ico','apple-touch-icon.png','icon.svg'],manifest:false,
  workbox:{globPatterns:['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
   navigateFallbackDenylist:[/^\/api\//,/^\/auth\//,/^\/manifest\.webmanifest/],
   runtimeCaching:[{urlPattern:({url})=>url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname==='/manifest.webmanifest',handler:'NetworkOnly'}]},
  devOptions:{enabled:false}
 })],
 resolve:{alias:{'@':path.resolve(process.cwd(),'.')}},
 server:{hmr:false,watch:process.env.DISABLE_HMR==='true'?null:{}}
}));
