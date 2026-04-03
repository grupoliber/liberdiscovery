import { useState, useEffect } from 'react';

export default function GaugeWidget({ config, onConfigChange }) {
  const [value, setValue] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [items, setItems] = useState([]);

  const { host_id, item_id, min = 0, max = 100, unit = '%', item_name = '' } = config || {};

  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget').then(r => r.json()).then(setHosts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!host_id) return;
    fetch(`/api/v1/metrics/${host_id}/items`).then(r => r.json()).then(setItems).catch(() => {});
  }, [host_id]);

  useEffect(() => {
    if (!item_id) return;
    const load = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const res = await fetch(`/api/v1/metrics/history?item_ids=${item_id}&value_type=0&time_from=${now - 300}&limit=1`);
        const data = await res.json();
        if (data.length > 0) setValue(parseFloat(data[0].value));
      } catch {}
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [item_id]);

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
        {host_id && (
          <div>
            <label className="text-xs text-dark-300 block mb-1">Métrica</label>
            <select value={item_id || ''} onChange={e => {
              const it = items.find(i => i.itemid === e.target.value);
              onConfigChange?.({ ...config, item_id: e.target.value, item_name: it?.name || '', unit: it?.units || '%' });
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

  const pct = Math.min(100, Math.max(0, ((value ?? 0) - min) / (max - min) * 100));
  const angle = -90 + (pct / 100) * 180;
  const color = pct < 60 ? '#22c55e' : pct < 85 ? '#eab308' : '#ef4444';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
        {/* Background arc */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#333" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${pct * 2.51} 251`}
        />
        {/* Needle */}
        <line
          x1="100" y1="100"
          x2={100 + 60 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 60 * Math.sin((angle * Math.PI) / 180)}
          stroke="white" strokeWidth="2" strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="4" fill="white" />
      </svg>
      <span className="text-xl font-bold mt-1">{value !== null ? value.toFixed(1) : '—'} {unit}</span>
      <span className="text-[10px] text-dark-400 mt-0.5">{item_name}</span>
    </div>
  );
}
