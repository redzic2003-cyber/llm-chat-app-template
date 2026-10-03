import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ch.example.trainingmanager",
  appName: "Livoti Formations",
  webDir: "dist",
  server: {
    // Origine https://localhost (Android) / capacitor://localhost (iOS) : à autoriser
    // dans NUXT_CORS_ORIGINS côté API.
    androidScheme: "https",
  },
  plugins: {
    SecureStorage: {
      // Le jeton est conservé dans le Keychain (iOS) / Keystore (Android).
    },
  },
};

export default config;
