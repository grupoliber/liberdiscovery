import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS_HOST = { up: '#22c55e', down: '#ef4444', unknown: '#6b7280' };
const COLORS_SEV = ['#3b82f6', '#eab308', '#f97316', '#ef4444', '#dc2626'];

export default function PieWidget({ data, config }) {
  const source = config?.source || 'host_status';

  let chartData = [];
  if (source === 'host_status' && data?.hosts) {
    const h = data.hosts;
    chartData = [
      { name: 'Online', value: h.up || 0, color: COLORS_HOST.up },
      { name: 'Offline', value: h.down || 0, color: COLORS_HOST.down },
      { name: 'Desconhecido', value: h.unknown || 0, color: COLORS_HOST.unknown },
    ].filter(d => d.value > 0);
  } else if (source === 'severity' && data?.problems?.by_severity) {
    const sevNames = { 2: 'Aviso', 3: 'Médio', 4: 'Alto', 5: 'Desastre' };
    chartData = Object.entries(data.problems.by_severity).map(([sev, count]) => ({
      name: sevNames[sev] || `Sev ${sev}`,
      value: count,
      color: COLORS_SEV[parseInt(sev) - 1] || '#6b7280',
    }));
  }

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-dark-400 text-sm">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
             innerRadius="40%" outerRadius="75%" paddingAngle={2}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
