import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        b2b: resolve(__dirname, 'b2b.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        grandmaster_admin: resolve(__dirname, 'grandmaster-admin.html'),
        grandmaster_portal: resolve(__dirname, 'grandmaster-portal.html'),
        iklanguru: resolve(__dirname, 'iklanguru.html'),
        latihan: resolve(__dirname, 'latihan.html'),
        latihan_shadow: resolve(__dirname, 'latihan_shadow.html'),
        marketplace: resolve(__dirname, 'marketplace.html'),
        materi: resolve(__dirname, 'materi.html')
      }
    }
  }
});