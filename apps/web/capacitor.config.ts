import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rutarentable.app',
  appName: 'RutaRentable',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: { launchShowDuration: 2000, backgroundColor: '#0f172a' },
    // Let @capacitor-community/safe-area own the edge-to-edge inset handling so
    // the header isn't hidden behind the status bar on Android 15+ WebViews.
    SystemBars: { insetsHandling: 'disable' },
  },
};

export default config;
