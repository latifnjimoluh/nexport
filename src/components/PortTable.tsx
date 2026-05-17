import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
  type OnChangeFn,
} from "@tanstack/react-table";
import {
  copyToClipboard,
  openCwd,
  openInBrowser,
  openProcessFolder,
} from "../lib/api";
import { GeoBadge } from "./GeoBadge";
import { useFavorites } from "../store/favorites";
import { useTableState } from "../store/table";
import { sound } from "../lib/sound";
import type { PortRow } from "../types";

interface Props {
  rows: PortRow[];
  onKill: (row: PortRow) => void;
  onNotify?: (msg: string) => void;
  onShowDetails?: (pid: number) => void;
  onBlockPort?: (port: number, protocol: string) => void;
  blockedSet?: Set<string>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

const columnHelper = createColumnHelper<PortRow>();

export function PortTable({
  rows,
  onKill,
  onNotify,
  onShowDetails,
  onBlockPort,
  blockedSet,
  rowSelection,
  onRowSelectionChange,
}: Props) {
  const favorites = useFavorites((s) => s.favorites);
  const toggleFavorite = useFavorites((s) => s.toggle);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "openedAt", desc: true },
  ]);
  const columnSizing = useTableState((s) => s.columnSizing);
  const setColumnSizing = useTableState((s) => s.setColumnSizing);

  const sortedRows = useMemo(() => {
    if (favSet.size === 0) return rows;
    return [...rows].sort((a, b) => {
      const af = favSet.has(a.port) ? 0 : 1;
      const bf = favSet.has(b.port) ? 0 : 1;
      return af - bf;
    });
  }, [rows, favSet]);

  const handleCopy = async (value: string, label: string) => {
    sound.click();
    try {
      await copyToClipboard(value);
      onNotify?.(`${label} copié`);
    } catch (e) {
      onNotify?.(
        `copie impossible: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleOpen = async (path: string) => {
    sound.click();
    try {
      await openProcessFolder(path);
    } catch (e) {
      onNotify?.(
        `ouverture impossible: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleOpenCwd = async (cwd: string) => {
    sound.click();
    try {
      await openCwd(cwd);
    } catch (e) {
      onNotify?.(
        `ouverture impossible: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        size: 32,
        enableSorting: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            className="row-checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Tout selectionner"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="row-checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Selectionner ${row.original.port}`}
          />
        ),
      }),
      columnHelper.display({
        id: "fav",
        header: "",
        size: 30,
        cell: (info) => {
          const row = info.row.original;
          const active = favSet.has(row.port);
          return (
            <button
              type="button"
              className={`star ${active ? "star--on" : ""}`}
              onClick={() => toggleFavorite(row.port)}
              title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              {active ? "★" : "☆"}
            </button>
          );
        },
      }),
      columnHelper.accessor("port", {
        header: "Port",
        size: 70,
        minSize: 60,
        cell: (info) => <span className="mono">{info.getValue()}</span>,
      }),
      columnHelper.accessor("protocol", { header: "Proto", size: 60, minSize: 50 }),
      columnHelper.accessor("family", {
        header: "Famille",
        size: 70,
        minSize: 60,
        enableSorting: false,
      }),
      columnHelper.accessor("state", {
        header: "État",
        size: 90,
        minSize: 80,
        cell: (info) => {
          const s = info.getValue();
          const remote = info.row.original.remoteAddr;
          return (
            <div className="state-cell">
              <span className={`state state--${s.toLowerCase()}`}>{s}</span>
              {remote && (
                <div className="remote-addr" title={`Connecté à ${remote}`}>
                  → {remote}
                  <GeoBadge remoteAddr={remote} />
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("risk", {
        header: "Sécurité",
        size: 100,
        minSize: 80,
        cell: (info) => {
          const risk = info.getValue();
          if (risk.level === "SAFE") return <span className="risk-safe">Sûr</span>;
          return (
            <span
              className={`risk-badge risk-badge--${risk.level.toLowerCase()}`}
              title={risk.reason ?? ""}
            >
              {risk.level === "DANGER" ? "⚠️ Danger" : "⚠ Alerte"}
            </span>
          );
        },
      }),
      columnHelper.accessor("pid", {
        header: "PID",
        size: 70,
        minSize: 60,
        cell: (info) => (
          <span className="mono">{info.getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("processName", {
        header: "Process",
        size: 120,
        minSize: 100,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="cell-truncate">
              {row.processName ?? <span className="muted">inconnu</span>}
              {row.framework && (
                <span className="badge badge--framework" title={`Detecte : ${row.framework}`}>
                  {row.framework}
                </span>
              )}
              {row.requiresAdmin && (
                <span className="badge" title="Droits admin requis">
                  admin
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("processPath", {
        header: "Chemin",
        size: 150,
        minSize: 100,
        enableSorting: false,
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className="path" title={v ?? ""}>
              {v ?? <span className="muted">—</span>}
            </span>
          );
        },
      }),
      columnHelper.accessor("openedAt", {
        header: "Ouvert",
        size: 90,
        minSize: 80,
        cell: (info) => {
          const ts = info.getValue();
          if (ts === 0) return <span className="muted">—</span>;
          const date = new Date(ts * 1000);
          return (
            <span className="mono text-xs" title={date.toLocaleString()}>
              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="ports__actions">Actions</span>,
        size: 280,
        minSize: 260,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="ports__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={row.pid === null}
                onClick={() =>
                  row.pid !== null && handleCopy(String(row.pid), "PID")
                }
                title="Copier le PID"
              >
                Copier
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!row.processPath}
                onClick={() =>
                  row.processPath && handleOpen(row.processPath)
                }
                title={row.processPath ?? "Chemin de l'exécutable indisponible"}
              >
                Exe
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!row.processCwd}
                onClick={() =>
                  row.processCwd && handleOpenCwd(row.processCwd)
                }
                title={
                  row.processCwd ??
                  "Dossier de travail indisponible (droits admin requis ?)"
                }
              >
                Projet
              </button>
              {(row.port === 80 || row.port === 443 || row.port === 3000 || row.port === 5173 || row.port === 8080) && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    sound.click();
                    const proto = row.port === 443 ? "https" : "http";
                    openInBrowser(`${proto}://localhost:${row.port}`);
                  }}
                  title={`Ouvrir http://localhost:${row.port} dans le navigateur`}
                >
                  🌐 Web
                </button>
              )}
              {onShowDetails && (
                <button
                  type="button"
                  className="btn--ghost btn--sm"
                  disabled={row.pid === null}
                  onClick={() => {
                    sound.click();
                    row.pid !== null && onShowDetails(row.pid);
                  }}
                  title="Voir les details du process"
                >
                  ℹ
                </button>
              )}
              {onBlockPort && (() => {
                const isBlocked = blockedSet?.has(`${row.protocol}:${row.port}`);
                return (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => onBlockPort(row.port, row.protocol)}
                    title={
                      isBlocked
                        ? "Deja bloque (debloquer via Settings)"
                        : "Bloquer ce port via pare-feu Windows (admin requis)"
                    }
                    disabled={isBlocked}
                  >
                    {isBlocked ? "🛡✓" : "🛡"}
                  </button>
                );
              })()}
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={row.pid === null}
                onClick={() => onKill(row)}
              >
                Kill
              </button>
            </div>
          );
        },
      }),
    ],
    [onKill, favSet, toggleFavorite, onShowDetails, onBlockPort, blockedSet],
  );

  const table = useReactTable({
    data: sortedRows,
    columns,
    state: { sorting, columnSizing, rowSelection },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange,
    enableRowSelection: (row) => row.original.pid !== null,
    columnResizeMode: "onChange",
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (sortedRows.length === 0) {
    return <div className="empty">Aucun port à afficher.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="ports" style={{ width: "100%", minWidth: table.getTotalSize() }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const sorted = h.column.getIsSorted();
                const size = h.getSize();
                return (
                  <th
                    key={h.id}
                    style={{ 
                      width: h.column.id === "processPath" ? "auto" : size,
                      minWidth: h.column.columnDef.minSize,
                    }}
                    className="resizable-th"
                  >
                    <div className="th-content">
                      {canSort ? (
                        <button
                          type="button"
                          className="th-btn"
                          onClick={() => {
                            sound.click();
                            h.column.toggleSorting();
                          }}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          {sorted === "asc" && " ▲"}
                          {sorted === "desc" && " ▼"}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </div>
                    {h.column.getCanResize() && (
                      <div
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        className={`resizer ${
                          h.column.getIsResizing() ? "isResizing" : ""
                        }`}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => {
            const isFav = favSet.has(r.original.port);
            const cls = [
              r.original.requiresAdmin ? "row--admin" : "",
              isFav ? "row--fav" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr 
                key={r.id} 
                className={cls}
                onDoubleClick={() => {
                  const info = `${r.original.protocol} ${r.original.port} - ${r.original.processName ?? "Inconnu"} (PID: ${r.original.pid})`;
                  handleCopy(info, "Infos processus");
                }}
                title="Double-cliquez pour copier les infos de la ligne"
              >
                {r.getVisibleCells().map((c) => (
                  <td
                    key={c.id}
                    style={{
                      width: c.column.id === "processPath" ? "auto" : c.column.getSize(),
                      minWidth: c.column.columnDef.minSize,
                    }}
                  >
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
