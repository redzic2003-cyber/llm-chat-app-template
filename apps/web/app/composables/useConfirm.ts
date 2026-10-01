export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Champ texte optionnel (ex. motif d'annulation). */
  input?: { label: string; placeholder?: string };
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (result: { ok: boolean; value: string }) => void;
}

/** Boîte de confirmation asynchrone, rendue par <ConfirmHost /> dans les layouts. */
export function useConfirm() {
  const pending = useState<PendingConfirm | null>("confirm", () => null);

  function ask(request: ConfirmRequest): Promise<{ ok: boolean; value: string }> {
    return new Promise((resolve) => {
      pending.value = { ...request, resolve };
    });
  }

  async function confirm(request: ConfirmRequest): Promise<boolean> {
    return (await ask(request)).ok;
  }

  function settle(ok: boolean, value = "") {
    pending.value?.resolve({ ok, value });
    pending.value = null;
  }

  return { pending, ask, confirm, settle };
}
