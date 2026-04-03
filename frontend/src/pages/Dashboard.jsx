import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Edit3, Save, Trash2, GripVertical, LayoutDashboard } from 'lucide-react';
import StatCardsWidget from '../components/widgets/StatCardsWidget';
import PieWidget from '../components/widgets/PieWidget';
import BarWidget from '../components/widgets/BarWidget';
import AlertListWidget from '../components/widgets/AlertListWidget';
import MetricChartWidget from '../components/widgets/MetricChartWidget';
import GaugeWidget from '../components/widgets/GaugeWidget';
import AddWidgetModal from '../components/widgets/AddWidgetModal';

const WIDGET_SIZES = {
  stat_cards: { w: 12, h: 1 },
  pie: { w: 4, h: 2 },
  bar: { w: 4, h: 2 },
  alert_list: { w: 4, h: 2 },
  metric_chart: { w: 6, h: 2 },
  gauge: { w: 3, h: 2 },
};

function generateId() {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function Dashboard() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [dashStats, setDashStats] = useState(null);
  const [saving, setSaving] = useState(false);

  // Carregar config salva
  useEffect(() => {
    fetch('/api/v1/dashboard/config')
      .then(r => r.json())
      .then(data => {
        if (data.tabs?.length) setTabs(data.tabs);
      })
      .catch(() => {});
  }, []);

  // Carregar stats do dashboard (para widgets stat_cards, pie, bar)
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/dashboard/stats');
      if (res.ok) setDashStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 15000);
    return () => clearInterval(iv);
  }, [loadStats]);

  const currentTab = tabs[activeTab];

  // Salvar config
  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/v1/dashboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs }),
      });
    } catch {}
    setSaving(false);
    setEditMode(false);
  };

  // Adicionar aba
  const addTab = () => {
    if (!newTabName.trim()) return;
    setTabs([...tabs, { id: generateId(), name: newTabName.trim(), widgets: [] }]);
    setActiveTab(tabs.length);
    setNewTabName('');
    setShowAddTab(false);
  };

  // Remover aba
  const removeTab = (idx) => {
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter((_, i) => i !== idx);
    setTabs(newTabs);
    if (activeTab >= newTabs.length) setActiveTab(newTabs.length - 1);
  };

  // Adicionar widget
  const addWidget = (type) => {
    const size = WIDGET_SIZES[type] || { w: 6, h: 2 };
    const widget = {
      id: generateId(),
      type,
      title: getDefaultTitle(type),
      config: getDefaultConfig(type),
      ...size,
    };
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: [...(newTabs[activeTab].widgets || []), widget],
    };
    setTabs(newTabs);
    setShowAddWidget(false);
  };

  // Remover widget
  const removeWidget = (widgetId) => {
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.filter(w => w.id !== widgetId),
    };
    setTabs(newTabs);
  };

  // Atualizar config do widget
  const updateWidgetConfig = (widgetId, newConfig) => {
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.map(w =>
        w.id === widgetId ? { ...w, config: newConfig } : w
      ),
    };
    setTabs(newTabs);
  };

  // Atualizar título do widget
  const updateWidgetTitle = (widgetId, title) => {
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.map(w =>
        w.id === widgetId ? { ...w, title } : w
      ),
    };
    setTabs(newTabs);
  };

  // Alterar tamanho do widget
  const cycleWidgetSize = (widgetId) => {
    const sizes = [3, 4, 6, 8, 12];
    const newTabs = [...tabs];
    newTabs[activeTab] = {
      ...newTabs[activeTab],
      widgets: newTabs[activeTab].widgets.map(w => {
        if (w.id !== widgetId) return w;
        const curIdx = sizes.indexOf(w.w);
        const nextIdx = (curIdx + 1) % sizes.length;
        return { ...w, w: sizes[nextIdx] };
      }),
    };
    setTabs(newTabs);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-accent-green" size={24} />
          <h2 className="text-2xl font-bold">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-1.5 bg-accent-green text-white px-3 py-1.5 rounded text-xs hover:opacity-90"
              >
                <Plus size={14} /> Widget
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                className="flex items-center gap-1.5 bg-accent-blue text-white px-3 py-1.5 rounded text-xs hover:opacity-90 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="flex items-center gap-1.5 bg-dark-700 text-dark-200 px-3 py-1.5 rounded text-xs hover:bg-dark-600"
              >
                <X size={14} /> Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 bg-dark-700 text-dark-200 px-3 py-1.5 rounded text-xs hover:bg-dark-600"
            >
              <Edit3 size={14} /> Editar Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-dark-700 pb-1 overflow-x-auto">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t text-sm cursor-pointer transition-colors shrink-0 ${
              activeTab === idx
                ? 'bg-dark-800 text-accent-green border-b-2 border-accent-green'
                : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
            }`}
          >
            <span onClick={() => setActiveTab(idx)}>{tab.name}</span>
            {editMode && tabs.length > 1 && (
              <button onClick={() => removeTab(idx)} className="text-dark-500 hover:text-red-400 ml-1">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {editMode && (
          showAddTab ? (
            <div className="flex items-center gap-1 ml-2">
              <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTab()}
                placeholder="Nome da aba"
                className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-gray-100 w-28"
                autoFocus
              />
              <button onClick={addTab} className="text-accent-green text-xs">OK</button>
              <button onClick={() => setShowAddTab(false)} className="text-dark-400 text-xs">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddTab(true)}
              className="flex items-center gap-1 text-dark-400 hover:text-dark-200 text-xs ml-2 shrink-0"
            >
              <Plus size={14} /> Aba
            </button>
          )
        )}
      </div>

      {/* Widget Grid */}
      {currentTab ? (
        <div className="grid grid-cols-12 gap-4 auto-rows-[140px]">
          {(currentTab.widgets || []).map((widget) => (
            <div
              key={widget.id}
              className="bg-dark-900 border border-dark-700 rounded-lg overflow-hidden flex flex-col"
              style={{
                gridColumn: `span ${Math.min(widget.w || 6, 12)}`,
                gridRow: `span ${widget.h || 2}`,
              }}
            >
              {/* Widget Header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-700 shrink-0">
                {editMode ? (
                  <input
                    type="text"
                    value={widget.title}
                    onChange={(e) => updateWidgetTitle(widget.id, e.target.value)}
                    className="bg-transparent text-xs font-semibold text-dark-200 outline-none border-b border-dashed border-dark-500 w-full mr-2"
                  />
                ) : (
                  <span className="text-xs font-semibold text-dark-200">{widget.title}</span>
                )}
                {editMode && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => cycleWidgetSize(widget.id)}
                      className="text-dark-400 hover:text-dark-200"
                      title="Alterar tamanho"
                    >
                      <GripVertical size={12} />
                    </button>
                    <button
                      onClick={() => removeWidget(widget.id)}
                      className="text-dark-400 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Widget Content */}
              <div className="flex-1 min-h-0 p-1">
                <WidgetRenderer
                  widget={widget}
                  dashStats={dashStats}
                  onConfigChange={(newConfig) => updateWidgetConfig(widget.id, newConfig)}
                />
              </div>
            </div>
          ))}

          {/* Placeholder se não tem widgets */}
          {(!currentTab.widgets || currentTab.widgets.length === 0) && (
            <div className="col-span-12 row-span-2 flex items-center justify-center bg-dark-900 border border-dashed border-dark-600 rounded-lg">
              <div className="text-center">
                <LayoutDashboard size={48} className="mx-auto mb-3 text-dark-600" />
                <p className="text-dark-400 text-sm">Nenhum widget nesta aba.</p>
                <button
                  onClick={() => { setEditMode(true); setShowAddWidget(true); }}
                  className="mt-2 text-accent-green text-xs hover:underline"
                >
                  + Adicionar widget
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-dark-400">
          <p>Nenhuma aba configurada. Clique em "Editar Dashboard" para começar.</p>
        </div>
      )}

      {/* Modal Adicionar Widget */}
      {showAddWidget && (
        <AddWidgetModal
          onAdd={addWidget}
          onClose={() => setShowAddWidget(false)}
        />
      )}
    </div>
  );
}

function WidgetRenderer({ widget, dashStats, onConfigChange }) {
  switch (widget.type) {
    case 'stat_cards':
      return <StatCardsWidget data={dashStats} />;
    case 'pie':
      return <PieWidget data={dashStats} config={widget.config} />;
    case 'bar':
      return <BarWidget data={dashStats} config={widget.config} />;
    case 'alert_list':
      return <AlertListWidget config={widget.config} />;
    case 'metric_chart':
      return <MetricChartWidget config={widget.config} onConfigChange={onConfigChange} />;
    case 'gauge':
      return <GaugeWidget config={widget.config} onConfigChange={onConfigChange} />;
    default:
      return <div className="flex items-center justify-center h-full text-dark-400 text-xs">Widget desconhecido: {widget.type}</div>;
  }
}

function getDefaultTitle(type) {
  const titles = {
    stat_cards: 'Resumo do Sistema',
    pie: 'Status dos Hosts',
    bar: 'Alertas por Severidade',
    alert_list: 'Alertas Recentes',
    metric_chart: 'Gráfico de Métricas',
    gauge: 'Gauge',
  };
  return titles[type] || 'Novo Widget';
}

function getDefaultConfig(type) {
  const configs = {
    stat_cards: {},
    pie: { source: 'host_status' },
    bar: { source: 'severity' },
    alert_list: { limit: 10 },
    metric_chart: { chart_type: 'line', time_range: '1h' },
    gauge: { min: 0, max: 100, unit: '%' },
  };
  return configs[type] || {};
}
