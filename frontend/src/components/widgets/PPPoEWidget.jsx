import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Wifi } from 'lucide-react';

export default function PPPoEWidget({ config, onConfigChange, lastRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [hosts, setHosts] = useState([]);

  const { host_id, show_breakdown = true } = config || {};

  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget').then(r => r.json()).then(d => setHosts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!host_id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/devices/${host_id}/pppoe-stats`);
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, [host_id]);

  useEffect(() => { loadData(); }, [loadData, lastRefresh]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!host_id) return;
    const timer = setInterval(loadData, 60000);
    return () => clearInterval(timer);
  }, [host_id, loadData]);

  if (!host_id || showConfig) {
    return (
      <div className="p-3 h-full overflow-y-auto space-y-3">
        <div>
          <label className="text-xs text-dark-300 block mb-1">Dispositivo (Huawei com PPPoE)</label>
          <select value={host_id || ''} onChange={e => onConfigChange?.({ ...config, host_id: e.target.value })}
            className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
            <option value="">Selecione...</option>
            {hosts.map(h => <option key={h.hostid} value={h.hostid}>{h.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-dark-200 cursor-pointer">
          <input type="checkbox" checked={show_breakdown} onChange={e => onConfigChange?.({ ...config, show_breakdown: e.target.checked })} className="rounded" />
          Mostrar detalhamento por interface
        </label>
        {host_id && (
          <button onClick={() => setShowConfig(false)} className="w-full bg-accent-green text-white py-1.5 rounded text-xs hover:opacity-90">Ver Widget</button>
        )}
      </div>
    );
  }

  if (!data) {
    return <div className="flex items-center justify-center h-full text-dark-400 text-sm">{loading ? 'Carregando...' : 'Sem dados'}</div>;
  }

  const totalSessions = data.total_sessions || 0;
  const interfaces = data.by_interface || {};
  const ifaceEntries = Object.entries(interfaces).sort((a, b) => b[1].sessions - a[1].sessions);

  return (
    <div className="h-full flex flex-col p-3">
      {/* Big number */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="text-accent-green" size={20} />
          <span className="text-dark-300 text-xs">Total clientes logados</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadData} className="text-dark-500 hover:text-dark-300" title="Atualizar">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowConfig(true)} className="text-[10px] text-dark-400 hover:text-dark-200">Configurar</button>
        </div>
      </div>
      <div className="text-center py-2">
        <span className="text-5xl font-bold text-accent-green tabular-nums">{totalSessions.toLocaleString('pt-BR')}</span>
      </div>

      {/* Breakdown by interface */}
      {show_breakdown && ifaceEntries.length > 0 && (
        <div className="flex-1 overflow-y-auto mt-2 space-y-1.5">
          <p className="text-[10px] text-dark-400 uppercase tracking-wider">Por Interface</p>
          {ifaceEntries.map(([name, info]) => {
            const pct = totalSessions > 0 ? (info.sessions / totalSessions * 100) : 0;
            return (
              <div key={name} className="bg-dark-800 rounded px-2 py-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-dark-200 truncate flex-1">{name}</span>
                  <span className="text-xs font-semibold text-white ml-2">{info.sessions.toLocaleString('pt-BR')}</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-1">
                  <div className="bg-accent-green h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
