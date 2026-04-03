import { X, BarChart3, PieChart, Activity, Gauge, AlertTriangle, LayoutGrid } from 'lucide-react';

const WIDGET_TYPES = [
  { type: 'metric_chart', label: 'Gráfico de Métricas', desc: 'Linha ou área com dados de um dispositivo', icon: Activity, color: 'text-green-400' },
  { type: 'gauge', label: 'Gauge (Velocímetro)', desc: 'Valor atual de uma métrica', icon: Gauge, color: 'text-blue-400' },
  { type: 'pie', label: 'Gráfico de Pizza', desc: 'Status dos hosts ou alertas', icon: PieChart, color: 'text-purple-400' },
  { type: 'bar', label: 'Gráfico de Barras', desc: 'Alertas por severidade', icon: BarChart3, color: 'text-orange-400' },
  { type: 'alert_list', label: 'Lista de Alertas', desc: 'Alertas recentes em tempo real', icon: AlertTriangle, color: 'text-yellow-400' },
  { type: 'stat_cards', label: 'Cards de Resumo', desc: 'Dispositivos, online, offline, alertas', icon: LayoutGrid, color: 'text-cyan-400' },
];

export default function AddWidgetModal({ onAdd, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Adicionar Widget</h3>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-200"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {WIDGET_TYPES.map(wt => (
            <button
              key={wt.type}
              onClick={() => onAdd(wt.type)}
              className="bg-dark-900 hover:bg-dark-700 border border-dark-600 hover:border-dark-500 rounded-lg p-4 text-left transition-colors"
            >
              <wt.icon size={24} className={`${wt.color} mb-2`} />
              <p className="text-sm font-medium text-dark-100">{wt.label}</p>
              <p className="text-[10px] text-dark-400 mt-0.5">{wt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
