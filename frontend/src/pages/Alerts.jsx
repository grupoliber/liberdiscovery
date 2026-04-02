import { useState, useCallback } from 'react';
import { usePolling } from '../hooks/useApi';
import { getAlerts, acknowledgeAlerts, closeAlerts } from '../services/api';
import Card from '../components/Card';
import { SeverityBadge } from '../components/StatusBadge';
import Loading from '../components/Loading';
import { Bell, CheckCheck, XCircle, Filter } from 'lucide-react';

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState(0);
  const [ackFilter, setAckFilter] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const fetchAlerts = useCallback(
    () => getAlerts(severityFilter, ackFilter, 200),
    [severityFilter, ackFilter]
  );

  const { data: alerts, loading, refetch } = usePolling(fetchAlerts, 15000, [severityFilter, ackFilter]);

  const toggleSelect = (eventId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
      return next;
    });
  };

  const selectAll = () => {
    if (!alerts) return;
    if (selected.size === alerts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(alerts.map((a) => a.eventid)));
    }
  };

  const handleAck = async () => {
    if (selected.size === 0) return;
    await acknowledgeAlerts([...selected], 'Reconhecido via LiberDiscovery');
    setSelected(new Set());
    refetch();
  };

  const handleClose = async () => {
    if (selected.size === 0) return;
    await closeAlerts([...selected], 'Fechado via LiberDiscovery');
    setSelected(new Set());
    refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="text-accent-orange" size={24} />
          <h2 className="text-2xl font-bold">Alertas</h2>
          {alerts && (
            <span className="bg-dark-700 text-dark-200 text-xs px-2 py-1 rounded">
              {alerts.length} alertas
            </span>
          )}
        </div>

        {/* Ações em lote */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-300">{selected.size} selecionados</span>
            <button
              onClick={handleAck}
              className="flex items-center gap-1 bg-accent-blue text-white px-3 py-1.5 rounded text-sm hover:opacity-90"
            >
              <CheckCheck size={14} /> Reconhecer
            </button>
            <button
              onClick={handleClose}
              className="flex items-center gap-1 bg-accent-red text-white px-3 py-1.5 rounded text-sm hover:opacity-90"
            >
              <XCircle size={14} /> Fechar
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-dark-300" />
            <span className="text-xs text-dark-300">Severidade mínima:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(parseInt(e.target.value))}
              className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-gray-100"
            >
              <option value={0}>Todas</option>
              <option value={1}>Informação+</option>
              <option value={2}>Warning+</option>
              <option value={3}>Médio+</option>
              <option value={4}>Alto+</option>
              <option value={5}>Desastre</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-300">Status:</span>
            <select
              value={ackFilter === null ? 'all' : ackFilter.toString()}
              onChange={(e) => {
                const v = e.target.value;
                setAckFilter(v === 'all' ? null : v === 'true');
              }}
              className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-gray-100"
            >
              <option value="all">Todos</option>
              <option value="false">Não reconhecidos</option>
              <option value="true">Reconhecidos</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabela de alertas */}
      {loading && !alerts ? (
        <Loading text="Carregando alertas..." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-dark-300 border-b border-dark-700">
                  <th className="pb-3 pr-3 w-8">
                    <input
                      type="checkbox"
                      checked={alerts?.length > 0 && selected.size === alerts?.length}
                      onChange={selectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="pb-3 pr-3">Severidade</th>
                  <th className="pb-3 pr-3">Problema</th>
                  <th className="pb-3 pr-3">Host</th>
                  <th className="pb-3 pr-3">Início</th>
                  <th className="pb-3 pr-3">ACK</th>
                </tr>
              </thead>
              <tbody>
                {alerts && alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <tr
                      key={alert.eventid}
                      className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                    >
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(alert.eventid)}
                          onChange={() => toggleSelect(alert.eventid)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <SeverityBadge severity={parseInt(alert.severity)} />
                      </td>
                      <td className="py-3 pr-3 text-gray-100">{alert.name}</td>
                      <td className="py-3 pr-3 text-dark-200">
                        {alert.hosts?.[0]?.name || '—'}
                      </td>
                      <td className="py-3 pr-3 text-dark-300 text-xs">
                        {new Date(parseInt(alert.clock) * 1000).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 pr-3">
                        {alert.acknowledged === '1' ? (
                          <CheckCheck size={16} className="text-green-400" />
                        ) : (
                          <span className="text-xs text-dark-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-dark-400">
                      Nenhum alerta encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
