/**
 * État de l'application : utilisateur, jeton, serveur, préférences de scan.
 */
import { createApiClient, type ApiClient } from "@tm/api-client";
import type { UserDTO } from "@tm/shared-types";
import { Capacitor } from "@capacitor/core";
import { reactive } from "vue";
import { prefs, secure } from "./storage";

const TOKEN_KEY = "tm.token";

export const state = reactive({
  ready: false,
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  token: null as string | null,
  user: null as UserDTO | null,
  deviceId: "",
  /** Après une première confirmation, un seul geste suffit pour valider (jamais de scan silencieux). */
  quickMode: false,
  sound: true,
});

let client: ApiClient | null = null;
let clientBase = "";
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export function api(): ApiClient {
  if (!client || clientBase !== state.baseUrl) {
    clientBase = state.baseUrl;
    client = createApiClient({
      baseUrl: state.baseUrl,
      getToken: () => state.token,
      onUnauthorized: () => {
        void clearSession();
        unauthorizedHandler?.();
      },
    });
  }
  return client;
}

export async function initStore(): Promise<void> {
  state.baseUrl = (await prefs.get("tm.baseUrl")) ?? state.baseUrl;
  state.quickMode = (await prefs.get("tm.quickMode")) === "1";
  state.sound = (await prefs.get("tm.sound")) !== "0";
  state.deviceId = (await prefs.get("tm.deviceId")) ?? "";
  if (!state.deviceId) {
    state.deviceId = `${Capacitor.getPlatform()}-${crypto.randomUUID().slice(0, 8)}`;
    await prefs.set("tm.deviceId", state.deviceId);
  }
  state.token = await secure.get(TOKEN_KEY);
  if (state.token) {
    try {
      state.user = (await api().auth.session()).user;
    } catch {
      // Hors ligne : on garde le jeton, la prochaine requête tranchera.
    }
  }
  state.ready = true;
}

export async function login(baseUrl: string, email: string, password: string): Promise<void> {
  state.baseUrl = baseUrl.replace(/\/+$/, "");
  await prefs.set("tm.baseUrl", state.baseUrl);
  const result = await api().auth.login({
    email,
    password,
    client: "mobile",
    deviceName: `Mobile ${Capacitor.getPlatform()} (${state.deviceId})`,
  });
  if (!result.token) throw new Error("Le serveur n'a pas renvoyé de jeton.");
  state.token = result.token;
  state.user = result.user;
  await secure.set(TOKEN_KEY, result.token);
}

export async function clearSession(): Promise<void> {
  state.token = null;
  state.user = null;
  await secure.remove(TOKEN_KEY);
}

export async function logout(): Promise<void> {
  try {
    await api().auth.logout();
  } catch {
    // ignoré : la session locale est supprimée dans tous les cas
  }
  await clearSession();
}

export async function setQuickMode(value: boolean) {
  state.quickMode = value;
  await prefs.set("tm.quickMode", value ? "1" : "0");
}

export async function setSound(value: boolean) {
  state.sound = value;
  await prefs.set("tm.sound", value ? "1" : "0");
}
