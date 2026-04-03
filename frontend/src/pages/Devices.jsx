import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi, usePolling } from '../hooks/useApi';
import { getDevices, getDeviceGroups } from '../services/api';
import Card from '../components/Card';
import { AvailabilityBadge } from '../components/StatusBadge';
import Loading from '../components/Loading';
import AddDeviceModal from '../components/AddDeviceModal';
import { Server, Search, Plus, Trash2, Pause, Play, MoreVertical } from 'lucide-react';

export default function Devices() {
  const [groupFilter, setGroupFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);

  const { data: groups, refetch: refetchGroups } = useApi(getDeviceGroups);
  const fetchDevices = useCallback(() => getDevices(groupFilter || null, 500), [groupFilter]);
  const { data: devices, loading, refetch: refetchDevices } = usePolling(fetchDevices, 30000, [groupFilter]);

  const filtered = devices?.filter(
    (d) =>
      !search ||
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.host?.toLowerCase().includes(search.toLowerCase()) ||
      d.interfaces?.some((iface) => iface.ip?.includes(search))
  );

  const toggleSelect = (hostId) => {
    setSelectedDevices(prev =>
      prev.includes(hostId) ? prev.filter(id => id !== hostId) : [...prev, hostId]
    );
  };

  const selectAll = () => {
    if (selectedDevices.length === (filtered?.length || 0)) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(filtered?.map(d => d.hostid) || []);
    }
  };

  const deleteDevice = async (hostId) => {
    if (!confirm('Tem certeza que deseja remover este dispositivo?')) return;
    try {
      const res = await fetch(`/api/v1/devices/${hostId}`, { method: 'DELETE' });
      if (res.ok) refetchDevices();
      else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Erro ao remover');
      }
    } catch {}
  };

  const deleteSelected = async () => {
    if (!selectedDevices.length) return;
    if (!confirm(`Remover ${selectedDevices.length} dispositivo(s)?`)) return;
    for (const id of selectedDevices) {
      await fetch(`/api/v1/devices/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    setSelectedDevices([]);
    refetchDevices();
  };

  const toggleStatus = async (hostId, currentStatus) => {
    const newStatus = currentStatus === '0' ? 1 : 0;
    try {
      await fetch(`/api/v1/devices/${hostId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      refetchDevices();
    } catch {}
    setMenuOpen(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Server className="text-accent-blue" size={24} />
          <h2 className="text-2xl font-bold">Dispositivos</h2>
          {filtered && (
            <span className="bg-dark-700 text-dark-200 text-xs px-2 py-1 rounded">
              {filtered.length} hosts
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddDevice(true)}
          className="flex items-center gap-2 bg-accent-green text-white px-4 py-2 rounded text-sm hover:opacity-90"
        >
          <Plus size={16} /> Novo Dispositivo
        </button>
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
          {selectedDevices.length > 0 && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-2 rounded text-xs hover:bg-red-500/30"
            >
              <Trash2 size={14} /> Remover ({selectedDevices.length})
            </button>
          )}
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
                  <th className="pb-3 pr-2 w-8">
                    <input
                      type="checkbox"
                      onChange={selectAll}
                      checked={filtered?.length > 0 && selectedDevices.length === filtered?.length}
                    />
                  </th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Nome</th>
                  <th className="pb-3 pr-3">IP</th>
                  <th className="pb-3 pr-3">Interface</th>
                  <th className="pb-3 pr-3">Grupo</th>
                  <th className="pb-3 pr-3">Templates</th>
                  <th className="pb-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.length > 0 ? (
                  filtered.map((device) => {
                    const mainIface = device.interfaces?.[0];
                    const ifaceType = mainIface?.type === '2' ? 'SNMP' : mainIface?.type === '1' ? 'Agent' : mainIface?.type === '3' ? 'IPMI' : '—';

                    return (
                      <tr
                        key={device.hostid}
                        className={`border-b border-dark-800 hover:bg-dark-800 transition-colors ${
                          device.status === '1' ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedDevices.includes(device.hostid)}
                            onChange={() => toggleSelect(device.hostid)}
                          />
                        </td>
                        <td className="py-3 pr-3">
                          <AvailabilityBadge available={device.available} />
                        </td>
                        <td className="py-3 pr-3">
                          <Link to={`/devices/${device.hostid}`} className="text-accent-blue hover:underline">
                            {device.name}
                          </Link>
                          {device.status === '1' && (
                            <span className="ml-2 text-[10px] bg-dark-600 text-dark-300 px-1.5 py-0.5 rounded">Desabilitado</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-dark-200 font-mono text-xs">
                          {mainIface?.ip || '—'}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            ifaceType === 'SNMP' ? 'bg-purple-500/20 text-purple-300' :
                            ifaceType === 'Agent' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-dark-600 text-dark-300'
                          }`}>
                            {ifaceType}{mainIface?.port ? `:${mainIface.port}` : ''}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-dark-300 text-xs">
                          {device.groups?.map((g) => g.name).join(', ') || '—'}
                        </td>
                        <td className="py-3 pr-3 text-dark-400 text-xs max-w-[200px] truncate">
                          {device.parentTemplates?.map((t) => t.name).join(', ') || '—'}
                        </td>
                        <td className="py-3 relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === device.hostid ? null : device.hostid)}
                            className="text-dark-400 hover:text-dark-200 p-1"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {menuOpen === device.hostid && (
                            <div className="absolute right-0 top-8 bg-dark-700 border border-dark-600 rounded-lg shadow-xl z-10 py-1 min-w-[150px]">
                              <button
                                onClick={() => toggleStatus(device.hostid, device.status)}
                                className="w-full text-left px-3 py-1.5 text-xs text-dark-200 hover:bg-dark-600 flex items-center gap-2"
                              >
                                {device.status === '0' ? <Pause size={12} /> : <Play size={12} />}
                                {device.status === '0' ? 'Desabilitar' : 'Habilitar'}
                              </button>
                              <button
                                onClick={() => { deleteDevice(device.hostid); setMenuOpen(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-dark-600 flex items-center gap-2"
                              >
                                <Trash2 size={12} /> Remover
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-dark-400">
                      Nenhum dispositivo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      {showAddDevice && (
        <AddDeviceModal
          onClose={() => setShowAddDevice(false)}
          onSuccess={() => { refetchDevices(); refetchGroups(); }}
        />
      )}
    </div>
  );
}
