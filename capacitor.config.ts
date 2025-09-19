import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.3845bfcc2ba54b1e885d6f2312e1cc94',
  appName: 'trezury',
  webDir: 'dist',
  server: {
    url: 'https://3845bfcc-2ba5-4b1e-885d-6f2312e1cc94.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0F172A',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK'
    }
  }
};

export default config;