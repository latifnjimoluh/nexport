import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { listEvents, listPorts } from "../lib/api";
import { useTranslation } from "../lib/i18n";
import { sound } from "../lib/sound";
import type { EventRow, PortRow } from "../types";

type RangeKey = "1h" | "12h" | "24h" | "1w" | "1m";

const RANGES: { key: RangeKey; seconds: number }[] = [
  { key: "1h", seconds: 3600 },
  { key: "12h", seconds: 12 * 3600 },
  { key: "24h", seconds: 24 * 3600 },
  { key: "1w", seconds: 7 * 24 * 3600 },
  { key: "1m", seconds: 30 * 24 * 3600 },
];

export function DashboardView() {
  const { t } = useTranslation();
  const [rangeKey, setRangeKey] = useState<RangeKey>("24h");

  const currentRange = useMemo(() => RANGES.find(r => r.key === rangeKey)!, [rangeKey]);

  const portsQuery = useQuery<PortRow[], Error>({
    queryKey: ["ports"],
    queryFn: listPorts,
  });

  const eventsQuery = useQuery<EventRow[], Error>({
    queryKey: ["events", { limit: 5000 }],
    queryFn: () => listEvents({ limit: 5000 }),
  });

  const ports = portsQuery.data ?? [];
  const events = eventsQuery.data ?? [];

  // 1. Top Processes (by current port count)
  const topProcesses = useMemo(() => {
    const counts: Record<string, number> = {};
    ports.forEach((p) => {
      const name = p.processName || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [ports]);

  // 2. Port Usage Over Time
  const usageOverTime = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const since = now - currentRange.seconds;
    
    // Grouping strategy based on range
    let points = 24;
    let step = currentRange.seconds / points;
    
    const data: Record<string, number> = {};
    const labels: string[] = [];

    for (let i = 0; i < points; i++) {
      const ts = since + i * step;
      const d = new Date(ts * 1000);
      let label = "";
      
      if (currentRange.key === "1h") {
        label = d.getMinutes() + "m";
      } else if (currentRange.key === "1w" || currentRange.key === "1m") {
        label = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
      } else {
        label = d.getHours() + "h";
      }
      
      if (!labels.includes(label)) {
        labels.push(label);
        data[label] = 0;
      }
    }

    events.forEach((e) => {
      if (e.ts < since) return;
      const d = new Date(e.ts * 1000);
      let label = "";
      if (currentRange.key === "1h") {
        label = d.getMinutes() + "m";
      } else if (currentRange.key === "1w" || currentRange.key === "1m") {
        label = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
      } else {
        label = d.getHours() + "h";
      }
      
      if (data[label] !== undefined) {
        data[label]++;
      }
    });

    return labels.map(l => ({ time: l, count: data[l] }));
  }, [events, currentRange]);

  // 3. Stats Summary (within range)
  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const since = now - currentRange.seconds;
    
    const rangeEvents = events.filter(e => e.ts >= since);
    const killed = rangeEvents.filter((e) => e.kind === "killed").length;
    const opened = rangeEvents.filter((e) => e.kind === "opened").length;
    
    return {
      totalActive: ports.length,
      totalEvents: rangeEvents.length,
      totalKilled: killed,
      totalOpened: opened,
    };
  }, [ports, events, currentRange]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="toolbar__group">
          <span className="toolbar__select-label" style={{ alignSelf: "center", marginRight: 8 }}>{t("time_range")}</span>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`chip ${rangeKey === r.key ? "chip--active" : ""}`}
              onClick={() => {
                sound.click();
                setRangeKey(r.key);
              }}
            >
              {t(`range_${r.key}` as any)}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard__grid">
        <div className="dashboard__card dashboard__card--stats">
          <div className="stat-box">
            <span className="stat-box__label">{t("active_now")}</span>
            <span className="stat-box__value">{stats.totalActive}</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">{t("total_ports")}</span>
            <span className="stat-box__value">{stats.totalOpened}</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">{t("blocked_connections")}</span>
            <span className="stat-box__value">{stats.totalKilled}</span>
          </div>
        </div>

        <div className="dashboard__card">
          <h3>{t("port_usage_over_time")}</h3>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={usageOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="time" stroke="#888" fontSize={10} interval="preserveStartEnd" />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#222", border: "1px solid #444" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#0088FE" 
                  strokeWidth={2}
                  dot={usageOverTime.length < 50 ? { r: 3 } : false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard__card">
          <h3>{t("top_processes")}</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={topProcesses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis type="number" stroke="#888" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#888" fontSize={10} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#222", border: "1px solid #444" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topProcesses.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard {
          padding: 20px;
          color: var(--text-color);
          overflow-y: auto;
          flex: 1;
        }
        .dashboard__header {
          margin-bottom: 20px;
          display: flex;
          justify-content: flex-end;
        }
        .dashboard__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
        }
        .dashboard__card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .dashboard__card h3 {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 1.1rem;
          color: var(--text-muted);
        }
        .dashboard__card--stats {
          display: flex;
          justify-content: space-around;
          align-items: center;
          grid-column: 1 / -1;
        }
        .stat-box {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-box__label {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 5px;
        }
        .stat-box__value {
          font-size: 2rem;
          font-weight: bold;
          color: var(--primary-color);
        }
      `}</style>
    </div>
  );
}
