import { useState, useCallback } from 'react';
import { usePolling } from '../hooks/useApi';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { Cpu, ChevronRight, ChevronDown, Activity, Wifi, Globe, Server, Radio } from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, Tooltip,
} from 'recharts';

const SENSOR_ICONS = {
  ping: Activity,
  snmp_traffic: Wifi,
  cpu_memory: Cpu,
  interfaces: Globe,
  http: Globe,
  dns: Globe,
  port: Server,
  olt_gpon: Radio,
  other: Activity,
};

const SENSOR_LABELS = {
  ping: 'Ping / ICMP',
  snmp_traffic: 'Tráfego SNMP',
  cpu_memory: 'CPU / Memória',
  interfaces: 'Interfaces',
  http: 'HTTP',
  dns: 'DNS',
  port: 'Portas TCP',
  olt_gpon: 'OLT / GPON',
  other: 'Outros',
};

const STATUS_COLORS = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  down_ack: 'bg-red-400',
  warning: 'bg-yellow-500',
  unknown: 'bg-gray-500',
};

const STATUS_BAR_COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  down_ack: '#f87171',
  warning: '#eab308',
  unknown: '#6b7280',
};

export default function Sensors() {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedHosts, setExpandedHosts] = useState(new Set());
  const [selectedSensor, setSelectedSensor] = useState(null);

  const fetchTree = useCallback(() =>
    fetch('/api/v1/sensors/tree').then(r => r.json()), []
  );
  const fetchSummary = useCallback(() =>
    fetch('/api/v1/sensors/summary').then(r => r.json()), []
  );

  const { data: tree, loading } = usePolling(fetchTree, 20000);
  const { data: summary } = usePolling(fetchSummary, 20000);

  const toggleGroup = (gid) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };

  const toggleHost = (hid) => {
    setExpandedHosts(prev => {
      const next = new Set(prev);
      next.has(hid) ? next.delete(hid) : next.add(hid);
      return next;
    });
  };

  if (loading && !tree) return <Loading text="Carregando sensores..." />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Activity className="text-accent-green" size={24} />
        <h2 className="text-2xl font-bold">Sensores</h2>
      </div>

      {/* Summary bar (estilo PRTG) */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card>
            <p className="text-xs text-dark-300">Grupos</p>
            <p className="text-2xl font-bold">{summary.groups}</p>
          </Card>
          <Card>
            <p className="text-xs text-dark-300">Hosts</p>
            <p className="text-2xl font-bold">{summary.hosts}</p>
          </Card>
          <Card>
            <p className="text-xs text-dark-300">Sensores</p>
            <p className="text-2xl font-bold text-accent-blue">{summary.sensors}</p>
          </Card>
          <Card>
            <p className="text-xs text-dark-300">Problemas</p>
            <p className="text-2xl font-bold text-accent-red">{summary.problems}</p>
          </Card>
          <Card>
            <div className="flex gap-1 mt-1">
              {Object.entries(summary.by_status || {}).map(([status, count]) => (
                count > 0 && (
                  <div
                    key={status}
                    className="h-6 rounded text-xs flex items-center justify-center text-white px-1.5"
                    style={{
                      backgroundColor: STATUS_BAR_COLORS[status] || '#6b7280',
                      flex: count,
                    }}
                  >
                    {count}
                  </div>
                )
              ))}
            </div>
            <p className="text-xs text-dark-400 mt-1">Status bar</p>
          </Card>
        </div>
      )}

      {/* Tree View */}
      <Card>
        <div className="space-y-1">
          {tree && tree.map(group => (
            <div key={group.groupid}>
              {/* Grupo */}
              <button
                onClick={() => toggleGroup(group.groupid)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-dark-800 transition-colors text-left"
              >
                {expandedGroups.has(group.groupid) ? (
                  <ChevronDown size={16} className="text-dark-400" />
                ) : (
                  <ChevronRight size={16} className="text-dark-400" />
                )}
                <Server size={16} className="text-accent-blue" />
                <span className="font-medium text-sm">{group.name}</span>
                <span className="text-xs text-dark-400 ml-auto">
                  {group.host_count} hosts &middot; {group.sensor_count} sensores
                </span>
                {group.problem_count > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                    {group.problem_count}
                  </span>
                )}
              </button>

              {/* Hosts dentro do grupo */}
              {expandedGroups.has(group.groupid) && (
                <div className="ml-6 space-y-0.5">
                  {group.hosts.map(host => (
                    <div key={host.hostid}>
                      <button
                        onClick={() => toggleHost(host.hostid)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-dark-800 transition-colors text-left"
                      >
                        {expandedHosts.has(host.hostid) ? (
                          <ChevronDown size={14} className="text-dark-400" />
                        ) : (
                          <ChevronRight size={14} className="text-dark-400" />
                        )}
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[host.status]}`} />
                        <span className="text-sm">{host.name}</span>
                        <span className="text-xs text-dark-400 ml-auto">
                          {host.sensor_count} sensores
                        </span>
                        {host.problem_count > 0 && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded">
                            {host.problem_count}
                          </span>
                        )}
                      </button>

                      {/* Sensores do host */}
                      {expandedHosts.has(host.hostid) && host.sensors && (
                        <div className="ml-8 space-y-0.5 py-1">
                          {Object.entries(host.sensors).map(([category, items]) => {
                            const Icon = SENSOR_ICONS[category] || Activity;
                            return (
                              <div key={category}>
                                <div className="flex items-center gap-2 px-2 py-1 text-xs text-dark-300 uppercase tracking-wider">
                                  <Icon size={12} />
                                  {SENSOR_LABELS[category] || category} ({items.length})
                                </div>
                                {items.slice(0, 10).map(item => (
                                  <button
                                    key={item.itemid}
                                    onClick={() => setSelectedSensor(item)}
                                    className={`w-full flex items-center gap-2 px-3 py-1 rounded text-left text-xs hover:bg-dark-700 transition-colors ${
                                      selectedSensor?.itemid === item.itemid ? 'bg-dark-700 border-l-2 border-accent-green' : ''
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      item.state === '0' ? 'bg-green-500' : 'bg-red-500'
                                    }`} />
                                    <span className="truncate flex-1">{item.name}</span>
                                    <span className="text-dark-200 font-mono whitespace-nowrap">
                                      {item.lastvalue} {item.units}
                                    </span>
                                  </button>
                                ))}
                                {items.length > 10 && (
                                  <p className="text-xs text-dark-500 px-3 py-1">
                                    +{items.length - 10} mais...
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Painel de detalhe do sensor selecionado */}
      {selectedSensor && (
        <SensorDetailPanel sensor={selectedSensor} onClose={() => setSelectedSensor(null)} />
      )}
    </div>
  );
}

function SensorDetailPanel({ sensor, onClose }) {
  const [detail, setDetail] = useState(null);

  useState(() => {
    fetch(`/api/v1/sensors/${sensor.itemid}`)
      .then(r => r.json())
      .then(setDetail);
  }, [sensor.itemid]);

  const chartData = detail?.history
    ?.map(h => ({
      time: new Date(parseInt(h.clock) * 1000).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit',
      }),
      value: parseFloat(h.value) || 0,
    }))
    .reverse() || [];

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">{sensor.name}</h4>
        <button onClick={onClose} className="text-dark-400 hover:text-white text-xs">Fechar</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-dark-400">Valor atual</p>
          <p className="text-lg font-bold">{sensor.lastvalue} {sensor.units}</p>
        </div>
        <div>
          <p className="text-xs text-dark-400">Key</p>
          <p className="text-xs font-mono text-dark-200">{sensor.key_}</p>
        </div>
        <div>
          <p className="text-xs text-dark-400">Último check</p>
          <p className="text-xs text-dark-200">
            {sensor.lastclock ? new Date(parseInt(sensor.lastclock) * 1000).toLocaleString('pt-BR') : '—'}
          </p>
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <Tooltip
              contentStyle={{ background: '#1f2a51', border: 'none', borderRadius: 8, color: '#e6e8f0' }}
            />
            <Line type="monotone" dataKey="value" stroke="#0f9d58" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
