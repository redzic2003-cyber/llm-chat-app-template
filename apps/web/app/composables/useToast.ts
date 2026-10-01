export interface Toast {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

let nextId = 1;

export function useToast() {
  const toasts = useState<Toast[]>("toasts", () => []);

  function push(tone: Toast["tone"], message: string, timeout = 4000) {
    const id = nextId++;
    toasts.value = [...toasts.value, { id, tone, message }];
    setTimeout(() => dismiss(id), timeout);
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    dismiss,
    success: (m: string) => push("success", m),
    error: (m: string | unknown) => push("error", typeof m === "string" ? m : errorMessage(m), 6000),
    info: (m: string) => push("info", m),
  };
}
