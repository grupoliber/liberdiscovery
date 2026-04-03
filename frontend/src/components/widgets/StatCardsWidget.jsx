import { Server, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

export default function StatCardsWidget({ data }) {
  if (!data) return null;
  const { hosts, problems } = data;

  const cards = [
    { label: 'Dispositivos', value: hosts?.total || 0, icon: Server, color: 'text-accent-blue' },
    { label: 'Online', value: hosts?.up || 0, icon: Wifi, color: 'text-green-400' },
    { label: 'Offline', value: hosts?.down || 0, icon: WifiOff, color: 'text-red-400' },
    { label: 'Alertas', value: problems?.total || 0, icon: AlertTriangle, color: 'text-yellow-400',
      sub: problems?.unacknowledged ? `${problems.unacknowledged} não reconhecidos` : null },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
      {cards.map((c, i) => (
        <div key={i} className="bg-dark-800 rounded-lg p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <c.icon size={16} className={c.color} />
            <span className="text-xs text-dark-300">{c.label}</span>
          </div>
          <span className="text-2xl font-bold">{c.value}</span>
          {c.sub && <span className="text-xs text-dark-400 mt-0.5">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}
