import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sf2gh.migrator',
  appName: 'SF2GH Migrator',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    // Allow network requests to external hosts required for migration
    allowNavigation: [
      'api.github.com',
      'git.code.sf.net',
      'sourceforge.net',
      'unpkg.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d1117',
    },
  },
};

export default config;
