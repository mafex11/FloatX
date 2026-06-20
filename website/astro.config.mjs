import { defineConfig } from 'astro/config';

// Static landing page, deployed on Vercel. `site` builds absolute URLs
// (canonical link + og:image for social cards). Update it to the final
// production domain if you attach a custom domain in Vercel.
export default defineConfig({
  site: 'https://floatx.vercel.app',
});
