/**
 * File locale des validations dont l'envoi a échoué faute de réseau.
 * Chaque entrée garde sa clé d'idempotence : le renvoi ne peut jamais créer de doublon.
 * (Le mode hors ligne complet — « session pack » — est prévu en V2.)
 */
import { ApiClientError } from "@tm/api-client";
import { reactive } from "vue";
import { prefs } from "./storage";
import { api, state } from "./store";

export interface PendingValidation {
  enrollmentId: string;
  sessionId: string;
  idempotencyKey: string;
  label: string;
  queuedAt: string;
}

const KEY = "tm.pendingValidations";
export const queue = reactive({ items: [] as PendingValidation[], flushing: false });

export async function loadQueue() {
  queue.items = await prefs.getJson<PendingValidation[]>(KEY, []);
}

async function save() {
  await prefs.setJson(KEY, queue.items);
}

export async function enqueue(item: PendingValidation) {
  queue.items = [...queue.items.filter((i) => i.idempotencyKey !== item.idempotencyKey), item];
  await save();
}

/** Renvoie les validations en attente ; garde celles qui échouent encore pour raison réseau. */
export async function flushQueue(): Promise<number> {
  if (queue.flushing || !queue.items.length || !state.token) return 0;
  queue.flushing = true;
  let sent = 0;
  try {
    for (const item of [...queue.items]) {
      try {
        await api().attendance.validate(item.enrollmentId, { idempotencyKey: item.idempotencyKey, method: "qr", deviceId: state.deviceId });
        sent++;
      } catch (error) {
        // Erreur réseau : on garde l'entrée. Erreur métier (déjà validé, session close…) : on l'abandonne.
        if (error instanceof ApiClientError && error.status === 0) continue;
      }
      queue.items = queue.items.filter((i) => i.idempotencyKey !== item.idempotencyKey);
      await save();
    }
  } finally {
    queue.flushing = false;
  }
  return sent;
}
