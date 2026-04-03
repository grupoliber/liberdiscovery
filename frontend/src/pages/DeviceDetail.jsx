import { useParams } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getDevice, getItems } from '../services/api';
import Card from '../components/Card';
import { AvailabilityBadge, SeverityBadge } from '../components/StatusBadge';
import Loading from '../components/Loading';
import DeviceInterfaces from '../components/DeviceInterfaces';
import {
  ArrowLeft, Activity, Search, Plus, Eye, X, LayoutDashboard,
  AreaChart as AreaChartIcon, Check, Users, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Link } from 'react-router-dom';

function formatUnit(value, unit) {
  if (!value && value !== 0) return '-';
  const v = parseFloat(value);
  if (isNaN(v)) return value;
  const u = (unit || '').toLowerCase();
  if (u === 'bps' || u === 'b/s' || u.includes('bits')) {
    const m = Math.abs(v) / 1000000;
    if (m >= 1000) return (m / 1000).toFixed(2) + ' Gb/s';
    if (m >= 1) return m.toFixed(2) + ' Mb/s';
    if (m >= 0.001) return (m * 1000).toFixed(1) + ' Kb/s';
    return v.toFixed(0) + ' b/s';
  }
  if (u === '%') return v.toFixed(1) + '%';
  if (u === 'b' || u === 'bytes') {
    if (v >= 1073741824) return (v / 1073741824).toFixed(2) + ' GB';
    if (v >= 1048576) return (v / 1048576).toFixed(2) + ' MB';
    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
    return v.toFixed(0) + ' B';
  }
  if (u === 'uptime' || u === 's') {
    const d = Math.floor(v / 86400);
    const h = Math.floor((v % 86400) / 3600);
    const min = Math.floor((v % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + min + 'm';
    return min + 'm';
  }
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + (unit ? ' ' + unit : '');
}

function formatYAxis(v, unit) {
  const u = (unit || '').toLowerCase();
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
}

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7', '#eab308', '#06b6d4', '#ec4899'];
const TIME_RANGES = { '15m': 900, '30m': 1800, '1h': 3600, '3h': 10800, '6h': 21600, '24h': 86400 };

export default function DeviceDetail() {
  const { hostId } = useParams();
  const [activeTab, setActiveTab] = useState('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartTimeRange, setChartTimeRange] = useState('1h');
  const [showDashModal, setShowDashModal] = useState(false);
  const [dashTabs, setDashTabs] = useState([]);
  const [selectedDashTab, setSelectedDashTab] = useState('');
  const [dashMsg, setDashMsg] = useState('');
  const [addingToDash, setAddingToDash] = useState(false);
  const [pppoeData, setPppoeData] = useState(null);
  const [pppoeLoading, setPppoeLoading] = useState(false);
  const [pppoeError, setPppoeError] = useState(null);

  const fetchDevice = useCallback(() => getDevice(hostId), [hostId]);
  const fetchItems = useCallback(() => getItems(hostId), [hostId]);

  const { data: device, loading } = useApi(fetchDevice, [hostId]);
  const { data: items } = useApi(fetchItems, [hostId]);

  // Filter items
  const filteredItems = (items || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(s) || (item.key_ || '').toLowerCase().includes(s);
  });

  // Group items by category
  const groupItems = (itemsList) => {
    const groups = {};
    itemsList.forEach(item => {
      const key = (item.key_ || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      let cat = 'Outros';
      if (key.includes('net.if') || name.includes('interface') || name.includes('traffic') || name.includes('bits')) cat = 'Interfaces / Trafego';
      else if (key.includes('cpu') || key.includes('processor')) cat = 'CPU';
      else if (key.includes('memory') || key.includes('vm.memory') || key.includes('hrstorage')) cat = 'Memoria';
      else if (key.includes('icmp') || key.includes('ping')) cat = 'Ping / ICMP';
      else if (key.includes('system.uptime') || key.includes('system.name') || key.includes('system.descr')) cat = 'Sistema';
      else if (key.includes('vfs.fs') || key.includes('disk')) cat = 'Disco';
      else if (key.includes('sensor') || key.includes('temp') || key.includes('voltage')) cat = 'Sensores';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  };

  const toggleItem = (itemid) => {
    setSelectedItems(prev => prev.includes(itemid) ? prev.filter(id => id !== itemid) : [...prev, itemid]);
  };

  // Load chart preview
  const loadPreview = useCallback(async () => {
    if (selectedItems.length === 0) return;
    setChartLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - (TIME_RANGES[chartTimeRange] || 3600);
      const selItems = (items || []).filter(i => selectedItems.includes(i.itemid));
      const vt = selItems[0]?.value_type || '0';
      const res = await fetch(`/api/v1/metrics/history?item_ids=${selectedItems.join(',')}&value_type=${vt}&time_from=${from}&limit=3000`);
      if (!res.ok) return;
      const history = await res.json();
      const labels = {};
      selItems.forEach(i => { labels[i.itemid] = i.name.length > 35 ? i.name.substring(0, 32) + '...' : i.name; });
      const grouped = {};
      history.forEach(h => {
        const ts = Math.floor(parseInt(h.clock) / 30) * 30;
        if (!grouped[ts]) grouped[ts] = { time: ts };
        grouped[ts][labels[h.itemid] || h.itemid] = parseFloat(h.value) || 0;
      });
      setChartData(Object.values(grouped).sort((a, b) => a.time - b.time));
    } catch (e) { console.error(e); }
    setChartLoading(false);
  }, [selectedItems, items, chartTimeRange]);

  useEffect(() => { if (showPreview) loadPreview(); }, [showPreview, loadPreview]);

  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Dashboard integration
  const loadDashTabs = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/config');
      if (res.ok) {
        const data = await res.json();
        if (data.tabs) {
          setDashTabs(data.tabs);
          if (data.tabs.length > 0) setSelectedDashTab(data.tabs[0].id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const addToDashboard = async () => {
    if (selectedItems.length === 0 || !selectedDashTab) return;
    setAddingToDash(true);
    setDashMsg('');
    try {
      const selItems = (items || []).filter(i => selectedItems.includes(i.itemid));
      const itemNames = {};
      selItems.forEach(i => {
        itemNames[i.itemid] = i.name.length > 35 ? i.name.substring(0, 32) + '...' : i.name;
      });

      // Detect if items are bps
      const hasBps = selItems.some(i => (i.units || '').toLowerCase().includes('bps') || (i.units || '').toLowerCase().includes('b/s'));
      const unit = hasBps ? 'bps' : (selItems[0]?.units || '');

      const res = await fetch('/api/v1/dashboard/config');
      const config = await res.json();
      const tabIdx = config.tabs.findIndex(t => t.id === selectedDashTab);
      if (tabIdx === -1) { setDashMsg('Aba nao encontrada'); setAddingToDash(false); return; }

      const widgetId = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const titleItems = selItems.map(i => i.name).join(', ');
      const newWidget = {
        id: widgetId,
        type: 'metric_chart',
        title: titleItems.length > 45 ? titleItems.substring(0, 42) + '...' : titleItems,
        config: {
          host_id: hostId,
          item_ids: selectedItems,
          item_names: itemNames,
          chart_type: 'area',
          time_range: 'global',
          unit: unit,
        },
        w: 6,
        h: 2,
      };

      config.tabs[tabIdx].widgets.push(newWidget);
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

  const loadPPPoE = useCallback(async () => {
    setPppoeLoading(true);
    setPppoeError(null);
    try {
      const res = await fetch('/api/v1/devices/' + hostId + '/pppoe-stats');
      if (res.ok) {
        setPppoeData(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setPppoeError(err.detail || 'Erro ao consultar PPPoE');
      }
    } catch (e) { setPppoeError(e.message); }
    setPppoeLoading(false);
  }, [hostId]);

  useEffect(() => {
    if (activeTab === 'pppoe' && !pppoeData && !pppoeLoading) loadPPPoE();
  }, [activeTab, pppoeData, pppoeLoading, loadPPPoE]);

  if (loading && !device) return <Loading text="Carregando dispositivo..." />;
  if (!device) return <p className="text-dark-400">Dispositivo nao encontrado.</p>;

  const keyItems = (items || []).filter((item) => {
    const key = item.key_ || '';
    return key.includes('cpu') || key.includes('memory') || key.includes('icmp') || key.includes('system.uptime');
  });

  const grouped = groupItems(filteredItems);
  const selectedUnit = selectedItems.length > 0 ? ((items || []).find(i => i.itemid === selectedItems[0])?.units || '') : '';

  const tabs = [
    { id: 'info', label: 'Informacoes' },
    { id: 'interfaces', label: 'Interfaces de Rede' },
    { id: 'pppoe', label: 'PPPoE' },
    { id: 'metrics', label: 'Metricas' },
  ];

  return (
    <div>
      <Link to="/devices" className="flex items-center gap-2 text-accent-blue text-sm mb-4 hover:underline">
        <ArrowLeft size={14} /> Voltar para dispositivos
      </Link>

      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-2xl font-bold">{device.name}</h2>
        <AvailabilityBadge available={device.available} />
      </div>

      <div className="flex gap-1 mb-6 border-b border-dark-700">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Informacoes */}
      {activeTab === 'info' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card title="Informacoes">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-dark-300">Hostname</dt>
                  <dd className="font-mono">{device.host}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dark-300">IP</dt>
                  <dd className="font-mono">{device.interfaces?.[0]?.ip || '\u2014'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dark-300">Grupos</dt>
                  <dd>{device.groups?.map((g) => g.name).join(', ') || '\u2014'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dark-300">Templates</dt>
                  <dd className="text-xs">{device.parentTemplates?.map((t) => t.name).join(', ') || '\u2014'}</dd>
                </div>
              </dl>
            </Card>

            <Card title="Triggers Ativos">
              {device.triggers?.filter((t) => t.value === '1').length > 0 ? (
                <div className="space-y-2">
                  {device.triggers
                    .filter((t) => t.value === '1')
                    .map((trigger) => (
                      <div key={trigger.triggerid} className="flex items-center gap-2">
                        <SeverityBadge severity={parseInt(trigger.priority)} />
                        <span className="text-xs">{trigger.description}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-dark-400 text-sm">Nenhum trigger ativo</p>
              )}
            </Card>

            <Card title="Interfaces Zabbix">
              {device.interfaces?.length > 0 ? (
                <div className="space-y-2">
                  {device.interfaces.map((iface) => (
                    <div key={iface.interfaceid} className="flex justify-between text-sm">
                      <span className="font-mono text-dark-200">{iface.ip}:{iface.port}</span>
                      <span className="text-dark-400 text-xs">
                        {iface.type === '1' ? 'Agent' : iface.type === '2' ? 'SNMP' : iface.type === '3' ? 'IPMI' : 'JMX'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-dark-400 text-sm">Sem interfaces</p>
              )}
            </Card>
          </div>

          <Card title="Metricas Principais">
            {keyItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {keyItems.slice(0, 12).map((item) => (
                  <div key={item.itemid} className="bg-dark-800 rounded p-3">
                    <p className="text-xs text-dark-300 truncate">{item.name}</p>
                    <p className="text-lg font-bold mt-1">
                      {formatUnit(item.lastvalue, item.units)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-400 text-sm">Nenhuma metrica coletada ainda.</p>
            )}
          </Card>
        </>
      )}

      {/* Tab: Interfaces de Rede */}
      {activeTab === 'interfaces' && (
        <DeviceInterfaces hostId={hostId} hostName={device.host} />
      )}


      {/* Tab: PPPoE */}
      {activeTab === 'pppoe' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Users size={16} className="text-accent-green" /> Sessoes PPPoE
            </h3>
            <button onClick={loadPPPoE} disabled={pppoeLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 text-dark-200 text-xs rounded hover:bg-dark-600 disabled:opacity-50">
              <RefreshCw size={14} className={pppoeLoading ? 'animate-spin' : ''} />
              {pppoeLoading ? 'Consultando...' : 'Atualizar'}
            </button>
          </div>

          {pppoeError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-300">
              {pppoeError}
              <p className="text-xs text-dark-400 mt-1">Verifique se o host suporta a MIB Huawei BRAS (hwBRASMIB).</p>
            </div>
          )}

          {pppoeData && (
            <>
              {/* Big number */}
              <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 text-center">
                <p className="text-5xl font-bold text-accent-green">{pppoeData.total_sessions?.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-dark-300 mt-2">Sessoes PPPoE ativas</p>
                <p className="text-[10px] text-dark-500 mt-1">Host: {pppoeData.host_ip}</p>
              </div>

              {/* Per interface breakdown */}
              {pppoeData.by_interface && Object.keys(pppoeData.by_interface).length > 0 && (
                <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-dark-900 border-b border-dark-700">
                    <h4 className="text-xs font-semibold text-dark-200">Sessoes por Interface</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="px-4 py-2 text-left text-dark-400">Interface</th>
                        <th className="px-4 py-2 text-right text-dark-400">Sessoes</th>
                        <th className="px-4 py-2 text-right text-dark-400">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(pppoeData.by_interface)
                        .sort(([,a], [,b]) => b.sessions - a.sessions)
                        .map(([name, info]) => {
                          const pct = pppoeData.total_sessions > 0
                            ? ((info.sessions / pppoeData.total_sessions) * 100).toFixed(1)
                            : '0';
                          return (
                            <tr key={name} className="border-b border-dark-800 hover:bg-dark-750">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <Users size={12} className="text-accent-green shrink-0" />
                                  <span className="text-dark-200">{name}</span>
                                  <span className="text-[10px] text-dark-500">idx:{info.index}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-dark-100 font-bold">
                                {info.sessions.toLocaleString('pt-BR')}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 bg-dark-700 rounded-full h-1.5">
                                    <div className="bg-accent-green h-1.5 rounded-full" style={{ width: pct + '%' }} />
                                  </div>
                                  <span className="text-dark-300 w-10 text-right">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!pppoeData && !pppoeLoading && !pppoeError && (
            <div className="text-center py-12 text-dark-400">
              <Users size={48} className="mx-auto mb-3 text-dark-600" />
              <p className="text-sm">Clique em "Atualizar" para consultar sessoes PPPoE.</p>
              <p className="text-xs text-dark-500 mt-1">Requer equipamento Huawei com MIB BRAS habilitada.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Metricas */}
      {activeTab === 'metrics' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar metrica por nome ou key..."
                className="w-full bg-dark-800 border border-dark-600 rounded pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder-dark-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-dark-400">{selectedItems.length} selecionado(s)</span>
              {selectedItems.length > 0 && (<>
                <button onClick={() => { setShowPreview(!showPreview); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green text-white text-xs rounded hover:opacity-90">
                  <Eye size={14} /> {showPreview ? 'Ocultar' : 'Ver'} Grafico
                </button>
                <button onClick={() => { loadDashTabs(); setShowDashModal(true); setDashMsg(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white text-xs rounded hover:opacity-90">
                  <LayoutDashboard size={14} /> Adicionar ao Dashboard
                </button>
              </>)}
              {selectedItems.length > 0 && (
                <button onClick={() => setSelectedItems([])}
                  className="text-dark-400 hover:text-dark-200 text-xs">Limpar</button>
              )}
            </div>
          </div>

          {/* Preview Chart */}
          {showPreview && selectedItems.length > 0 && (
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Pre-visualizacao</h4>
                <div className="flex gap-1">
                  {Object.keys(TIME_RANGES).map(k => (
                    <button key={k} onClick={() => setChartTimeRange(k)}
                      className={`px-2 py-0.5 rounded text-[10px] ${chartTimeRange === k ? 'bg-accent-green text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>{k}</button>
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
                      tickFormatter={v => formatYAxis(v, selectedUnit)} />
                    <Tooltip
                      contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={formatTime}
                      formatter={(value, name) => [formatUnit(value, selectedUnit), name]}
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

          {/* Items grouped by category */}
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
            <div key={category} className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-dark-900 border-b border-dark-700">
                <h4 className="text-xs font-semibold text-dark-200">{category} ({catItems.length})</h4>
                <button onClick={() => {
                  const allIds = catItems.map(i => i.itemid);
                  const allSelected = allIds.every(id => selectedItems.includes(id));
                  if (allSelected) setSelectedItems(prev => prev.filter(id => !allIds.includes(id)));
                  else setSelectedItems(prev => [...new Set([...prev, ...allIds])]);
                }} className="text-[10px] text-dark-400 hover:text-dark-200">
                  {catItems.every(i => selectedItems.includes(i.itemid)) ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="px-3 py-1.5 text-left w-8"></th>
                    <th className="px-3 py-1.5 text-left text-dark-400 font-medium">Nome</th>
                    <th className="px-3 py-1.5 text-right text-dark-400 font-medium">Valor Atual</th>
                    <th className="px-3 py-1.5 text-left text-dark-400 font-medium">Key</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map(item => (
                    <tr key={item.itemid} className={`border-b border-dark-800 hover:bg-dark-750 cursor-pointer transition-colors ${selectedItems.includes(item.itemid) ? 'bg-dark-750' : ''}`}
                      onClick={() => toggleItem(item.itemid)}>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" className="rounded" checked={selectedItems.includes(item.itemid)} readOnly />
                      </td>
                      <td className="px-3 py-1.5 text-dark-200">{item.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-dark-100">
                        {formatUnit(item.lastvalue, item.units)}
                      </td>
                      <td className="px-3 py-1.5 text-dark-500 font-mono text-[10px]">{item.key_}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-dark-400 text-sm">
              {searchTerm ? 'Nenhuma metrica encontrada para "' + searchTerm + '"' : 'Nenhuma metrica coletada.'}
            </div>
          )}
        </div>
      )}

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
                  {selectedItems.length} metrica(s) selecionada(s):
                </p>
                <div className="flex flex-wrap gap-1 mb-3 max-h-20 overflow-y-auto">
                  {selectedItems.map(id => {
                    const item = (items || []).find(i => i.itemid === id);
                    return item ? (
                      <span key={id} className="px-2 py-0.5 bg-dark-700 rounded text-[10px] text-dark-200 truncate max-w-[200px]">{item.name}</span>
                    ) : null;
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-dark-300 block mb-1">Selecionar aba do Dashboard</label>
                <select value={selectedDashTab} onChange={e => setSelectedDashTab(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                  {dashTabs.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.name}</option>
                  ))}
                </select>
              </div>

              {dashMsg && (
                <p className={`text-xs ${dashMsg.includes('adicionado') ? 'text-green-400' : 'text-red-400'}`}>{dashMsg}</p>
              )}

              <button onClick={addToDashboard} disabled={addingToDash || selectedItems.length === 0}
                className="w-full bg-accent-blue text-white py-2 rounded text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {addingToDash ? 'Adicionando...' : 'Adicionar Widget ao Dashboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
