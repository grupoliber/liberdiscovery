import { useState, useEffect, useRef } from 'react';
import { ChevronDown, RotateCw, Loader, Server, Clock, RefreshCw } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';

const TIME_LABELS = {
  '5m': 'Ultimos 5m', '15m': 'Ultimos 15m', '30m': 'Ultimos 30m',
  '1h': 'Ultima hora', '3h': 'Ultimas 3h', '6h': 'Ultimas 6h',
  '12h': 'Ultimas 12h', '24h': 'Ultimas 24h', '2d': 'Ultimos 2d', '7d': 'Ultimos 7d',
};

const REFRESH_LABELS = {
  'off': 'Off', '5s': '5s', '10s': '10s', '30s': '30s', '1m': '1m', '5m': '5m',
};

export default function DashboardToolbar() {
  const {
    timeRangeKey, setTimeRangeKey,
    refreshIntervalKey, setRefreshIntervalKey,
    selectedHost, setSelectedHost,
    triggerRefresh, isRefreshing,
  } = useDashboard();

  const [hosts, setHosts] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null); // 'host' | 'time' | 'refresh' | null
  const toolbarRef = useRef(null);

  useEffect(() => {
    fetch('/api/v1/dashboard/hosts-for-widget')
      .then(r => r.json())
      .then(data => setHosts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedHostName = selectedHost
    ? hosts.find(h => h.hostid === selectedHost)?.name || 'Host'
    : 'Todos os hosts';

  return (
    <div ref={toolbarRef} className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 flex items-center justify-between gap-3">
      {/* Host filter */}
      <div className="relative">
        <button onClick={() => setOpenDropdown(openDropdown === 'host' ? null : 'host')}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 text-xs transition-colors border border-dark-600">
          <Server size={13} />
          <span className="truncate max-w-[180px]">{selectedHostName}</span>
          <ChevronDown size={13} />
        </button>
        {openDropdown === 'host' && (
          <div className="absolute top-full left-0 mt-1 bg-dark-700 border border-dark-600 rounded-lg shadow-xl z-50 min-w-[240px] py-1">
            <div className={`px-3 py-2 hover:bg-dark-600 cursor-pointer text-xs ${!selectedHost ? 'text-accent-green' : 'text-dark-200'}`}
              onClick={() => { setSelectedHost(null); setOpenDropdown(null); }}>
              Todos os hosts
            </div>
            <div className="border-t border-dark-600 my-1" />
            <div className="max-h-60 overflow-y-auto">
              {hosts.map(h => (
                <div key={h.hostid}
                  className={`px-3 py-1.5 hover:bg-dark-600 cursor-pointer text-xs ${selectedHost === h.hostid ? 'text-accent-green' : 'text-dark-200'}`}
                  onClick={() => { setSelectedHost(h.hostid); setOpenDropdown(null); }}>
                  {h.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Time range */}
        <div className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === 'time' ? null : 'time')}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 text-xs transition-colors border border-dark-600">
            <Clock size={13} />
            <span>{TIME_LABELS[timeRangeKey]}</span>
            <ChevronDown size={13} />
          </button>
          {openDropdown === 'time' && (
            <div className="absolute top-full right-0 mt-1 bg-dark-700 border border-dark-600 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
              {Object.entries(TIME_LABELS).map(([key, label]) => (
                <div key={key}
                  className={`px-3 py-1.5 hover:bg-dark-600 cursor-pointer text-xs ${timeRangeKey === key ? 'text-accent-green' : 'text-dark-200'}`}
                  onClick={() => { setTimeRangeKey(key); setOpenDropdown(null); triggerRefresh(); }}>
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-refresh */}
        <div className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === 'refresh' ? null : 'refresh')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 text-xs transition-colors border border-dark-600">
            {refreshIntervalKey !== 'off' && <Loader size={12} className="animate-spin text-accent-blue" />}
            <RefreshCw size={13} />
            <span>{REFRESH_LABELS[refreshIntervalKey]}</span>
          </button>
          {openDropdown === 'refresh' && (
            <div className="absolute top-full right-0 mt-1 bg-dark-700 border border-dark-600 rounded-lg shadow-xl z-50 min-w-[120px] py-1">
              {Object.entries(REFRESH_LABELS).map(([key, label]) => (
                <div key={key}
                  className={`px-3 py-1.5 hover:bg-dark-600 cursor-pointer text-xs ${refreshIntervalKey === key ? 'text-accent-green' : 'text-dark-200'}`}
                  onClick={() => { setRefreshIntervalKey(key); setOpenDropdown(null); }}>
                  {key === 'off' ? 'Desativado' : `A cada ${label}`}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refresh now */}
        <button onClick={triggerRefresh} disabled={isRefreshing}
          className="p-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-accent-green border border-dark-600 transition-colors disabled:opacity-50"
          title="Atualizar agora">
          <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}
