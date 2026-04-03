import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7', '#eab308', '#06b6d4', '#ec4899'];

const TIME_RANGES = {
  '1h': 3600,
  '3h': 10800,
  '6h': 21600,
  '12h': 43200,
  '24h': 86400,
  '7d': 604800,
};

export default function MetricChartWidget({ config, onConfigChange }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [showConfig, setShowConfig] = useState(false);

  const {
    host_id,
    item_ids = [],
    chart_type = 'line',
    time_range = '1h',
    item_names = {},
  } = config || {};

  // Carregar hosts para seleção
  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget')
      .then(r => r.json())
      .then(setHosts)
      .catch(() => {});
  }, []);

  // Carregar items quando host mudar
  useEffect(() => {
    if (!host_id) return;
    fetch(`/api/v1/metrics/${host_id}/items`)
      .then(r => r.json())
      .then(setItems)
      .catch(() => {});
  }, [host_id]);

  // Carregar histórico
  const loadHistory = useCallback(async () => {
    if (!item_ids.length) return;

    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - (TIME_RANGES[time_range] || 3600);

      // Detectar value_type dos items selecionados
      const selectedItems = items.filter(it => item_ids.includes(it.itemid));
      const valueType = selectedItems[0]?.value_type || '0';

      const res = await fetch(
        `/api/v1/metrics/history?item_ids=${item_ids.join(',')}&value_type=${valueType}&time_from=${from}&limit=2000`
      );
      if (!res.ok) return;

      const history = await res.json();

      // Agrupar por timestamp
      const grouped = {};
      history.forEach(h => {
        const ts = parseInt(h.clock);
        if (!grouped[ts]) grouped[ts] = { time: ts };
        const label = item_names[h.itemid] || h.itemid;
        grouped[ts][label] = parseFloat(h.value) || 0;
      });

      const sorted = Object.values(grouped).sort((a, b) => a.time - b.time);
      setChartData(sorted);
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [item_ids, time_range, items, item_names]);

  useEffect(() => {
    loadHistory();
    const iv = setInterval(loadHistory, 30000);
    return () => clearInterval(iv);
  }, [loadHistory]);

  const formatTime = (ts) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Configuração inline
  if (!host_id || showConfig) {
    return (
      <div className="p-3 h-full overflow-y-auto">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-dark-300 block mb-1">Dispositivo</label>
            <select
              value={host_id || ''}
              onChange={(e) => onConfigChange?.({ ...config, host_id: e.target.value, item_ids: [], item_names: {} })}
              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100"
            >
              <option value="">Selecione...</option>
              {hosts.map(h => (
                <option key={h.hostid} value={h.hostid}>{h.name}</option>
              ))}
            </select>
          </div>

          {host_id && (
            <>
              <div>
                <label className="text-xs text-dark-300 block mb-1">Métricas (selecione até 8)</label>
                <div className="max-h-40 overflow-y-auto bg-dark-800 rounded border border-dark-600 p-2 space-y-1">
                  {items
                    .filter(it => ['0', '3'].includes(it.value_type))
                    .map(it => (
                    <label key={it.itemid} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-dark-700 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={item_ids.includes(it.itemid)}
                        onChange={(e) => {
                          let newIds, newNames;
                          if (e.target.checked && item_ids.length < 8) {
                            newIds = [...item_ids, it.itemid];
                            newNames = { ...item_names, [it.itemid]: it.name };
                          } else {
                            newIds = item_ids.filter(id => id !== it.itemid);
                            newNames = { ...item_names };
                            delete newNames[it.itemid];
                          }
                          onConfigChange?.({ ...config, item_ids: newIds, item_names: newNames });
                        }}
                        className="rounded"
                      />
                      <span className="text-dark-200 truncate">{it.name}</span>
                      <span className="text-dark-500 ml-auto text-[10px] shrink-0">
                        {it.lastvalue} {it.units}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-dark-300 block mb-1">Tipo</label>
                  <select
                    value={chart_type}
                    onChange={(e) => onConfigChange?.({ ...config, chart_type: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100"
                  >
                    <option value="line">Linha</option>
                    <option value="area">Área</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-dark-300 block mb-1">Período</label>
                  <select
                    value={time_range}
                    onChange={(e) => onConfigChange?.({ ...config, time_range: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100"
                  >
                    {Object.keys(TIME_RANGES).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              {item_ids.length > 0 && (
                <button
                  onClick={() => setShowConfig(false)}
                  className="w-full bg-accent-green text-white py-1.5 rounded text-xs hover:opacity-90"
                >
                  Ver Gráfico
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Gráfico
  const seriesKeys = Object.keys(chartData[0] || {}).filter(k => k !== 'time');
  const ChartComp = chart_type === 'area' ? AreaChart : LineChart;
  const SeriesComp = chart_type === 'area' ? Area : Line;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 pt-1 mb-1">
        <div className="flex gap-1">
          {Object.keys(TIME_RANGES).map(k => (
            <button
              key={k}
              onClick={() => onConfigChange?.({ ...config, time_range: k })}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                time_range === k ? 'bg-accent-green text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowConfig(true)}
          className="text-[10px] text-dark-400 hover:text-dark-200"
        >
          Configurar
        </button>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-dark-400 text-sm">Carregando...</div>
      ) : chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-dark-400 text-sm">Sem dados no período</div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComp data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                labelFormatter={formatTime}
              />
              {seriesKeys.map((key, i) => (
                <SeriesComp
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={chart_type === 'area' ? CHART_COLORS[i % CHART_COLORS.length] : undefined}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                  name={key}
                />
              ))}
            </ChartComp>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
