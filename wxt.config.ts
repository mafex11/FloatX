import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'FloatX',
    description: 'An ambient floating shower of X posts. No API required.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['*://x.com/*', '*://*.x.com/*'],
    action: {
      default_title: 'Open FloatX shower',
    },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    // Document Picture-in-Picture is a plain web API; it needs no manifest permission.
  },
});
