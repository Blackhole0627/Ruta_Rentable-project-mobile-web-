import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rutarentable.app',
  appName: 'RutaRentable',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: { launchShowDuration: 2000, backgroundColor: '#0f172a' },
  },
};

export default config;
