// Hash PIN cote client via Web Crypto API (SHA-256).
// Le hash est stocke dans settings.json. Comme l'app est locale,
// ceci protege contre les clics accidentels, pas contre un attaquant
// avec acces fichier (qui peut juste editer settings.json directement).

export async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
