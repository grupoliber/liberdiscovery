import { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { getDevices, getItems, getHistory } from '../services/api';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { BarChart3 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function Metrics() {
  const [selectedHost, setSelectedHost] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const { data: devices } = useApi(useCallback(() => getDevices(null, 200), []));

  const fetchItems = useCallback(
    () => (selectedHost ? getItems(selectedHost) : Promise.resolve([])),
    [selectedHost]
  );
  const { data: items, loading: loadingItems } = useApi(fetchItems, [selectedHost]);

  const fetchHistory = useCallback(
    () => {
      if (!selectedItem) return Promise.resolve([]);
      const item = items?.find((i) => i.itemid === selectedItem);
      const valueType = item ? parseInt(item.value_type) : 0;
      const timeFrom = Math.floor(Date.now() / 1000) - 3600; // última hora
      return getHistory([selectedItem], valueType, timeFrom, null, 300);
    },
    [selectedItem, items]
  );
  const { data: history, loading: loadingHistory } = useApi(fetchHistory, [selectedItem]);

  const chartData = history
    ?.map((h) => ({
      time: new Date(parseInt(h.clock) * 1000).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: parseFloat(h.value) || 0,
    }))
    .reverse();

  const selectedItemInfo = items?.find((i) => i.itemid === selectedItem);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="text-accent-purple" size={24} />
        <h2 className="text-2xl font-bold">Métricas</h2>
      </div>

      {/* Seletores */}
      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-300">Host:</span>
            <select
              value={selectedHost || ''}
              onChange={(e) => {
                setSelectedHost(e.target.value || null);
                setSelectedItem(null);
              }}
              className="bg-dark-800 border border-dark-600 rounded px-3 py-1.5 text-sm text-gray-100 min-w-[200px]"
            >
              <option value="">Selecione um host...</option>
              {devices?.map((d) => (
                <option key={d.hostid} value={d.hostid}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {selectedHost && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-300">Métrica:</span>
              <select
                value={selectedItem || ''}
                onChange={(e) => setSelectedItem(e.target.value || null)}
                className="bg-dark-800 border border-dark-600 rounded px-3 py-1.5 text-sm text-gray-100 min-w-[300px]"
              >
                <option value="">Selecione uma métrica...</option>
                {items?.map((item) => (
                  <option key={item.itemid} value={item.itemid}>
                    {item.name} ({item.lastvalue} {item.units})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Gráfico */}
      {loadingItems || loadingHistory ? (
        <Loading text="Carregando métricas..." />
      ) : chartData && chartData.length > 0 ? (
        <Card title={`${selectedItemInfo?.name || 'Métrica'} — última hora`}>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a51" />
              <XAxis dataKey="time" tick={{ fill: '#9ba2ba', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ba2ba', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1f2a51',
                  border: 'none',
                  borderRadius: 8,
                  color: '#e6e8f0',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0f9d58"
                strokeWidth={2}
                dot={false}
                name={selectedItemInfo?.units || 'Valor'}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : selectedItem ? (
        <Card>
          <p className="text-dark-400 text-center py-12">Nenhum dado de histórico encontrado para esta métrica.</p>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-16 text-dark-400">
            <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
            <p>Selecione um host e uma métrica para visualizar o gráfico.</p>
          </div>
        </Card>
      )}

      {/* Lista de métricas atuais */}
      {selectedHost && items && items.length > 0 && (
        <Card title="Valores Atuais" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.slice(0, 24).map((item) => (
              <button
                key={item.itemid}
                onClick={() => setSelectedItem(item.itemid)}
                className={`text-left bg-dark-800 rounded p-3 hover:bg-dark-700 transition-colors border ${
                  selectedItem === item.itemid
                    ? 'border-accent-green'
                    : 'border-transparent'
                }`}
              >
                <p className="text-xs text-dark-300 truncate">{item.name}</p>
                <p className="text-sm font-bold mt-1">
                  {item.lastvalue} <span className="text-xs text-dark-400">{item.units}</span>
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
