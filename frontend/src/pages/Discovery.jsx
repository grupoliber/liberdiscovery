import { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { Radar, Plus, Trash2, Play, Pause, Clock, Globe } from 'lucide-react';

const CHECK_TYPE_NAMES = {
  0: 'SSH', 1: 'LDAP', 2: 'SMTP', 3: 'FTP', 4: 'HTTP', 5: 'POP',
  8: 'TCP', 9: 'Zabbix Agent', 10: 'SNMPv1', 11: 'SNMPv2', 12: 'ICMP Ping',
  13: 'SNMPv3', 14: 'HTTPS', 15: 'Telnet',
};

const DSERVICE_STATUS = { '0': 'Up', '1': 'Down' };

export default function Discovery() {
  const [showCreate, setShowCreate] = useState(false);

  const fetchRules = useCallback(() =>
    fetch('/api/v1/discovery/rules').then(r => r.json()), []
  );
  const { data: rules, loading, refetch: refetchRules } = useApi(fetchRules);

  const [selectedRule, setSelectedRule] = useState(null);

  const fetchHosts = useCallback(() => {
    if (!selectedRule) return Promise.resolve([]);
    return fetch(`/api/v1/discovery/hosts?drule_id=${selectedRule}`).then(r => r.json());
  }, [selectedRule]);
  const { data: discoveredHosts, loading: loadingHosts, refetch: refetchHosts } = useApi(fetchHosts, [selectedRule]);

  const toggleRule = async (ruleId, currentStatus) => {
    const newStatus = currentStatus === '0' ? 1 : 0;
    await fetch(`/api/v1/discovery/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    refetchRules();
  };

  const deleteRule = async (ruleId) => {
    if (!confirm('Remover esta regra de discovery?')) return;
    await fetch(`/api/v1/discovery/rules/${ruleId}`, { method: 'DELETE' });
    refetchRules();
  };

  const createRule = async (formData) => {
    try {
      const res = await fetch('/api/v1/discovery/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao criar regra: ${err.detail || res.statusText}`);
        return;
      }
      setShowCreate(false);
      refetchRules();
    } catch (err) {
      alert(`Erro de conexão: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radar className="text-accent-purple" size={24} />
          <h2 className="text-2xl font-bold">Auto-Discovery</h2>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-accent-green text-white px-4 py-2 rounded text-sm hover:opacity-90"
        >
          <Plus size={16} /> Nova Regra
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreate && <CreateRuleForm onSubmit={createRule} onCancel={() => setShowCreate(false)} />}

      {/* Lista de regras */}
      {loading && !rules ? (
        <Loading text="Carregando regras..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {rules && rules.map(rule => (
            <Card key={rule.druleid} className={`cursor-pointer transition-all ${
              selectedRule === rule.druleid ? 'ring-1 ring-accent-green' : ''
            }`}>
              <div onClick={() => {
                setSelectedRule(selectedRule === rule.druleid ? null : rule.druleid);
              }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{rule.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRule(rule.druleid, rule.status); }}
                      className={`p-1 rounded ${rule.status === '0' ? 'text-green-400' : 'text-dark-400'}`}
                      title={rule.status === '0' ? 'Ativo - clique para pausar' : 'Pausado - clique para ativar'}
                    >
                      {rule.status === '0' ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRule(rule.druleid); }}
                      className="p-1 rounded text-dark-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-dark-300">
                    <Globe size={12} /> {rule.iprange}
                  </div>
                  <div className="flex items-center gap-1 text-dark-300">
                    <Clock size={12} /> Intervalo: {rule.delay}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {rule.dchecks?.map(check => (
                    <span key={check.dcheckid} className="bg-dark-700 text-dark-200 text-xs px-2 py-0.5 rounded">
                      {CHECK_TYPE_NAMES[check.type] || `Type ${check.type}`}
                      {check.ports ? `:${check.ports}` : ''}
                    </span>
                  ))}
                </div>

                <div className="mt-2 text-xs text-dark-400">
                  {rule.dhosts || 0} hosts descobertos
                </div>
              </div>
            </Card>
          ))}

          {rules && rules.length === 0 && (
            <Card className="col-span-2">
              <div className="text-center py-8 text-dark-400">
                <Radar size={48} className="mx-auto mb-3 opacity-30" />
                <p>Nenhuma regra de discovery configurada.</p>
                <p className="text-xs mt-1">Clique em "Nova Regra" para começar a descobrir sua rede.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Hosts descobertos */}
      {selectedRule && (
        <Card title="Hosts Descobertos">
          {loadingHosts ? (
            <Loading text="Carregando hosts descobertos..." />
          ) : discoveredHosts && discoveredHosts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-300 border-b border-dark-700">
                    <th className="pb-2 pr-3">IP</th>
                    <th className="pb-2 pr-3">Serviço</th>
                    <th className="pb-2 pr-3">Porta</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Último Up</th>
                  </tr>
                </thead>
                <tbody>
                  {discoveredHosts.flatMap(dhost =>
                    (dhost.dservices || []).map(svc => (
                      <tr key={svc.dserviceid} className="border-b border-dark-800">
                        <td className="py-2 pr-3 font-mono text-xs">{svc.ip}</td>
                        <td className="py-2 pr-3 text-xs">
                          {CHECK_TYPE_NAMES[svc.type] || `Type ${svc.type}`}
                        </td>
                        <td className="py-2 pr-3 text-xs">{svc.port}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${
                            svc.status === '0' ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {DSERVICE_STATUS[svc.status] || svc.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-xs text-dark-300">
                          {svc.lastup && svc.lastup !== '0'
                            ? new Date(parseInt(svc.lastup) * 1000).toLocaleString('pt-BR')
                            : '—'
                          }
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-dark-400 text-center py-6 text-sm">
              Nenhum host descoberto por esta regra ainda.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function CreateRuleForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [ipRange, setIpRange] = useState('');
  const [delay, setDelay] = useState('1h');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !ipRange) return;
    onSubmit({ name, ip_range: ipRange, delay });
  };

  return (
    <Card className="mb-4">
      <form onSubmit={handleSubmit}>
        <h3 className="text-sm font-semibold mb-3">Nova Regra de Discovery</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-dark-300 block mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Rede Core"
              className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
              required
            />
          </div>
          <div>
            <label className="text-xs text-dark-300 block mb-1">Range de IPs</label>
            <input
              type="text"
              value={ipRange}
              onChange={e => setIpRange(e.target.value)}
              placeholder="Ex: 10.0.0.1-254"
              className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
              required
            />
          </div>
          <div>
            <label className="text-xs text-dark-300 block mb-1">Intervalo</label>
            <select
              value={delay}
              onChange={e => setDelay(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
            >
              <option value="5m">5 minutos</option>
              <option value="15m">15 minutos</option>
              <option value="30m">30 minutos</option>
              <option value="1h">1 hora</option>
              <option value="6h">6 horas</option>
              <option value="24h">24 horas</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-dark-400 mt-2">
          Checks padrão: ICMP Ping + SNMPv2 (:161) + Zabbix Agent (:10050)
        </p>
        <div className="flex gap-2 mt-3">
          <button type="submit" className="bg-accent-green text-white px-4 py-1.5 rounded text-sm hover:opacity-90">
            Criar
          </button>
          <button type="button" onClick={onCancel} className="bg-dark-700 text-dark-200 px-4 py-1.5 rounded text-sm hover:bg-dark-600">
            Cancelar
          </button>
        </div>
      </form>
    </Card>
  );
}
