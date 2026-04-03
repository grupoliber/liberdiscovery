import { useState, useEffect } from 'react';

export default function StateTimelineWidget({ config, onConfigChange, lastRefresh, selectedHost, globalTimeRange }) {
  const [timelineData, setTimelineData] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const { host_ids = [] } = config || {};
  const effectiveIds = selectedHost ? [selectedHost] : host_ids;

  // Carregar hosts
  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget').then(r => r.json()).then(d => setHosts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Buscar dados de triggers para timeline
  useEffect(() => {
    if (effectiveIds.length === 0) return;
    const load = async () => {
      setLoading(true);
      try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - (globalTimeRange || 86400);

        // Buscar problems/events no periodo
        const res = await fetch(`/api/v1/alerts?severity_min=1&limit=500`);
        if (!res.ok) return;
        const allProblems = await res.json();

        // Buscar hosts ativos
        const hostRes = await fetch('/api/v1/devices?limit=500');
        const allHosts = hostRes.ok ? await hostRes.json() : [];

        const result = [];
        for (const hid of effectiveIds) {
          const hostInfo = allHosts.find(h => h.hostid === hid);
          const hostProblems = allProblems.filter(p =>
            p.hosts?.some(ph => ph.hostid === hid)
          );

          // Construir segmentos de timeline
          const segments = [];
          let lastTs = from;
          let currentState = 0; // 0=up

          // Ordenar problemas por clock
          const sorted = [...hostProblems].sort((a, b) => parseInt(a.clock) - parseInt(b.clock));

          for (const p of sorted) {
            const ts = parseInt(p.clock);
            if (ts < from || ts > now) continue;

            if (ts > lastTs) {
              segments.push({ start: lastTs, end: ts, state: currentState });
            }

            const sev = parseInt(p.severity || 0);
            currentState = sev >= 4 ? 2 : sev >= 2 ? 1 : 0; // 2=critical, 1=warning, 0=ok
            lastTs = ts;
          }

          // Segmento final ate agora
          segments.push({ start: lastTs, end: now, state: currentState });

          result.push({
            hostId: hid,
            name: hostInfo?.name || `Host ${hid}`,
            segments,
          });
        }

        setTimelineData(result);
      } catch (e) {
        console.warn('Timeline error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [effectiveIds.join(','), lastRefresh, globalTimeRange]);

  const STATE_COLORS = ['#22c55e', '#eab308', '#ef4444']; // up, warning, critical
  const STATE_LABELS = ['Ativo', 'Aviso', 'Problema'];

  // Config mode - selecionar hosts
  if (host_ids.length === 0 && !selectedHost) {
    return (
      <div className="p-3 h-full overflow-y-auto">
        <label className="text-xs text-dark-300 block mb-2">Selecionar Hosts para Timeline</label>
        <div className="max-h-48 overflow-y-auto bg-dark-800 rounded border border-dark-600 p-2 space-y-1">
          {hosts.map(h => (
            <label key={h.hostid} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-dark-700 rounded px-1 py-0.5">
              <input type="checkbox"
                checked={(config?.host_ids || []).includes(h.hostid)}
                onChange={e => {
                  const current = config?.host_ids || [];
                  const newIds = e.target.checked
                    ? [...current, h.hostid]
                    : current.filter(id => id !== h.hostid);
                  onConfigChange?.({ ...config, host_ids: newIds });
                }}
                className="rounded" />
              <span className="text-dark-200">{h.name}</span>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-dark-500 mt-2">Ou use o filtro de host na toolbar para selecionar um host global.</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-full text-dark-400 text-xs">Carregando...</div>;

  const totalSpan = globalTimeRange || 86400;

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {timelineData.map(host => (
          <div key={host.hostId} className="flex items-center gap-2">
            <span className="text-xs text-dark-300 w-28 truncate shrink-0" title={host.name}>{host.name}</span>
            <div className="flex-1 h-5 rounded overflow-hidden flex bg-dark-700">
              {host.segments.map((seg, i) => {
                const width = ((seg.end - seg.start) / totalSpan) * 100;
                if (width < 0.1) return null;
                return (
                  <div key={i} style={{ width: `${width}%`, backgroundColor: STATE_COLORS[seg.state] }}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    title={`${STATE_LABELS[seg.state]}: ${new Date(seg.start * 1000).toLocaleTimeString('pt-BR')} - ${new Date(seg.end * 1000).toLocaleTimeString('pt-BR')}`} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Legenda */}
      <div className="flex gap-4 mt-2 pt-2 border-t border-dark-700 shrink-0">
        {STATE_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATE_COLORS[i] }} />
            <span className="text-[10px] text-dark-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
