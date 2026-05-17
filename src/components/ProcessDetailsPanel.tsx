import { useQuery } from "@tanstack/react-query";
import { getProcessDetails } from "../lib/api";
import type { ProcessDetails } from "../types";

interface Props {
  pid: number;
  onClose: () => void;
  onKill: () => void;
}

export function ProcessDetailsPanel({ pid, onClose, onKill }: Props) {
  const query = useQuery<ProcessDetails, Error>({
    queryKey: ["process-details", pid],
    queryFn: () => getProcessDetails(pid),
    refetchInterval: 2000,
    staleTime: 500,
  });

  return (
    <aside className="detail-panel" role="dialog" aria-label="Details du processus">
      <header className="detail-panel__header">
        <div>
          <h3>Process #{pid}</h3>
          {query.data && (
            <p className="detail-panel__name">{query.data.name}</p>
          )}
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>
      </header>

      <div className="detail-panel__body">
        {query.isLoading && <p className="muted">Chargement…</p>}
        {query.error && (
          <div className="error" role="alert">
            {query.error.message}
          </div>
        )}
        {query.data && <DetailsTable d={query.data} />}
      </div>

      <footer className="detail-panel__footer">
        <span className="muted">Rafraichi toutes les 2s</span>
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={onKill}
        >
          Kill ce process
        </button>
      </footer>
    </aside>
  );
}

function DetailsTable({ d }: { d: ProcessDetails }) {
  const memMb = (d.memoryBytes / 1024 / 1024).toFixed(1);
  const vmemMb = (d.virtualMemoryBytes / 1024 / 1024).toFixed(1);
  const startDate = new Date(d.startTime * 1000);
  const runTimeFmt = formatDuration(d.runTime);

  return (
    <dl className="detail-list">
      <Row k="PID" v={String(d.pid)} mono />
      <Row k="Nom" v={d.name} />
      <Row k="Exe" v={d.exe ?? "—"} mono />
      <Row k="CWD" v={d.cwd ?? "—"} mono />
      <Row k="Parent" v={d.parentName ? `${d.parentName} (PID ${d.parentPid})` : "—"} />
      <Row k="CPU" v={`${d.cpuUsage.toFixed(1)} %`} />
      <Row k="RAM physique" v={`${memMb} Mo`} />
      <Row k="RAM virtuelle" v={`${vmemMb} Mo`} />
      <Row k="Demarre" v={startDate.toLocaleString()} />
      <Row k="Tourne depuis" v={runTimeFmt} />
      <Row
        k="Ligne de commande"
        v={d.cmd.length ? d.cmd.join(" ") : "(indisponible)"}
        mono
        block
      />
    </dl>
  );
}

function Row({
  k,
  v,
  mono,
  block,
}: {
  k: string;
  v: string;
  mono?: boolean;
  block?: boolean;
}) {
  return (
    <>
      <dt>{k}</dt>
      <dd
        className={[mono ? "mono" : "", block ? "detail-list__block" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {v}
      </dd>
    </>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
