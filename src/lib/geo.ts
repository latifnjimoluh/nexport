// Geolocalisation d'IP via ipwho.is (HTTPS, gratuit, sans cle, ~10k req/mois).
// Cache react-query (24h staleTime) evite les requetes redondantes.

export interface GeoInfo {
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isp: string | null;
}

/**
 * Extrait l'IP d'une chaine "1.2.3.4:5678" ou "[::1]:443".
 * Retourne null si pas une IP valide.
 */
export function extractIP(remoteAddr: string | null): string | null {
  if (!remoteAddr) return null;
  // IPv6 entre crochets : [::1]:443
  if (remoteAddr.startsWith("[")) {
    const end = remoteAddr.indexOf("]");
    if (end > 0) return remoteAddr.slice(1, end);
    return null;
  }
  // IPv4 : 1.2.3.4:5678
  const colon = remoteAddr.lastIndexOf(":");
  return colon > 0 ? remoteAddr.slice(0, colon) : remoteAddr;
}

/**
 * IPs internes/locales pour lesquelles la geolocalisation n'a pas de sens.
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return true;
  // Localhost
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0" || ip === "::") return true;
  // IPv4 prive (RFC1918) + loopback
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true; // link-local
  if (/^127\./.test(ip)) return true;
  // IPv6 unique-local + link-local + multicast
  if (/^[fF][cCdD]/.test(ip)) return true;
  if (/^[fF][eE]80/.test(ip)) return true;
  return false;
}

export async function lookupIP(ip: string): Promise<GeoInfo | null> {
  try {
    const res = await fetch(`https://ipwho.is/${ip}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.success === false) return null;
    return {
      ip: data.ip ?? ip,
      country: data.country ?? null,
      countryCode: data.country_code ?? null,
      city: data.city ?? null,
      isp: data.connection?.isp ?? data.connection?.org ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Convertit "FR" en emoji drapeau 🇫🇷 (regional indicators).
 */
export function countryCodeToFlag(cc: string | null): string {
  if (!cc || cc.length !== 2) return "🏳";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - a),
    A + (cc.charCodeAt(1) - a),
  );
}
