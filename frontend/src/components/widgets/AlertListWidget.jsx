import { useState, useEffect } from 'react';

const SEV_COLORS = {
  1: 'bg-blue-500', 2: 'bg-yellow-500', 3: 'bg-orange-500', 4: 'bg-red-500', 5: 'bg-red-700',
};
const SEV_NAMES = { 1: 'Info', 2: 'Aviso', 3: 'Médio', 4: 'Alto', 5: 'Desastre' };

export default function AlertListWidget({ config }) {
  const [alerts, setAlerts] = useState([]);
  const limit = config?.limit || 10;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/alerts?severity_min=2&limit=${limit}`);
        if (res.ok) setAlerts(await res.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [limit]);

  if (alerts.length === 0) {
    return <div className="flex items-center justify-center h-full text-dark-400 text-sm">Nenhum alerta ativo</div>;
  }

  return (
    <div className="overflow-y-auto h-full space-y-1.5 pr-1">
      {alerts.map((a) => (
        <div key={a.eventid} className="flex items-start gap-2 bg-dark-800 rounded p-2">
          <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] text-white font-medium ${SEV_COLORS[a.severity] || 'bg-gray-500'}`}>
            {SEV_NAMES[a.severity] || a.severity}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-dark-100 truncate">{a.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {a.hosts?.[0] && (
                <span className="text-[10px] text-dark-400">{a.hosts[0].name}</span>
              )}
              <span className="text-[10px] text-dark-500">
                {new Date(parseInt(a.clock) * 1000).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
