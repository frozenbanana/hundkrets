import { createSignal } from "solid-js";

export type ToastMessage = { id: number; text: string; type: "success" | "error" };

const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
let nextId = 0;
const timeouts = new Map<number, ReturnType<typeof setTimeout>>();

export function getToasts() {
  return toasts;
}

export function showToast(text: string, type: "success" | "error" = "success") {
  const id = ++nextId;
  setToasts((prev) => [...prev, { id, text, type }]);

  const timeout = setTimeout(() => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    timeouts.delete(id);
  }, 3000);
  timeouts.set(id, timeout);
}

export function dismissToast(id: number) {
  const timeout = timeouts.get(id);
  if (timeout) clearTimeout(timeout);
  timeouts.delete(id);
  setToasts((prev) => prev.filter((toast) => toast.id !== id));
}
