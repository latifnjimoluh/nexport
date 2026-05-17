import { useQuery } from "@tanstack/react-query";
import {
  countryCodeToFlag,
  extractIP,
  isPrivateIP,
  lookupIP,
} from "../lib/geo";

interface Props {
  remoteAddr: string;
}

/**
 * Affiche un drapeau + ville/pays pour une IP distante publique.
 * - IPs privees / locales : rien (geo non pertinente)
 * - Erreur reseau : silencieux (pas de UI bruyante)
 * - Cache React Query 24h pour eviter de spammer l'API
 */
export function GeoBadge({ remoteAddr }: Props) {
  const ip = extractIP(remoteAddr);
  const enabled = !!ip && !isPrivateIP(ip);

  const { data } = useQuery({
    queryKey: ["geo", ip],
    queryFn: () => lookupIP(ip!),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (!enabled) return null;
  if (!data || !data.countryCode) return null;

  const label = [data.city, data.country].filter(Boolean).join(", ");
  return (
    <span
      className="geo-badge"
      title={`${label}${data.isp ? ` · ${data.isp}` : ""}`}
    >
      {countryCodeToFlag(data.countryCode)} {data.countryCode}
    </span>
  );
}
