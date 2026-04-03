import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const SEV_COLORS = { 1: '#3b82f6', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#dc2626' };
const SEV_NAMES = { 1: 'Info', 2: 'Aviso', 3: 'Médio', 4: 'Alto', 5: 'Desastre' };

export default function BarWidget({ data, config }) {
  const source = config?.source || 'severity';

  let chartData = [];
  if (source === 'severity' && data?.problems?.by_severity) {
    chartData = Object.entries(data.problems.by_severity).map(([sev, count]) => ({
      name: SEV_NAMES[sev] || `Sev ${sev}`,
      value: count,
      color: SEV_COLORS[sev] || '#6b7280',
    }));
  }

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-dark-400 text-sm">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
        <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
