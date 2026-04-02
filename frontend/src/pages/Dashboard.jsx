import { usePolling } from '../hooks/useApi';
import { getDashboardStats, getAlerts } from '../services/api';
import Card from '../components/Card';
import { SeverityBadge } from '../components/StatusBadge';
import Loading from '../components/Loading';
import {
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const SEVERITY_COLORS = ['#6b7280', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#991b1b'];
const SEVERITY_LABELS = ['N/C', 'Info', 'Warning', 'Médio', 'Alto', 'Desastre'];

export default function Dashboard() {
  const { data: stats, loading } = usePolling(getDashboardStats, 15000);
  const { data: recentAlerts } = usePolling(() => getAlerts(2, null, 10), 15000);

  if (loading && !stats) return <Loading text="Carregando dashboard..." />;

  const hosts = stats?.hosts || { total: 0, up: 0, down: 0, unknown: 0 };
  const problems = stats?.problems || { total: 0, by_severity: {}, unacknowledged: 0 };

  const hostPieData = [
    { name: 'Online', value: hosts.up, color: '#22c55e' },
    { name: 'Offline', value: hosts.down, color: '#ef4444' },
    { name: 'Desconhecido', value: hosts.unknown, color: '#6b7280' },
  ].filter(d => d.value > 0);

  const severityBarData = Object.entries(problems.by_severity).map(([sev, count]) => ({
    name: SEVERITY_LABELS[sev] || sev,
    count,
    fill: SEVERITY_COLORS[sev] || '#6b7280',
  }));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <Server className="text-accent-blue" size={28} />
            <div>
              <p className="text-2xl font-bold">{hosts.total}</p>
              <p className="text-xs text-dark-300">Dispositivos</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500" size={28} />
            <div>
              <p className="text-2xl font-bold text-green-400">{hosts.up}</p>
              <p className="text-xs text-dark-300">Online</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <XCircle className="text-red-500" size={28} />
            <div>
              <p className="text-2xl font-bold text-red-400">{hosts.down}</p>
              <p className="text-xs text-dark-300">Offline</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-yellow-500" size={28} />
            <div>
              <p className="text-2xl font-bold text-yellow-400">{problems.total}</p>
              <p className="text-xs text-dark-300">
                Alertas ({problems.unacknowledged} não reconhecidos)
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Status dos Hosts">
          {hostPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={hostPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {hostPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-dark-400 text-sm py-8 text-center">Sem dados</p>
          )}
        </Card>

        <Card title="Alertas por Severidade">
          {severityBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={severityBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a51" />
                <XAxis dataKey="name" tick={{ fill: '#9ba2ba', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ba2ba', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#1f2a51', border: 'none', borderRadius: 8 }}
                />
                <Bar dataKey="count" name="Quantidade">
                  {severityBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-dark-400 text-sm py-8 text-center">Nenhum alerta ativo</p>
          )}
        </Card>
      </div>

      {/* Alertas recentes */}
      <Card title="Alertas Recentes">
        {recentAlerts && recentAlerts.length > 0 ? (
          <div className="space-y-2">
            {recentAlerts.map((alert) => (
              <div
                key={alert.eventid}
                className="flex items-center justify-between bg-dark-800 rounded px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={parseInt(alert.severity)} />
                  <span className="text-sm">{alert.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-dark-300">
                  <span>
                    {alert.hosts?.[0]?.name || '—'}
                  </span>
                  <span>
                    {new Date(parseInt(alert.clock) * 1000).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-400 text-sm text-center py-4">Nenhum alerta recente</p>
        )}
      </Card>
    </div>
  );
}
