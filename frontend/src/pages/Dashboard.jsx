import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { Plus, X, Edit3, Save, Trash2, LayoutDashboard, Maximize2, Minimize2, GripVertical, Copy } from 'lucide-react';
import { DashboardProvider, useDashboard } from '../contexts/DashboardContext';
import DashboardToolbar from '../components/DashboardToolbar';
import StatCardsWidget from '../components/widgets/StatCardsWidget';
import PieWidget from '../components/widgets/PieWidget';
import BarWidget from '../components/widgets/BarWidget';
import AlertListWidget from '../components/widgets/AlertListWidget';
import MetricChartWidget from '../components/widgets/MetricChartWidget';
import GaugeWidget from '../components/widgets/GaugeWidget';
import StatWidget from '../components/widgets/StatWidget';
import StateTimelineWidget from '../components/widgets/StateTimelineWidget';
import TableWidget from '../components/widgets/TableWidget';
import PPPoEWidget from '../components/widgets/PPPoEWidget';
import AddWidgetModal from '../components/widgets/AddWidgetModal';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_SIZES = {
  stat_cards: { w: 12, h: 3, minW: 6, minH: 2 },
  pie: { w: 4, h: 7, minW: 3, minH: 4 },
  bar: { w: 4, h: 7, minW: 3, minH: 4 },
  alert_list: { w: 4, h: 7, minW: 3, minH: 4 },
  metric_chart: { w: 6, h: 7, minW: 3, minH: 4 },
  gauge: { w: 3, h: 4, minW: 2, minH: 3 },
  stat: { w: 3, h: 4, minW: 2, minH: 2 },
  state_timeline: { w: 12, h: 4, minW: 6, minH: 3 },
  table: { w: 12, h: 6, minW: 6, minH: 4 },
  pppoe: { w: 4, h: 7, minW: 3, minH: 4 },
};

function generateId() {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getDefaultTitle(type) {
  const titles = {
    stat_cards: 'Resumo do Sistema', pie: 'Status dos Hosts', bar: 'Alertas por Severidade',
    alert_list: 'Alertas Recentes', metric_chart: 'Grafico de Metricas', gauge: 'Gauge',
    stat: 'Valor', state_timeline: 'Timeline', table: 'Tabela', pppoe: 'PPPoE Clientes',
  };
  return titles[type] || 'Widget';
}

function getDefaultConfig(type) {
  const configs = {
    pie: { source: 'host_status' }, bar: { source: 'severity' },
    alert_list: { limit: 10 }, metric_chart: { chart_type: 'area', time_range: 'global', thresholds: [] },
    pppoe: { show_breakdown: true },
  };
  return configs[type] || {};
}

function WidgetRenderer({ widget, dashStats, onConfigChange, lastRefresh, selectedHost, globalTimeRange, globalTimeRangeKey }) {
  const props = { config: widget.config, onConfigChange, lastRefresh, selectedHost };
  switch (widget.type) {
    case 'stat_cards': return <StatCardsWidget stats={dashStats} />;
    case 'pie': return <PieWidget config={widget.config} stats={dashStats} />;
    case 'bar': return <BarWidget config={widget.config} stats={dashStats} />;
    case 'alert_list': return <AlertListWidget config={widget.config} lastRefresh={lastRefresh} />;
    case 'metric_chart': return <MetricChartWidget {...props} globalTimeRange={globalTimeRange} globalTimeRangeKey={globalTimeRangeKey} />;
    case 'gauge': return <GaugeWidget {...props} />;
    case 'stat': return <StatWidget {...props} />;
    case 'state_timeline': return <StateTimelineWidget {...props} />;
    case 'table': return <TableWidget {...props} />;
    case 'pppoe': return <PPPoEWidget {...props} />;
    default: return <div className="flex items-center justify-center h-full text-dark-400 text-xs">Widget desconhecido: {widget.type}</div>;
  }
}

function DashboardContent() {
  const { lastRefresh, selectedHost, timeRange, timeRangeKey } = useDashboard();
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [dashStats, setDashStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fullscreenWidget, setFullscreenWidget] = useState(null);
  const [editingTabName, setEditingTabName] = useState(null);
  const [editTabValue, setEditTabValue] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [availableHosts, setAvailableHosts] = useState([]);
  const prevHostRef = useRef(undefined);

  // Compute the config key (host_id query param)
  const configKey = selectedHost || null; // null = global

  // Load dashboard config whenever host changes
  useEffect(() => {
    // Skip the very first render where prevHostRef is undefined
    if (prevHostRef.current === undefined) {
      prevHostRef.current = selectedHost;
    } else if (prevHostRef.current !== selectedHost) {
      prevHostRef.current = selectedHost;
      setEditMode(false);
      setFullscreenWidget(null);
    }

    setConfigLoaded(false);
    const url = configKey
      ? `/api/v1/dashboard/config?host_id=${configKey}`
      : '/api/v1/dashboard/config';

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.tabs?.length) {
          const migrated = data.tabs.map(tab => ({
            ...tab,
            widgets: (tab.widgets || []).map((w, i) => ({
              ...w,
              x: w.x ?? ((i * 6) % 12),
              y: w.y ?? (Math.floor(i / 2) * 5),
              w: w.w ?? (DEFAULT_SIZES[w.type]?.w || 6),
              h: (w.h && w.h > 4) ? w.h : (DEFAULT_SIZES[w.type]?.h || 7),
            })),
          }));
          setTabs(migrated);
        } else {
          setTabs([]);
        }
        setActiveTab(0);
        setConfigLoaded(true);
      })
      .catch(() => { setTabs([]); setConfigLoaded(true); });
  }, [selectedHost, configKey]);

  // Load available hosts for copy feature
  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget')
      .then(r => r.json())
      .then(data => setAvailableHosts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/dashboard/stats');
      if (res.ok) setDashStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats, lastRefresh]);

  const currentTab = tabs[activeTab];

  const saveConfig = async () => {
    setSaving(true);
    try {
      const url = configKey
        ? `/api/v1/dashboard/config?host_id=${configKey}`
        : '/api/v1/dashboard/config';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs }),
      });
    } catch {}
    setSaving(false);
    setEditMode(false);
  };

  // Copy dashboard from another host
  const copyFromHost = async (sourceHostId) => {
    const url = sourceHostId
      ? `/api/v1/dashboard/config?host_id=${sourceHostId}`
      : '/api/v1/dashboard/config';
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.tabs?.length) {
        // Deep clone and regenerate IDs to avoid conflicts
        const cloned = data.tabs.map(tab => ({
          ...tab,
          id: generateId(),
          widgets: (tab.widgets || []).map(w => ({
            ...w,
            id: generateId(),
            x: w.x ?? 0,
            y: w.y ?? 0,
            w: w.w ?? (DEFAULT_SIZES[w.type]?.w || 6),
            h: (w.h && w.h > 4) ? w.h : (DEFAULT_SIZES[w.type]?.h || 7),
          })),
        }));
        setTabs(cloned);
        setActiveTab(0);
      }
    } catch {}
    setShowCopyFrom(false);
  };

  const addTab = () => {
    if (!newTabName.trim()) return;
    setTabs([...tabs, { id: generateId(), name: newTabName.trim(), widgets: [] }]);
    setActiveTab(tabs.length);
    setNewTabName('');
    setShowAddTab(false);
  };

  const removeTab = (idx) => {
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter((_, i) => i !== idx);
    setTabs(newTabs);
    if (activeTab >= newTabs.length) setActiveTab(newTabs.length - 1);
  };

  const addWidget = (type) => {
    const size = DEFAULT_SIZES[type] || { w: 6, h: 5 };
    const widgets = currentTab?.widgets || [];
    let maxY = 0;
    widgets.forEach(w => { if ((w.y || 0) + (w.h || 5) > maxY) maxY = (w.y || 0) + (w.h || 5); });
    const widget = {
      id: generateId(),
      type,
      title: getDefaultTitle(type),
      config: getDefaultConfig(type),
      x: 0, y: maxY, w: size.w, h: size.h,
    };
    const newTabs = [...tabs];
    newTabs[activeTab] = { ...newTabs[activeTab], widgets: [...widgets, widget] };
    setTabs(newTabs);
    setShowAddWidget(false);
  };

  const removeWidget = (widgetId) => {
    const newTabs = [...tabs];
    newTabs[activeTab] = { ...newTabs[activeTab], widgets: newTabs[activeTab].widgets.filter(w => w.id !== widgetId) };
    setTabs(newTabs);
  };

  const updateWidgetConfig = (widgetId, newConfig) => {
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.map(w => w.id === widgetId ? { ...w, config: newConfig } : w),
    };
    setTabs(newTabs);
  };

  const updateWidgetTitle = (widgetId, title) => {
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.map(w => w.id === widgetId ? { ...w, title } : w),
    };
    setTabs(newTabs);
  };

  const handleLayoutChange = (layout) => {
    if (!editMode || !currentTab) return;
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.map(w => {
        const item = layout.find(l => l.i === w.id);
        if (item) return { ...w, x: item.x, y: item.y, w: item.w, h: item.h };
        return w;
      }),
    };
    setTabs(newTabs);
  };

  const gridLayout = useMemo(() => {
    if (!currentTab?.widgets) return [];
    return currentTab.widgets.map(w => ({
      i: w.id, x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 6, h: w.h ?? 5,
      minW: DEFAULT_SIZES[w.type]?.minW || 2, minH: DEFAULT_SIZES[w.type]?.minH || 2,
      static: !editMode,
    }));
  }, [currentTab, editMode]);

  // Find current host name for display
  const currentHostName = selectedHost
    ? availableHosts.find(h => h.hostid === selectedHost)?.name || `Host ${selectedHost}`
    : null;

  // Fullscreen overlay
  if (fullscreenWidget) {
    return (
      <div className="fixed inset-0 bg-dark-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700">
          <span className="text-sm font-semibold text-dark-200">{fullscreenWidget.title}</span>
          <button onClick={() => setFullscreenWidget(null)} className="text-dark-400 hover:text-white p-1">
            <Minimize2 size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-2">
          <WidgetRenderer widget={fullscreenWidget} dashStats={dashStats}
            onConfigChange={(cfg) => updateWidgetConfig(fullscreenWidget.id, cfg)}
            lastRefresh={lastRefresh} selectedHost={selectedHost}
            globalTimeRange={timeRange} globalTimeRangeKey={timeRangeKey} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-accent-green" size={24} />
          <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            {currentHostName && (
              <span className="text-xs text-accent-green">{currentHostName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => setShowCopyFrom(true)}
                className="flex items-center gap-1.5 bg-dark-600 text-dark-200 px-3 py-1.5 rounded text-xs hover:bg-dark-500"
                title="Copiar layout de outro host">
                <Copy size={14} /> Copiar de...
              </button>
              <button onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-1.5 bg-accent-green text-white px-3 py-1.5 rounded text-xs hover:opacity-90">
                <Plus size={14} /> Widget
              </button>
              <button onClick={saveConfig} disabled={saving}
                className="flex items-center gap-1.5 bg-accent-blue text-white px-3 py-1.5 rounded text-xs hover:opacity-90 disabled:opacity-50">
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => {
                setEditMode(false);
                const url = configKey ? `/api/v1/dashboard/config?host_id=${configKey}` : '/api/v1/dashboard/config';
                fetch(url).then(r => r.json()).then(d => { if (d.tabs?.length) setTabs(d.tabs); });
              }}
                className="flex items-center gap-1.5 bg-dark-700 text-dark-200 px-3 py-1.5 rounded text-xs hover:bg-dark-600">
                <X size={14} /> Cancelar
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 bg-dark-700 text-dark-200 px-3 py-1.5 rounded text-xs hover:bg-dark-600">
              <Edit3 size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      <DashboardToolbar />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-dark-700 pb-1 overflow-x-auto mt-3">
        {tabs.map((tab, idx) => (
          <div key={tab.id}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t text-sm cursor-pointer transition-colors shrink-0 ${
              activeTab === idx ? 'bg-dark-700 text-accent-green border-b-2 border-accent-green' : 'text-dark-300 hover:text-dark-100 hover:bg-dark-800'
            }`}
            onClick={() => setActiveTab(idx)}>
            {editMode && editingTabName === idx ? (
              <input type="text" value={editTabValue} onChange={e => setEditTabValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const nt = [...tabs]; nt[idx] = { ...nt[idx], name: editTabValue.trim() || tab.name }; setTabs(nt); setEditingTabName(null); } if (e.key === 'Escape') setEditingTabName(null); }}
                onBlur={() => { const nt = [...tabs]; nt[idx] = { ...nt[idx], name: editTabValue.trim() || tab.name }; setTabs(nt); setEditingTabName(null); }}
                className="bg-dark-900 border border-accent-green rounded px-1.5 py-0.5 text-xs text-gray-100 w-24"
                autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <span onDoubleClick={() => { if (editMode) { setEditingTabName(idx); setEditTabValue(tab.name); } }}>{tab.name}</span>
            )}
            {editMode && tabs.length > 1 && (
              <button onClick={e => { e.stopPropagation(); removeTab(idx); }} className="text-dark-500 hover:text-red-400 ml-1">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {editMode && (
          showAddTab ? (
            <div className="flex items-center gap-1 px-2">
              <input type="text" value={newTabName} onChange={e => setNewTabName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTab(); if (e.key === 'Escape') setShowAddTab(false); }}
                className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-gray-100 w-28"
                placeholder="Nome da aba" autoFocus />
              <button onClick={addTab} className="text-accent-green text-xs hover:underline">OK</button>
              <button onClick={() => setShowAddTab(false)} className="text-dark-500 hover:text-dark-300"><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => setShowAddTab(true)}
              className="flex items-center gap-1 px-3 py-2 text-dark-400 hover:text-accent-green text-sm shrink-0">
              <Plus size={14} /> Aba
            </button>
          )
        )}
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="bg-dark-800 border border-dark-600 rounded-lg px-4 py-2 mb-3 flex items-center gap-2 text-xs text-dark-300">
          <GripVertical size={14} className="text-accent-green" />
          <span>Modo edicao: <b className="text-dark-100">arraste</b> os widgets para reposicionar e <b className="text-dark-100">redimensione</b> pelas bordas. Duplo-clique no nome da aba para renomear.</span>
          {currentHostName && (
            <span className="ml-auto text-accent-green text-xs">Editando: {currentHostName}</span>
          )}
        </div>
      )}

      {/* Widget Grid */}
      {!configLoaded ? (
        <div className="text-center py-20 text-dark-400">
          <div className="animate-spin w-8 h-8 border-2 border-dark-600 border-t-accent-green rounded-full mx-auto mb-4" />
          <p className="text-sm">Carregando dashboard...</p>
        </div>
      ) : currentTab?.widgets?.length > 0 ? (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: gridLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 12, sm: 6 }}
          rowHeight={50}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          margin={[12, 12]}
          useCSSTransforms={true}
        >
          {currentTab.widgets.map(widget => (
            <div key={widget.id}
              className={`bg-dark-800 border rounded-lg overflow-hidden flex flex-col ${
                editMode ? 'border-dark-500 ring-1 ring-dark-600 cursor-move' : 'border-dark-700'
              }`}>
              <div className={`flex items-center justify-between px-3 py-1.5 border-b border-dark-700 shrink-0 ${editMode ? 'widget-drag-handle cursor-grab active:cursor-grabbing bg-dark-750' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {editMode && <GripVertical size={12} className="text-dark-500 shrink-0" />}
                  {editMode ? (
                    <input type="text" value={widget.title} onChange={e => updateWidgetTitle(widget.id, e.target.value)}
                      className="bg-transparent border-b border-dark-600 focus:border-accent-green text-xs font-medium text-dark-100 px-0 py-0.5 w-full outline-none"
                      onClick={e => e.stopPropagation()} />
                  ) : (
                    <span className="text-xs font-medium text-dark-200 truncate">{widget.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {!editMode && (
                    <button onClick={() => setFullscreenWidget(widget)} className="text-dark-500 hover:text-dark-200 p-0.5" title="Tela cheia">
                      <Maximize2 size={12} />
                    </button>
                  )}
                  {editMode && (
                    <button onClick={() => removeWidget(widget.id)} className="text-dark-500 hover:text-red-400 p-0.5" title="Remover">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <WidgetRenderer widget={widget} dashStats={dashStats}
                  onConfigChange={(cfg) => updateWidgetConfig(widget.id, cfg)}
                  lastRefresh={lastRefresh} selectedHost={selectedHost}
                  globalTimeRange={timeRange} globalTimeRangeKey={timeRangeKey} />
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        <div className="text-center py-20 text-dark-400">
          <LayoutDashboard size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">
            {currentHostName
              ? `Nenhuma dashboard configurada para ${currentHostName}`
              : 'Nenhum widget nesta aba'}
          </p>
          <p className="text-xs text-dark-500 mt-1">
            {currentHostName
              ? 'Clique em Editar para criar uma dashboard personalizada ou copiar de outro host'
              : 'Clique em Editar para adicionar widgets'}
          </p>
          {editMode && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button onClick={() => setShowAddWidget(true)}
                className="bg-accent-green text-white px-4 py-2 rounded text-sm hover:opacity-90">
                <Plus size={14} className="inline mr-1" /> Adicionar Widget
              </button>
              <button onClick={() => setShowCopyFrom(true)}
                className="bg-dark-600 text-dark-200 px-4 py-2 rounded text-sm hover:bg-dark-500">
                <Copy size={14} className="inline mr-1" /> Copiar de outro host
              </button>
            </div>
          )}
        </div>
      )}

      {showAddWidget && <AddWidgetModal onAdd={addWidget} onClose={() => setShowAddWidget(false)} />}

      {/* Copy from modal */}
      {showCopyFrom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCopyFrom(false)}>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 w-[400px] max-h-[500px] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-dark-100">Copiar dashboard de...</h3>
              <button onClick={() => setShowCopyFrom(false)} className="text-dark-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-xs text-dark-400 mb-3">Selecione um host para copiar sua dashboard como base para este host.</p>
            <div className="flex-1 overflow-y-auto space-y-1">
              <div
                className="px-3 py-2 rounded hover:bg-dark-700 cursor-pointer text-sm text-dark-200 flex items-center gap-2"
                onClick={() => copyFromHost(null)}>
                <LayoutDashboard size={14} className="text-accent-blue" />
                <span>Dashboard Global (Todos os hosts)</span>
              </div>
              <div className="border-t border-dark-700 my-2" />
              {availableHosts.filter(h => h.hostid !== selectedHost).map(h => (
                <div key={h.hostid}
                  className="px-3 py-2 rounded hover:bg-dark-700 cursor-pointer text-sm text-dark-200"
                  onClick={() => copyFromHost(h.hostid)}>
                  {h.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
