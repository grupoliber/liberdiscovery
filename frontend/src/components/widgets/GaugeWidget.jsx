import { useState, useEffect } from 'react';

export default function GaugeWidget({ config, onConfigChange, lastRefresh, selectedHost }) {
  const [value, setValue] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [items, setItems] = useState([]);

  const {
    host_id, item_id, min = 0, max = 100, unit = '%', item_name = '',
    thresholds = [
      { value: 60, color: '#22c55e' },
      { value: 85, color: '#eab308' },
      { value: 100, color: '#ef4444' },
    ],
  } = config || {};

  const effectiveHostId = selectedHost || host_id;

  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget').then(r => r.json()).then(d => setHosts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!effectiveHostId) return;
    fetch(`/api/v1/metrics/${effectiveHostId}/items`).then(r => r.json()).then(setItems).catch(() => {});
  }, [effectiveHostId]);

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
  }, [item_id, lastRefresh]);

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
              onConfigChange?.({ ...config, item_id: e.target.value, item_name: it?.name || '', unit: it?.units || '%' });
            }} className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
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

  // Render threshold arcs
  const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
  const getColorForValue = (val) => {
    let color = '#22c55e';
    for (const t of sortedThresholds) {
      if (val >= t.value) color = t.color;
    }
    return color;
  };
  const needleColor = getColorForValue(value ?? 0);

  // Build arc segments for thresholds
  const arcSegments = [];
  let prevPct = 0;
  for (let i = 0; i < sortedThresholds.length; i++) {
    const tPct = Math.min(100, Math.max(0, ((sortedThresholds[i].value - min) / (max - min)) * 100));
    arcSegments.push({ from: prevPct, to: tPct, color: i === 0 ? '#22c55e' : sortedThresholds[i - 1]?.color || '#22c55e' });
    prevPct = tPct;
  }
  if (prevPct < 100) {
    arcSegments.push({ from: prevPct, to: 100, color: sortedThresholds[sortedThresholds.length - 1]?.color || '#ef4444' });
  }

  // SVG arc helper
  const arcPath = (startPct, endPct, r = 80) => {
    const startAngle = -180 + (startPct / 100) * 180;
    const endAngle = -180 + (endPct / 100) * 180;
    const x1 = 100 + r * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 100 + r * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 100 + r * Math.cos((endAngle * Math.PI) / 180);
    const y2 = 100 + r * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = (endPct - startPct) > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
        {/* Threshold colored arcs */}
        {arcSegments.map((seg, i) => (
          <path key={i} d={arcPath(seg.from, seg.to)} fill="none" stroke={seg.color} strokeWidth="10" strokeLinecap="round" opacity="0.3" />
        ))}
        {/* Value arc */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#333" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={needleColor}
          strokeWidth="12" strokeLinecap="round" strokeDasharray={`${pct * 2.51} 251`} />
        {/* Needle */}
        <line x1="100" y1="100"
          x2={100 + 60 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 60 * Math.sin((angle * Math.PI) / 180)}
          stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="100" cy="100" r="4" fill="white" />
      </svg>
      <span className="text-xl font-bold mt-1" style={{ color: needleColor }}>
        {value !== null ? value.toFixed(1) : '--'} {unit}
      </span>
      <span className="text-[10px] text-dark-400 mt-0.5">{item_name}</span>
    </div>
  );
}
