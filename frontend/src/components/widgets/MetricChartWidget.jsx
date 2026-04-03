import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, ReferenceLine, ReferenceArea, Legend,
} from 'recharts';
import { Pencil, Check, X } from 'lucide-react';

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7', '#eab308', '#06b6d4', '#ec4899'];

const TIME_RANGES = {
  '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '3h': 10800, '6h': 21600,
  '12h': 43200, '24h': 86400, '7d': 604800,
};

export default function MetricChartWidget({ config, onConfigChange, lastRefresh, selectedHost, globalTimeRange, globalTimeRangeKey }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [editValue, setEditValue] = useState('');

  const {
    host_id, item_ids = [], chart_type = 'line',
    time_range = 'global', item_names = {},
    item_names_original = {},
    thresholds = [],
  } = config || {};

  const effectiveHostId = selectedHost || host_id;
  const effectiveTimeRange = time_range === 'global'
    ? globalTimeRange
    : (TIME_RANGES[time_range] || 3600);

  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget').then(r => r.json()).then(d => setHosts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!effectiveHostId) return;
    fetch(`/api/v1/metrics/${effectiveHostId}/items`).then(r => r.json()).then(setItems).catch(() => {});
  }, [effectiveHostId]);

  const loadHistory = useCallback(async () => {
    if (!item_ids.length) return;
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - effectiveTimeRange;
      const selectedItems = items.filter(it => item_ids.includes(it.itemid));
      const valueType = selectedItems[0]?.value_type || '0';
      const res = await fetch(`/api/v1/metrics/history?item_ids=${item_ids.join(',')}&value_type=${valueType}&time_from=${from}&limit=2000`);
      if (!res.ok) return;
      const history = await res.json();
      // Determine bucket size based on time range (align timestamps)
      const bucketSize = effectiveTimeRange <= 3600 ? 30 : effectiveTimeRange <= 86400 ? 60 : 300;
      const allLabels = item_ids.map(id => item_names[id] || id);
      const grouped = {};
      history.forEach(h => {
        const ts = Math.round(parseInt(h.clock) / bucketSize) * bucketSize;
        if (!grouped[ts]) {
          grouped[ts] = { time: ts };
          // Initialize all series to null
          allLabels.forEach(l => { grouped[ts][l] = null; });
        }
        const label = item_names[h.itemid] || h.itemid;
        const val = parseFloat(h.value) || 0;
        // Keep the latest value per bucket
        grouped[ts][label] = val;
      });
      // Forward-fill nulls: carry last known value forward for smooth lines
      const sorted = Object.values(grouped).sort((a, b) => a.time - b.time);
      const lastKnown = {};
      sorted.forEach(point => {
        allLabels.forEach(label => {
          if (point[label] !== null && point[label] !== undefined) {
            lastKnown[label] = point[label];
          } else if (lastKnown[label] !== undefined) {
            point[label] = lastKnown[label];
          }
        });
      });
      setChartData(sorted);
    } catch {} finally { setLoading(false); }
  }, [item_ids, effectiveTimeRange, items, item_names]);

  useEffect(() => { loadHistory(); }, [loadHistory, lastRefresh]);

  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Start editing a label
  const startEditLabel = (itemId) => {
    setEditingLabel(itemId);
    setEditValue(item_names[itemId] || '');
  };

  // Save edited label
  const saveLabel = (itemId) => {
    if (!editValue.trim()) { setEditingLabel(null); return; }
    const newNames = { ...item_names, [itemId]: editValue.trim() };
    // Save original name if not already saved
    const newOriginals = { ...item_names_original };
    if (!newOriginals[itemId]) {
      // Find from items list or use current name as original
      const it = items.find(i => i.itemid === itemId);
      newOriginals[itemId] = it?.name || item_names[itemId] || itemId;
    }
    onConfigChange?.({ ...config, item_names: newNames, item_names_original: newOriginals });
    setEditingLabel(null);
  };

  // Reset label to original
  const resetLabel = (itemId) => {
    const originalName = item_names_original[itemId];
    if (originalName) {
      const newNames = { ...item_names, [itemId]: originalName };
      onConfigChange?.({ ...config, item_names: newNames });
    }
    setEditingLabel(null);
  };

  // CONFIG PANEL
  if (!effectiveHostId || showConfig) {
    return (
      <div className="p-3 h-full overflow-y-auto space-y-3">
        <div>
          <label className="text-xs text-dark-300 block mb-1">Dispositivo</label>
          <select value={host_id || ''} onChange={e => onConfigChange?.({ ...config, host_id: e.target.value, item_ids: [], item_names: {}, item_names_original: {} })}
            className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
            <option value="">Selecione...</option>
            {hosts.map(h => <option key={h.hostid} value={h.hostid}>{h.name}</option>)}
          </select>
        </div>
        {(host_id || effectiveHostId) && (
          <>
            <div>
              <label className="text-xs text-dark-300 block mb-1">Metricas (ate 8)</label>
              <div className="max-h-32 overflow-y-auto bg-dark-800 rounded border border-dark-600 p-2 space-y-1">
                {items.filter(it => ['0', '3'].includes(it.value_type)).map(it => (
                  <label key={it.itemid} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-dark-700 rounded px-1 py-0.5">
                    <input type="checkbox" checked={item_ids.includes(it.itemid)} onChange={e => {
                      let newIds, newNames, newOriginals;
                      if (e.target.checked && item_ids.length < 8) {
                        newIds = [...item_ids, it.itemid];
                        newNames = { ...item_names, [it.itemid]: it.name };
                        newOriginals = { ...item_names_original, [it.itemid]: it.name };
                      } else {
                        newIds = item_ids.filter(id => id !== it.itemid);
                        newNames = { ...item_names }; delete newNames[it.itemid];
                        newOriginals = { ...item_names_original }; delete newOriginals[it.itemid];
                      }
                      onConfigChange?.({ ...config, item_ids: newIds, item_names: newNames, item_names_original: newOriginals });
                    }} className="rounded" />
                    <span className="text-dark-200 truncate">{it.name}</span>
                    <span className="text-dark-500 ml-auto text-[10px] shrink-0">{it.lastvalue} {it.units}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Rename labels section */}
            {item_ids.length > 0 && (
              <div>
                <label className="text-xs text-dark-300 block mb-1">Nomes das Series (clique para editar)</label>
                <div className="bg-dark-800 rounded border border-dark-600 p-2 space-y-1.5">
                  {item_ids.map((id, i) => {
                    const originalName = item_names_original[id] || items.find(it => it.itemid === id)?.name || id;
                    const displayName = item_names[id] || originalName;
                    const isEditing = editingLabel === id;
                    const isRenamed = displayName !== originalName;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveLabel(id); if (e.key === 'Escape') setEditingLabel(null); }}
                              className="flex-1 bg-dark-900 border border-accent-green rounded px-1.5 py-0.5 text-xs text-gray-100 min-w-0"
                              autoFocus />
                            <button onClick={() => saveLabel(id)} className="text-green-400 hover:text-green-300 shrink-0"><Check size={12} /></button>
                            <button onClick={() => setEditingLabel(null)} className="text-dark-400 hover:text-dark-200 shrink-0"><X size={12} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-1 min-w-0 group cursor-pointer" onClick={() => startEditLabel(id)}>
                            <span className="text-xs text-dark-200 truncate">{displayName}</span>
                            <Pencil size={10} className="text-dark-600 group-hover:text-dark-300 shrink-0" />
                          </div>
                        )}
                        {isRenamed && !isEditing && (
                          <button onClick={() => resetLabel(id)} className="text-[9px] text-dark-500 hover:text-dark-300 shrink-0" title={`Original: ${originalName}`}>
                            restaurar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {item_ids.some(id => (item_names[id] || '') !== (item_names_original[id] || '')) && (
                  <p className="text-[9px] text-dark-500 mt-1">Nomes personalizados nao alteram a coleta real do Zabbix</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-dark-300 block mb-1">Tipo</label>
                <select value={chart_type} onChange={e => onConfigChange?.({ ...config, chart_type: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                  <option value="line">Linha</option><option value="area">Area</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-dark-300 block mb-1">Periodo</label>
                <select value={time_range} onChange={e => onConfigChange?.({ ...config, time_range: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                  <option value="global">Global (toolbar)</option>
                  {Object.keys(TIME_RANGES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-dark-300 block mb-1">Thresholds</label>
              {(thresholds || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <input type="number" value={t.value} onChange={e => {
                    const nt = [...thresholds]; nt[i] = { ...nt[i], value: parseFloat(e.target.value) || 0 };
                    onConfigChange?.({ ...config, thresholds: nt });
                  }} className="w-20 bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-gray-100" />
                  <input type="color" value={t.color} onChange={e => {
                    const nt = [...thresholds]; nt[i] = { ...nt[i], color: e.target.value };
                    onConfigChange?.({ ...config, thresholds: nt });
                  }} className="w-6 h-6 rounded cursor-pointer bg-dark-800 border-0" />
                  <button onClick={() => onConfigChange?.({ ...config, thresholds: thresholds.filter((_, j) => j !== i) })}
                    className="text-dark-500 hover:text-red-400 text-xs">X</button>
                </div>
              ))}
              <button onClick={() => onConfigChange?.({ ...config, thresholds: [...(thresholds || []), { value: 80, color: '#eab308' }] })}
                className="text-[10px] text-accent-green hover:underline">+ Adicionar threshold</button>
            </div>
            {item_ids.length > 0 && (
              <button onClick={() => setShowConfig(false)} className="w-full bg-accent-green text-white py-1.5 rounded text-xs hover:opacity-90">Ver Grafico</button>
            )}
          </>
        )}
      </div>
    );
  }

  // CHART VIEW
  const seriesKeys = item_ids.map(id => item_names[id] || id);
  const ChartComp = chart_type === 'area' ? AreaChart : LineChart;
  const SeriesComp = chart_type === 'area' ? Area : Line;

  // Custom legend with inline edit
  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 px-2 pt-1">
        {(payload || []).map((entry, i) => {
          const itemId = item_ids[i];
          const isEditing = editingLabel === itemId;
          const originalName = item_names_original[itemId];
          const isRenamed = originalName && entry.value !== originalName;
          return (
            <div key={entry.value} className="flex items-center gap-1 group">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              {isEditing ? (
                <div className="flex items-center gap-0.5">
                  <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLabel(itemId); if (e.key === 'Escape') setEditingLabel(null); }}
                    className="bg-dark-800 border border-accent-green rounded px-1 py-0 text-[10px] text-gray-100 w-28"
                    autoFocus />
                  <button onClick={() => saveLabel(itemId)} className="text-green-400"><Check size={9} /></button>
                  <button onClick={() => setEditingLabel(null)} className="text-dark-400"><X size={9} /></button>
                </div>
              ) : (
                <span className="text-[10px] text-dark-300 cursor-pointer hover:text-dark-100 flex items-center gap-0.5"
                  onClick={() => startEditLabel(itemId)}
                  title={isRenamed ? `Original: ${originalName}` : 'Clique para renomear'}>
                  {entry.value}
                  <Pencil size={8} className="text-dark-600 opacity-0 group-hover:opacity-100" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 pt-1 mb-1">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => onConfigChange?.({ ...config, time_range: 'global' })}
            className={`px-1.5 py-0.5 rounded text-[10px] ${time_range === 'global' ? 'bg-accent-blue text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>Global</button>
          {Object.keys(TIME_RANGES).map(k => (
            <button key={k} onClick={() => onConfigChange?.({ ...config, time_range: k })}
              className={`px-1.5 py-0.5 rounded text-[10px] ${time_range === k ? 'bg-accent-green text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>{k}</button>
          ))}
        </div>
        <button onClick={() => setShowConfig(true)} className="text-[10px] text-dark-400 hover:text-dark-200">Configurar</button>
      </div>
      {loading && chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-dark-400 text-sm">Carregando...</div>
      ) : chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-dark-400 text-sm">Sem dados no periodo</div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComp data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} width={60}
                tickFormatter={v => {
                  const u = (config?.unit || '').toLowerCase();
                  if (u === 'bps' || u === 'b/s' || u.includes('bits')) {
                    const m = Math.abs(v) / 1000000;
                    if (m >= 1000) return (m/1000).toFixed(1) + ' Gb/s';
                    if (m >= 1) return m.toFixed(1) + ' Mb/s';
                    if (m >= 0.001) return (m*1000).toFixed(0) + ' Kb/s';
                    return v;
                  }
                  if (v >= 1000000) return (v/1000000).toFixed(1) + 'M';
                  if (v >= 1000) return (v/1000).toFixed(1) + 'K';
                  return typeof v === 'number' ? v.toFixed(1) : v;
                }} />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                labelFormatter={formatTime}
                formatter={(value, name) => {
                  const u = (config?.unit || '').toLowerCase();
                  if (u === 'bps' || u === 'b/s' || u.includes('bits')) {
                    const m = Math.abs(value) / 1000000;
                    if (m >= 1000) return [(m/1000).toFixed(2) + ' Gb/s', name];
                    if (m >= 1) return [m.toFixed(2) + ' Mb/s', name];
                    if (m >= 0.001) return [(m*1000).toFixed(1) + ' Kb/s', name];
                    return [value.toFixed(0) + ' b/s', name];
                  }
                  return [typeof value === 'number' ? value.toFixed(2) : value, name];
                }} />
              <Legend content={renderLegend} />
              {thresholds.sort((a, b) => a.value - b.value).map((t, i, arr) => (
                <ReferenceArea key={`zone-${i}`} y1={t.value} y2={arr[i + 1]?.value} fill={t.color} fillOpacity={0.08} />
              ))}
              {thresholds.map((t, i) => (
                <ReferenceLine key={`line-${i}`} y={t.value} stroke={t.color} strokeDasharray="4 4" strokeWidth={1} />
              ))}
              {seriesKeys.map((key, i) => (
                <SeriesComp key={key} type="monotone" dataKey={key}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={chart_type === 'area' ? CHART_COLORS[i % CHART_COLORS.length] : undefined}
                  fillOpacity={0.15} strokeWidth={1.5} dot={false} name={key}
                  connectNulls isAnimationActive={false} />
              ))}
            </ChartComp>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
