/**
 * Stockage local :
 * - `secure` : jeton d'authentification → Keychain / Keystore sur mobile
 *   (sessionStorage en développement web, jamais localStorage) ;
 * - `prefs` : préférences non sensibles (URL du serveur, mode rapide, file d'attente).
 */
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const native = Capacitor.isNativePlatform();

export const secure = {
  async get(key: string): Promise<string | null> {
    if (!native) return sessionStorage.getItem(key);
    const value = await SecureStorage.get(key).catch(() => null);
    return typeof value === "string" ? value : null;
  },
  async set(key: string, value: string): Promise<void> {
    if (!native) return sessionStorage.setItem(key, value);
    await SecureStorage.set(key, value);
  },
  async remove(key: string): Promise<void> {
    if (!native) return sessionStorage.removeItem(key);
    await SecureStorage.remove(key).catch(() => undefined);
  },
};

export const prefs = {
  async get(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  },
  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
  async getJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value));
  },
};
