import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import {
  ArrowUpDown, ArrowDown, ArrowUp, Wifi, WifiOff, Activity,
  AlertTriangle, Plus, X, Eye, ChevronDown, ChevronUp,
  Cable, Unplug, Network, Globe, Layers, Radio, CircleDot,
} from 'lucide-react';

function getIfaceIcon(name, status) {
  const n = name.toLowerCase();
  const isUp = status === 1;
  // SFP / fiber optic
  if (n.startsWith('sfp') || n.includes('optical') || n.includes('fiber'))
    return { icon: CircleDot, color: isUp ? 'text-emerald-400' : 'text-red-400', label: 'SFP' };
  // Ethernet (ether, GigabitEthernet, 100GE, 10GE, FastEthernet)
  if (n.startsWith('ether') || n.includes('gigabitethernet') || n.match(/^\d+ge/) || n.includes('fastethernet'))
    return { icon: Cable, color: isUp ? 'text-blue-400' : 'text-red-400', label: 'ETH' };
  // Eth-Trunk / LAG / aggregation
  if (n.includes('eth-trunk') || n.includes('bond') || n.includes('lag') || n.includes('port-channel'))
    return { icon: Layers, color: isUp ? 'text-cyan-400' : 'text-red-400', label: 'LAG' };
  // VLAN
  if (n.includes('vlan'))
    return { icon: Network, color: isUp ? 'text-violet-400' : 'text-red-400', label: 'VLAN' };
  // Bridge
  if (n.includes('bridge'))
    return { icon: Network, color: isUp ? 'text-teal-400' : 'text-red-400', label: 'BR' };
  // GRE / EoIP / Tunnel
  if (n.includes('gre') || n.includes('eoip') || n.includes('tunnel') || n.includes('l2tp') || n.includes('pptp') || n.includes('pppoe'))
    return { icon: Globe, color: isUp ? 'text-amber-400' : 'text-red-400', label: 'TUN' };
  // Wireless / WiFi
  if (n.includes('wlan') || n.includes('wifi') || n.includes('wireless') || n.includes('radio'))
    return { icon: Wifi, color: isUp ? 'text-green-400' : 'text-red-400', label: 'WiFi' };
  // Loopback
  if (n.includes('loopback') || n.includes('lo0'))
    return { icon: Radio, color: isUp ? 'text-gray-400' : 'text-red-400', label: 'LO' };
  // NULL / Virtual
  if (n.startsWith('null') || n.includes('inloopback'))
    return { icon: Unplug, color: 'text-dark-500', label: 'NULL' };
  // Default
  return { icon: Cable, color: isUp ? 'text-green-400' : 'text-red-400', label: 'IF' };
}

const STATUS_COLORS = {
  1: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'UP' },
  2: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'DOWN' },
  3: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'TESTING' },
};

function formatTraffic(bps) {
  if (!bps || bps === 0) return '0.00 Mb/s';
  const abs = Math.abs(bps) / 1000000;
  if (abs >= 1000) return (abs / 1000).toFixed(2) + ' Gb/s';
  if (abs >= 1) return abs.toFixed(2) + ' Mb/s';
  if (abs >= 0.001) return (abs * 1000).toFixed(1) + ' Kb/s';
  return (abs * 1000000).toFixed(0) + ' b/s';
}

function formatTrafficShort(mbps) {
  if (!mbps || mbps === 0) return '0';
  if (mbps >= 1000) return (mbps / 1000).toFixed(1) + ' Gb/s';
  if (mbps >= 1) return mbps.toFixed(1) + ' Mb/s';
  if (mbps >= 0.01) return (mbps * 1000).toFixed(0) + ' Kb/s';
  return mbps.toFixed(3);
}

function formatSpeed(bps) {
  if (!bps || bps === 0) return '-';
  const mbps = bps / 1000000;
  if (mbps >= 1000) return (mbps / 1000).toFixed(0) + ' Gbps';
  return mbps.toFixed(0) + ' Mbps';
}

export default function DeviceInterfaces({ hostId, hostName }) {
  const [interfaces, setInterfaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIfaces, setSelectedIfaces] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [alertModal, setAlertModal] = useState(null);
  const [alertForm, setAlertForm] = useState({ trigger_type: 'link_down', priority: 3, threshold: -25 });
  const [alertMsg, setAlertMsg] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [timeRange, setTimeRange] = useState('1h');
  const [expandedIface, setExpandedIface] = useState(null);
  const [showDashModal, setShowDashModal] = useState(false);
  const [dashTabs, setDashTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [dashMsg, setDashMsg] = useState('');
  const [addingToDash, setAddingToDash] = useState(false);

  const TIME_RANGES = { '15m': 900, '30m': 1800, '1h': 3600, '3h': 10800, '6h': 21600, '24h': 86400 };

  const loadInterfaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/devices/${hostId}/interfaces-detail`);
      if (res.ok) {
        const data = await res.json();
        setInterfaces(data);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [hostId]);

  useEffect(() => { loadInterfaces(); }, [loadInterfaces]);

  const loadDashTabs = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/config');
      if (res.ok) {
        const data = await res.json();
        if (data.tabs) {
          setDashTabs(data.tabs);
          if (data.tabs.length > 0) setSelectedTab(data.tabs[0].id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const addToDashboard = async () => {
    if (selectedIfaces.length === 0 || !selectedTab) return;
    setAddingToDash(true);
    setDashMsg('');
    try {
      // Build item_ids and item_names for the metric_chart widget
      const itemIds = [];
      const itemNames = {};
      selectedIfaces.forEach(idx => {
        const iface = interfaces.find(i => i.index === idx);
        if (!iface) return;
        if (iface.item_ids.in) {
          itemIds.push(iface.item_ids.in);
          itemNames[iface.item_ids.in] = iface.name + ' IN';
        }
        if (iface.item_ids.out) {
          itemIds.push(iface.item_ids.out);
          itemNames[iface.item_ids.out] = iface.name + ' OUT';
        }
      });

      // Load current config
      const res = await fetch('/api/v1/dashboard/config');
      const config = await res.json();

      // Find or create target tab
      const tabIdx = config.tabs.findIndex(t => t.id === selectedTab);
      if (tabIdx === -1) { setDashMsg('Aba nao encontrada'); setAddingToDash(false); return; }

      // Create widget
      const widgetId = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const ifaceNames = selectedIfaces.map(idx => interfaces.find(i => i.index === idx)?.name || idx).join(', ');
      const newWidget = {
        id: widgetId,
        type: 'metric_chart',
        title: 'Trafego ' + (ifaceNames.length > 40 ? ifaceNames.substring(0, 37) + '...' : ifaceNames),
        config: {
          host_id: hostId,
          item_ids: itemIds,
          item_names: itemNames,
          chart_type: 'area',
          time_range: 'global',
          unit: 'bps',
        },
        w: 6,
        h: 2,
      };

      config.tabs[tabIdx].widgets.push(newWidget);

      // Save
      const saveRes = await fetch('/api/v1/dashboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs: config.tabs }),
      });

      if (saveRes.ok) {
        setDashMsg('Widget adicionado ao Dashboard!');
        setTimeout(() => { setShowDashModal(false); setDashMsg(''); }, 1500);
      } else {
        setDashMsg('Erro ao salvar no dashboard');
      }
    } catch (e) { setDashMsg('Erro: ' + e.message); }
    setAddingToDash(false);
  };

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadInterfaces, 30000);
    return () => clearInterval(interval);
  }, [loadInterfaces]);

  const loadTrafficHistory = useCallback(async () => {
    if (selectedIfaces.length === 0) return;
    setChartLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - (TIME_RANGES[timeRange] || 3600);
      // Collect all in/out item IDs
      const itemIds = [];
      const itemLabels = {};
      selectedIfaces.forEach(idx => {
        const iface = interfaces.find(i => i.index === idx);
        if (!iface) return;
        if (iface.item_ids.in) { itemIds.push(iface.item_ids.in); itemLabels[iface.item_ids.in] = `${iface.name} IN`; }
        if (iface.item_ids.out) { itemIds.push(iface.item_ids.out); itemLabels[iface.item_ids.out] = `${iface.name} OUT`; }
      });
      if (itemIds.length === 0) return;

      const res = await fetch(`/api/v1/metrics/history?item_ids=${itemIds.join(',')}&value_type=0&time_from=${from}&limit=5000`);
      if (!res.ok) return;
      const history = await res.json();

      // Group by timestamp
      const grouped = {};
      history.forEach(h => {
        const ts = parseInt(h.clock);
        // Round to 30s buckets
        const bucket = Math.floor(ts / 30) * 30;
        if (!grouped[bucket]) grouped[bucket] = { time: bucket };
        const label = itemLabels[h.itemid] || h.itemid;
        // Convert bps to Mbps
        grouped[bucket][label] = parseFloat(h.value) / 1000000;
      });
      setChartData(Object.values(grouped).sort((a, b) => a.time - b.time));
    } catch (e) { console.error(e); }
    setChartLoading(false);
  }, [selectedIfaces, interfaces, timeRange]);

  useEffect(() => {
    if (showGraph) loadTrafficHistory();
  }, [showGraph, loadTrafficHistory]);

  const toggleSelect = (idx) => {
    setSelectedIfaces(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...interfaces].sort((a, b) => {
    let av, bv;
    if (sortKey === 'name') { av = a.name; bv = b.name; }
    else if (sortKey === 'status') { av = a.oper_status; bv = b.oper_status; }
    else if (sortKey === 'in') { av = a.traffic_in_bps; bv = b.traffic_in_bps; }
    else if (sortKey === 'out') { av = a.traffic_out_bps; bv = b.traffic_out_bps; }
    else if (sortKey === 'speed') { av = a.speed_bps; bv = b.speed_bps; }
    else { av = a.name; bv = b.name; }
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const createAlert = async () => {
    if (!alertModal) return;
    setAlertMsg('');
    try {
      const statusItemId = alertModal.item_ids.status;
      if (!statusItemId && alertForm.trigger_type === 'link_down') {
        setAlertMsg('Interface sem item de status operacional');
        return;
      }
      const res = await fetch(`/api/v1/devices/${hostId}/interfaces-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interface_name: alertModal.name,
          trigger_type: alertForm.trigger_type,
          item_id: alertForm.trigger_type === 'link_down' ? statusItemId : alertForm.sfp_item_id || '',
          host_name: hostName,
          threshold: alertForm.trigger_type === 'sfp_signal' ? alertForm.threshold : null,
          priority: alertForm.priority,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setAlertMsg('Alerta criado com sucesso!');
        setTimeout(() => setAlertModal(null), 1500);
      } else {
        setAlertMsg(`Erro: ${result.detail || 'Falha ao criar alerta'}`);
      }
    } catch (e) { setAlertMsg(`Erro: ${e.message}`); }
  };

  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const CHART_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7', '#eab308', '#06b6d4', '#ec4899'];

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-dark-400"><Activity className="animate-spin mr-2" size={16} /> Carregando interfaces...</div>;
  }

  if (interfaces.length === 0) {
    return <div className="text-center py-12 text-dark-400">Nenhuma interface de rede encontrada para este dispositivo.</div>;
  }

  const SortHeader = ({ label, field }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-dark-100 text-dark-300 font-medium text-xs">
      {label}
      {sortKey === field && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-dark-300">{interfaces.length} interfaces</span>
          <span className="text-xs text-dark-500">|</span>
          <span className="text-xs text-green-400">{interfaces.filter(i => i.oper_status === 1).length} up</span>
          <span className="text-xs text-red-400">{interfaces.filter(i => i.oper_status === 2).length} down</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIfaces.length > 0 && (<>
            <button onClick={() => setShowGraph(!showGraph)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green text-white text-xs rounded hover:opacity-90 transition-opacity">
              <Eye size={14} /> {showGraph ? 'Ocultar' : 'Ver'} Grafico ({selectedIfaces.length})
            </button>
            <button onClick={() => { loadDashTabs(); setShowDashModal(true); setDashMsg(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white text-xs rounded hover:opacity-90 transition-opacity">
              <Plus size={14} /> Adicionar ao Dashboard
            </button>
          </>)}
          <button onClick={loadInterfaces}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 text-dark-200 text-xs rounded hover:bg-dark-600">
            <Activity size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Traffic Graph */}
      {showGraph && selectedIfaces.length > 0 && (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Trafego (Mbps)</h4>
            <div className="flex gap-1">
              {Object.keys(TIME_RANGES).map(k => (
                <button key={k} onClick={() => setTimeRange(k)}
                  className={`px-2 py-0.5 rounded text-[10px] ${timeRange === k ? 'bg-accent-green text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>{k}</button>
              ))}
            </div>
          </div>
          {chartLoading ? (
            <div className="flex items-center justify-center h-48 text-dark-400 text-sm">Carregando...</div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-dark-400 text-sm">Sem dados no periodo</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={50} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} width={65}
                  tickFormatter={v => formatTrafficShort(v)} />
                <Tooltip
                  contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                  labelFormatter={formatTime}
                  formatter={(value) => {
                    if (value >= 1000) return [(value / 1000).toFixed(2) + ' Gb/s'];
                    return [value.toFixed(2) + ' Mb/s'];
                  }}
                />
                {Object.keys(chartData[0] || {}).filter(k => k !== 'time').map((key, i) => (
                  <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15}
                    strokeWidth={1.5} dot={false} name={key} />
                ))}
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Interface Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-dark-900">
            <tr className="border-b border-dark-700">
              <th className="px-3 py-2 text-left w-8">
                <input type="checkbox" className="rounded"
                  checked={selectedIfaces.length === interfaces.length && interfaces.length > 0}
                  onChange={e => setSelectedIfaces(e.target.checked ? interfaces.map(i => i.index) : [])} />
              </th>
              <th className="px-3 py-2 text-left"><SortHeader label="Interface" field="name" /></th>
              <th className="px-3 py-2 text-left"><SortHeader label="Status" field="status" /></th>
              <th className="px-3 py-2 text-right"><SortHeader label="Download" field="in" /></th>
              <th className="px-3 py-2 text-right"><SortHeader label="Upload" field="out" /></th>
              <th className="px-3 py-2 text-right"><SortHeader label="Velocidade" field="speed" /></th>
              <th className="px-3 py-2 text-center">Erros</th>
              <th className="px-3 py-2 text-center">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(iface => {
              const st = STATUS_COLORS[iface.oper_status] || STATUS_COLORS[2];
              const isExpanded = expandedIface === iface.index;
              return [
                <tr key={iface.index} className={`border-b border-dark-800 hover:bg-dark-750 transition-colors ${selectedIfaces.includes(iface.index) ? 'bg-dark-750' : ''}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" className="rounded" checked={selectedIfaces.includes(iface.index)}
                      onChange={() => toggleSelect(iface.index)} />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setExpandedIface(isExpanded ? null : iface.index)} className="text-left">
                      {(() => {
                        const ifIcon = getIfaceIcon(iface.name, iface.oper_status);
                        const IconComp = ifIcon.icon;
                        return (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 shrink-0">
                              <IconComp size={13} className={ifIcon.color} />
                              <span className={`text-[9px] font-mono ${ifIcon.color} w-7`}>{ifIcon.label}</span>
                            </div>
                            <span className="text-dark-100 font-medium">{iface.name}</span>
                          </div>
                        );
                      })()}
                      {iface.alias && <p className="text-[10px] text-dark-500 ml-11 mt-0.5">{iface.alias}</p>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowDown size={10} className="text-green-400" />
                      <span className="text-green-300">{formatTraffic(iface.traffic_in_bps)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUp size={10} className="text-blue-400" />
                      <span className="text-blue-300">{formatTraffic(iface.traffic_out_bps)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-dark-300">{formatSpeed(iface.speed_bps)}</td>
                  <td className="px-3 py-2 text-center">
                    {(iface.errors_in > 0 || iface.errors_out > 0) ? (
                      <span className="text-yellow-400 text-[10px]">{iface.errors_in + iface.errors_out}</span>
                    ) : (
                      <span className="text-dark-600">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => { setAlertModal(iface); setAlertForm({ trigger_type: 'link_down', priority: 3, threshold: -25 }); setAlertMsg(''); }}
                      className="text-dark-400 hover:text-yellow-400 transition-colors" title="Configurar alerta">
                      <AlertTriangle size={14} />
                    </button>
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={`${iface.index}-detail`} className="bg-dark-850">
                    <td colSpan={8} className="px-6 py-3">
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-dark-500">Index SNMP</span>
                          <p className="text-dark-200 font-mono">{iface.index}</p>
                        </div>
                        <div>
                          <span className="text-dark-500">Item IN</span>
                          <p className="text-dark-200 font-mono text-[10px]">{iface.item_ids.in || '-'}</p>
                        </div>
                        <div>
                          <span className="text-dark-500">Item OUT</span>
                          <p className="text-dark-200 font-mono text-[10px]">{iface.item_ids.out || '-'}</p>
                        </div>
                        <div>
                          <span className="text-dark-500">Atualizado</span>
                          <p className="text-dark-200">{iface.last_update !== '0' ? new Date(parseInt(iface.last_update) * 1000).toLocaleString('pt-BR') : '-'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Dashboard Modal */}
      {showDashModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowDashModal(false)}>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Adicionar ao Dashboard</h3>
              <button onClick={() => setShowDashModal(false)} className="text-dark-400 hover:text-dark-200"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-dark-300 mb-2">
                  {selectedIfaces.length} interface(s) selecionada(s): trafego IN/OUT sera adicionado como grafico de area.
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {selectedIfaces.map(idx => {
                    const iface = interfaces.find(i => i.index === idx);
                    return iface ? (
                      <span key={idx} className="px-2 py-0.5 bg-dark-700 rounded text-[10px] text-dark-200">{iface.name}</span>
                    ) : null;
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-dark-300 block mb-1">Selecionar aba do Dashboard</label>
                <select value={selectedTab} onChange={e => setSelectedTab(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                  {dashTabs.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.name}</option>
                  ))}
                </select>
              </div>

              {dashMsg && (
                <p className={`text-xs ${dashMsg.includes('adicionado') ? 'text-green-400' : 'text-red-400'}`}>{dashMsg}</p>
              )}

              <button onClick={addToDashboard} disabled={addingToDash || selectedIfaces.length === 0}
                className="w-full bg-accent-blue text-white py-2 rounded text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {addingToDash ? 'Adicionando...' : 'Adicionar Widget ao Dashboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setAlertModal(null)}>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Criar Alerta - {alertModal.name}</h3>
              <button onClick={() => setAlertModal(null)} className="text-dark-400 hover:text-dark-200"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-dark-300 block mb-1">Tipo de Alerta</label>
                <select value={alertForm.trigger_type} onChange={e => setAlertForm({ ...alertForm, trigger_type: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                  <option value="link_down">Interface DOWN</option>
                  <option value="sfp_signal">Sinal Optico SFP (dBm)</option>
                </select>
              </div>

              {alertForm.trigger_type === 'sfp_signal' && (
                <div>
                  <label className="text-xs text-dark-300 block mb-1">Threshold (dBm) - alertar acima de:</label>
                  <input type="number" step="0.5" value={alertForm.threshold}
                    onChange={e => setAlertForm({ ...alertForm, threshold: parseFloat(e.target.value) })}
                    className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100" />
                  <p className="text-[10px] text-dark-500 mt-1">Valores tipicos SFP: -8 a -25 dBm. Alerta quando acima do threshold.</p>
                </div>
              )}

              <div>
                <label className="text-xs text-dark-300 block mb-1">Severidade</label>
                <select value={alertForm.priority} onChange={e => setAlertForm({ ...alertForm, priority: parseInt(e.target.value) })}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                  <option value={1}>Informacao</option>
                  <option value={2}>Aviso</option>
                  <option value={3}>Medio</option>
                  <option value={4}>Alto</option>
                  <option value={5}>Desastre</option>
                </select>
              </div>

              {alertMsg && (
                <p className={`text-xs ${alertMsg.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>{alertMsg}</p>
              )}

              <button onClick={createAlert}
                className="w-full bg-accent-green text-white py-2 rounded text-xs font-medium hover:opacity-90">
                <Plus size={14} className="inline mr-1" /> Criar Alerta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
