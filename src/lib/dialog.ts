import { ask, message } from "@tauri-apps/plugin-dialog";
import { isTauri } from "./api";

export interface ConfirmOptions {
  readonly title?: string;
  readonly okLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
}

export async function confirmAction(
  body: string,
  opts: ConfirmOptions = {},
): Promise<boolean> {
  if (isTauri) {
    return ask(body, {
      title: opts.title ?? "Confirmation",
      kind: opts.destructive ? "warning" : "info",
      okLabel: opts.okLabel,
      cancelLabel: opts.cancelLabel,
    });
  }
  return window.confirm(
    opts.title ? `${opts.title}\n\n${body}` : body,
  );
}

export async function showError(title: string, body: string): Promise<void> {
  if (isTauri) {
    await message(body, { title, kind: "error" });
    return;
  }
  window.alert(`${title}\n\n${body}`);
}
