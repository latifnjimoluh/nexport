import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { isTauri } from "./api";

let permissionPromise: Promise<boolean> | null = null;

async function ensurePermission(): Promise<boolean> {
  if (!isTauri) return false;
  if (!permissionPromise) {
    permissionPromise = (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const res = await requestPermission();
        granted = res === "granted";
      }
      return granted;
    })();
  }
  return permissionPromise;
}

export async function notify(title: string, body: string): Promise<void> {
  if (!isTauri) {
    console.log(`[mock notify] ${title} — ${body}`);
    return;
  }
  const granted = await ensurePermission();
  if (!granted) return;
  sendNotification({ title, body });
}
