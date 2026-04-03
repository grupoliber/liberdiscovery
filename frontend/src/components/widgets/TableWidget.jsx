import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const SEV_COLORS = { 1: 'bg-blue-500', 2: 'bg-yellow-500', 3: 'bg-orange-500', 4: 'bg-red-500', 5: 'bg-red-700' };
const SEV_NAMES = { 1: 'Info', 2: 'Aviso', 3: 'Medio', 4: 'Alto', 5: 'Desastre' };

export default function TableWidget({ config, onConfigChange, lastRefresh, selectedHost }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const { source = 'hosts', host_id } = config || {};
  const effectiveHostId = selectedHost || host_id;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (source === 'hosts') {
          const res = await fetch('/api/v1/devices?limit=500');
          if (res.ok) setData(await res.json());
        } else if (source === 'items' && effectiveHostId) {
          const res = await fetch(`/api/v1/metrics/${effectiveHostId}/items`);
          if (res.ok) setData(await res.json());
        } else if (source === 'alerts') {
          const res = await fetch('/api/v1/alerts?severity_min=1&limit=100');
          if (res.ok) setData(await res.json());
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [source, effectiveHostId, lastRefresh]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const columns = source === 'hosts'
    ? [
        { key: 'name', label: 'Nome', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'ip', label: 'IP', sortable: false },
        { key: 'groups', label: 'Grupo', sortable: false },
      ]
    : source === 'items'
    ? [
        { key: 'name', label: 'Item', sortable: true },
        { key: 'lastvalue', label: 'Valor', sortable: true },
        { key: 'units', label: 'Unidade', sortable: false },
        { key: 'lastclock', label: 'Atualizado', sortable: true },
      ]
    : [
        { key: 'severity', label: 'Severidade', sortable: true },
        { key: 'name', label: 'Alerta', sortable: true },
        { key: 'host', label: 'Host', sortable: false },
        { key: 'clock', label: 'Tempo', sortable: true },
      ];

  // Config mode se source=items e sem host
  if (source === 'items' && !effectiveHostId) {
    return (
      <div className="p-3 h-full flex flex-col">
        <div className="flex gap-2 mb-3">
          {['hosts', 'items', 'alerts'].map(s => (
            <button key={s} onClick={() => onConfigChange?.({ ...config, source: s })}
              className={`px-3 py-1 rounded text-xs ${source === s ? 'bg-accent-green text-white' : 'bg-dark-700 text-dark-300'}`}>
              {s === 'hosts' ? 'Hosts' : s === 'items' ? 'Items' : 'Alertas'}
            </button>
          ))}
        </div>
        <p className="text-xs text-dark-400">Selecione um host na toolbar ou configure o widget para ver os items.</p>
      </div>
    );
  }

  const renderCell = (row, col) => {
    const val = row[col.key];
    if (col.key === 'status') {
      const isUp = val === '0' || val === 0;
      return <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${isUp ? 'bg-green-500' : 'bg-red-500'}`}>{isUp ? 'Ativo' : 'Desativado'}</span>;
    }
    if (col.key === 'severity') {
      return <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${SEV_COLORS[val] || 'bg-gray-500'}`}>{SEV_NAMES[val] || val}</span>;
    }
    if (col.key === 'ip') {
      const iface = row.interfaces?.[0];
      return <span className="font-mono text-[10px]">{iface?.ip || '-'}</span>;
    }
    if (col.key === 'groups') {
      return <span className="text-[10px]">{row.groups?.map(g => g.name).join(', ') || '-'}</span>;
    }
    if (col.key === 'host' && source === 'alerts') {
      return <span className="text-[10px]">{row.hosts?.[0]?.name || '-'}</span>;
    }
    if (col.key === 'lastclock' || col.key === 'clock') {
      const ts = parseInt(val);
      return <span className="text-[10px]">{ts ? new Date(ts * 1000).toLocaleString('pt-BR') : '-'}</span>;
    }
    if (col.key === 'lastvalue') {
      return <span className="font-mono text-[10px]">{val ?? '-'} {row.units || ''}</span>;
    }
    return <span className="text-xs">{val ?? '-'}</span>;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Source selector tabs */}
      <div className="flex gap-1 px-2 pt-1 pb-1 shrink-0">
        {['hosts', 'items', 'alerts'].map(s => (
          <button key={s} onClick={() => onConfigChange?.({ ...config, source: s })}
            className={`px-2 py-0.5 rounded text-[10px] ${source === s ? 'bg-accent-green text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>
            {s === 'hosts' ? 'Hosts' : s === 'items' ? 'Items' : 'Alertas'}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-dark-500">{sorted.length} registros</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-dark-400 text-xs">Carregando...</div>
      ) : (
        <div className="flex-1 overflow-auto px-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-dark-900">
              <tr className="border-b border-dark-700">
                {columns.map(col => (
                  <th key={col.key} className="px-2 py-1.5 text-left text-dark-300 font-medium">
                    {col.sortable ? (
                      <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-dark-100">
                        {col.label}
                        {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map((row, i) => (
                <tr key={row.hostid || row.itemid || row.eventid || i} className="border-b border-dark-800 hover:bg-dark-800">
                  {columns.map(col => (
                    <td key={col.key} className="px-2 py-1.5 text-dark-200">
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
