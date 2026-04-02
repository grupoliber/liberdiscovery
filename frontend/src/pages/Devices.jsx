import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi, usePolling } from '../hooks/useApi';
import { getDevices, getDeviceGroups } from '../services/api';
import Card from '../components/Card';
import { AvailabilityBadge } from '../components/StatusBadge';
import Loading from '../components/Loading';
import { Server, Search } from 'lucide-react';

export default function Devices() {
  const [groupFilter, setGroupFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: groups } = useApi(getDeviceGroups);

  const fetchDevices = useCallback(() => getDevices(groupFilter || null, 500), [groupFilter]);
  const { data: devices, loading } = usePolling(fetchDevices, 30000, [groupFilter]);

  const filtered = devices?.filter(
    (d) =>
      !search ||
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.host?.toLowerCase().includes(search.toLowerCase()) ||
      d.interfaces?.some((iface) => iface.ip?.includes(search))
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Server className="text-accent-blue" size={24} />
        <h2 className="text-2xl font-bold">Dispositivos</h2>
        {filtered && (
          <span className="bg-dark-700 text-dark-200 text-xs px-2 py-1 rounded">
            {filtered.length} hosts
          </span>
        )}
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              placeholder="Buscar por nome, host ou IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600 rounded pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-dark-400"
            />
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
          >
            <option value="">Todos os grupos</option>
            {groups?.map((g) => (
              <option key={g.groupid} value={g.groupid}>
                {g.name} ({g.hosts})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabela */}
      {loading && !devices ? (
        <Loading text="Carregando dispositivos..." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-dark-300 border-b border-dark-700">
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Nome</th>
                  <th className="pb-3 pr-3">IP</th>
                  <th className="pb-3 pr-3">Grupo</th>
                  <th className="pb-3 pr-3">Templates</th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.length > 0 ? (
                  filtered.map((device) => (
                    <tr
                      key={device.hostid}
                      className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                    >
                      <td className="py-3 pr-3">
                        <AvailabilityBadge available={device.available} />
                      </td>
                      <td className="py-3 pr-3">
                        <Link
                          to={`/devices/${device.hostid}`}
                          className="text-accent-blue hover:underline"
                        >
                          {device.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-dark-200 font-mono text-xs">
                        {device.interfaces?.[0]?.ip || '—'}
                      </td>
                      <td className="py-3 pr-3 text-dark-300 text-xs">
                        {device.groups?.map((g) => g.name).join(', ') || '—'}
                      </td>
                      <td className="py-3 pr-3 text-dark-400 text-xs">
                        {device.parentTemplates?.map((t) => t.name).join(', ') || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-dark-400">
                      Nenhum dispositivo encontrado.
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
