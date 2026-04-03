import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function StatWidget({ config, onConfigChange, lastRefresh, selectedHost, globalTimeRange }) {
  const [value, setValue] = useState(null);
  const [sparkData, setSparkData] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [items, setItems] = useState([]);

  const {
    host_id, item_id, unit = '', item_name = '',
    show_sparkline = true,
    thresholds = [
      { value: 80, color: '#eab308' },
      { value: 95, color: '#ef4444' },
    ],
  } = config || {};

  const effectiveHostId = selectedHost || host_id;

  // Carregar hosts
  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget').then(r => r.json()).then(d => setHosts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Carregar items
  useEffect(() => {
    if (!effectiveHostId) return;
    fetch(`/api/v1/metrics/${effectiveHostId}/items`).then(r => r.json()).then(setItems).catch(() => {});
  }, [effectiveHostId]);

  // Buscar valor atual + sparkline
  useEffect(() => {
    if (!effectiveHostId || !item_id) return;
    const load = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - (globalTimeRange || 3600);
        const selectedItem = items.find(i => i.itemid === item_id);
        const vt = selectedItem?.value_type || '0';
        const res = await fetch(`/api/v1/metrics/history?item_ids=${item_id}&value_type=${vt}&time_from=${from}&limit=60`);
        if (!res.ok) return;
        const history = await res.json();
        if (history.length > 0) {
          setValue(parseFloat(history[0].value));
          const sorted = [...history].sort((a, b) => parseInt(a.clock) - parseInt(b.clock));
          setSparkData(sorted.slice(-30).map(h => ({ v: parseFloat(h.value) || 0 })));
        }
      } catch {}
    };
    load();
  }, [effectiveHostId, item_id, lastRefresh, globalTimeRange, items]);

  const getColor = (val) => {
    if (val == null) return '#6b7280';
    let color = '#22c55e'; // green by default
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    for (const t of sorted) {
      if (val >= t.value) color = t.color;
    }
    return color;
  };

  // Config mode
  if (!host_id || !item_id) {
    return (
      <div className="p-3 h-full overflow-y-auto space-y-3">
        <div>
          <label className="text-xs text-dark-300 block mb-1">Dispositivo</label>
          <select value={host_id || ''} onChange={e => onConfigChange?.({ ...config, host_id: e.target.value, item_id: '' })}
            className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
            <option value="">Selecione...</option>
            {hosts.map(h => <option key={h.hostid} value={h.hostid}>{h.name}</option>)}
          </select>
        </div>
        {(host_id || effectiveHostId) && (
          <div>
            <label className="text-xs text-dark-300 block mb-1">Metrica</label>
            <select value={item_id || ''} onChange={e => {
              const it = items.find(i => i.itemid === e.target.value);
              onConfigChange?.({ ...config, item_id: e.target.value, item_name: it?.name || '', unit: it?.units || '' });
            }}
              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
              <option value="">Selecione...</option>
              {items.filter(i => ['0', '3'].includes(i.value_type)).map(it => (
                <option key={it.itemid} value={it.itemid}>{it.name} ({it.lastvalue} {it.units})</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  const color = getColor(value);

  return (
    <div className="flex flex-col items-center justify-center h-full px-3">
      <span className="text-[10px] text-dark-400 uppercase tracking-wider mb-1">{item_name}</span>
      <span className="text-3xl font-bold" style={{ color }}>
        {value !== null ? value.toFixed(1) : '--'}
      </span>
      {unit && <span className="text-xs text-dark-400">{unit}</span>}

      {show_sparkline && sparkData.length > 1 && (
        <div className="w-full mt-2" style={{ height: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
