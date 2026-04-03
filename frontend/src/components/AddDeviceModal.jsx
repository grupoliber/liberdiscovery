import { useState, useEffect } from 'react';
import { X, Server, Wifi, Network, Plus } from 'lucide-react';

const INTERFACE_TYPES = {
  1: { label: 'Zabbix Agent', defaultPort: '10050' },
  2: { label: 'SNMP', defaultPort: '161' },
  3: { label: 'IPMI', defaultPort: '623' },
  4: { label: 'JMX', defaultPort: '12345' },
};

export default function AddDeviceModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Form data
  const [form, setForm] = useState({
    name: '',
    host: '',
    ip: '',
    description: '',
    group_ids: [],
    template_ids: [],
    interface_type: 1,
    agent_port: '10050',
    snmp_version: 2,
    snmp_community: 'public',
    snmp_port: '161',
    snmpv3_securityname: '',
    snmpv3_securitylevel: 0,
    snmpv3_authprotocol: 0,
    snmpv3_authpassphrase: '',
    snmpv3_privprotocol: 0,
    snmpv3_privpassphrase: '',
  });

  // Auto-fill host from name
  const updateName = (name) => {
    setForm(f => ({
      ...f,
      name,
      host: f.host === '' || f.host === f.name.toLowerCase().replace(/\s+/g, '-')
        ? name.toLowerCase().replace(/\s+/g, '-')
        : f.host,
    }));
  };

  // Load groups and templates
  useEffect(() => {
    fetch('/api/v1/devices/groups').then(r => r.json()).then(setGroups).catch(() => {});
    fetch('/api/v1/devices/templates').then(r => r.json()).then(setTemplates).catch(() => {});
  }, []);

  const filteredTemplates = templates.filter(t =>
    !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch('/api/v1/devices/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.groupids?.[0];
        // Refresh groups
        const gRes = await fetch('/api/v1/devices/groups');
        setGroups(await gRes.json());
        if (newId) setForm(f => ({ ...f, group_ids: [...f.group_ids, newId] }));
        setNewGroupName('');
        setShowNewGroup(false);
      }
    } catch {}
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name || !form.ip || form.group_ids.length === 0) {
      setError('Preencha nome, IP e selecione pelo menos um grupo.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Erro ao criar dispositivo');
        return;
      }
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(`Erro de conexão: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-y-auto py-8" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Server size={20} className="text-accent-green" />
            <h3 className="font-semibold text-lg">Novo Dispositivo</h3>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-200"><X size={20} /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-dark-700">
          {['Informações', 'Interface', 'Templates'].map((label, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                step === i + 1
                  ? 'bg-accent-green text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-dark-600 text-[10px] flex items-center justify-center font-bold">
                {i + 1}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Informações básicas */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-dark-300 block mb-1">Nome do Dispositivo *</label>
                  <input
                    type="text" value={form.name} onChange={e => updateName(e.target.value)}
                    placeholder="Ex: Switch Core 01"
                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-dark-300 block mb-1">Hostname (técnico)</label>
                  <input
                    type="text" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                    placeholder="switch-core-01"
                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-dark-300 block mb-1">Endereço IP *</label>
                <input
                  type="text" value={form.ip} onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
                  placeholder="192.168.1.1"
                  className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-dark-300 block mb-1">Descrição</label>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição opcional do dispositivo..."
                  rows={2}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-dark-300">Grupos *</label>
                  <button onClick={() => setShowNewGroup(!showNewGroup)} className="text-[10px] text-accent-green hover:underline">
                    + Novo Grupo
                  </button>
                </div>
                {showNewGroup && (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && createGroup()}
                      placeholder="Nome do grupo"
                      className="flex-1 bg-dark-900 border border-dark-600 rounded px-2 py-1 text-xs text-gray-100"
                      autoFocus
                    />
                    <button onClick={createGroup} className="bg-accent-green text-white px-3 py-1 rounded text-xs">Criar</button>
                  </div>
                )}
                <div className="max-h-32 overflow-y-auto bg-dark-900 border border-dark-600 rounded p-2 space-y-1">
                  {groups.map(g => (
                    <label key={g.groupid} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-dark-800 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={form.group_ids.includes(g.groupid)}
                        onChange={e => {
                          setForm(f => ({
                            ...f,
                            group_ids: e.target.checked
                              ? [...f.group_ids, g.groupid]
                              : f.group_ids.filter(id => id !== g.groupid),
                          }));
                        }}
                      />
                      <span className="text-dark-200">{g.name}</span>
                      <span className="text-dark-500 ml-auto text-[10px]">{g.hosts} hosts</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Interface de monitoramento */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-dark-300 block mb-2">Tipo de Interface Principal</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 1, label: 'Zabbix Agent', desc: 'Agente instalado no host', icon: Wifi },
                    { type: 2, label: 'SNMP', desc: 'Monitoramento via SNMP', icon: Network },
                  ].map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => setForm(f => ({ ...f, interface_type: opt.type }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        form.interface_type === opt.type
                          ? 'border-accent-green bg-accent-green/10'
                          : 'border-dark-600 bg-dark-900 hover:border-dark-500'
                      }`}
                    >
                      <opt.icon size={18} className={form.interface_type === opt.type ? 'text-accent-green' : 'text-dark-400'} />
                      <p className="text-sm font-medium mt-1">{opt.label}</p>
                      <p className="text-[10px] text-dark-400">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {form.interface_type === 1 && (
                <div>
                  <label className="text-xs text-dark-300 block mb-1">Porta do Agent</label>
                  <input
                    type="text" value={form.agent_port} onChange={e => setForm(f => ({ ...f, agent_port: e.target.value }))}
                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100 font-mono"
                  />
                </div>
              )}

              {form.interface_type === 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-dark-300 block mb-1">Versão SNMP</label>
                      <select
                        value={form.snmp_version} onChange={e => setForm(f => ({ ...f, snmp_version: parseInt(e.target.value) }))}
                        className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
                      >
                        <option value={1}>SNMPv1</option>
                        <option value={2}>SNMPv2c</option>
                        <option value={3}>SNMPv3</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-dark-300 block mb-1">Porta SNMP</label>
                      <input
                        type="text" value={form.snmp_port} onChange={e => setForm(f => ({ ...f, snmp_port: e.target.value }))}
                        className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100 font-mono"
                      />
                    </div>
                  </div>

                  {form.snmp_version <= 2 && (
                    <div>
                      <label className="text-xs text-dark-300 block mb-1">Community String</label>
                      <input
                        type="text" value={form.snmp_community} onChange={e => setForm(f => ({ ...f, snmp_community: e.target.value }))}
                        placeholder="public"
                        className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100 font-mono"
                      />
                    </div>
                  )}

                  {form.snmp_version === 3 && (
                    <div className="space-y-3 bg-dark-900 rounded-lg p-3 border border-dark-600">
                      <p className="text-xs font-semibold text-dark-200">Configuração SNMPv3</p>
                      <div>
                        <label className="text-xs text-dark-300 block mb-1">Security Name</label>
                        <input
                          type="text" value={form.snmpv3_securityname}
                          onChange={e => setForm(f => ({ ...f, snmpv3_securityname: e.target.value }))}
                          className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-dark-300 block mb-1">Security Level</label>
                        <select
                          value={form.snmpv3_securitylevel}
                          onChange={e => setForm(f => ({ ...f, snmpv3_securitylevel: parseInt(e.target.value) }))}
                          className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100"
                        >
                          <option value={0}>noAuthNoPriv</option>
                          <option value={1}>authNoPriv</option>
                          <option value={2}>authPriv</option>
                        </select>
                      </div>
                      {form.snmpv3_securitylevel >= 1 && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-dark-300 block mb-1">Auth Protocol</label>
                            <select value={form.snmpv3_authprotocol} onChange={e => setForm(f => ({ ...f, snmpv3_authprotocol: parseInt(e.target.value) }))}
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                              <option value={0}>MD5</option>
                              <option value={1}>SHA1</option>
                              <option value={2}>SHA224</option>
                              <option value={3}>SHA256</option>
                              <option value={4}>SHA384</option>
                              <option value={5}>SHA512</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-dark-300 block mb-1">Auth Passphrase</label>
                            <input type="password" value={form.snmpv3_authpassphrase}
                              onChange={e => setForm(f => ({ ...f, snmpv3_authpassphrase: e.target.value }))}
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100" />
                          </div>
                        </div>
                      )}
                      {form.snmpv3_securitylevel >= 2 && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-dark-300 block mb-1">Priv Protocol</label>
                            <select value={form.snmpv3_privprotocol} onChange={e => setForm(f => ({ ...f, snmpv3_privprotocol: parseInt(e.target.value) }))}
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100">
                              <option value={0}>DES</option>
                              <option value={1}>AES128</option>
                              <option value={2}>AES192</option>
                              <option value={3}>AES256</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-dark-300 block mb-1">Priv Passphrase</label>
                            <input type="password" value={form.snmpv3_privpassphrase}
                              onChange={e => setForm(f => ({ ...f, snmpv3_privpassphrase: e.target.value }))}
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-gray-100" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Templates */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-dark-400">
                Selecione os templates para aplicar monitoramento automático ao dispositivo.
              </p>
              <input
                type="text"
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Buscar templates..."
                className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-100"
              />
              {form.template_ids.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.template_ids.map(tid => {
                    const t = templates.find(t => t.templateid === tid);
                    return (
                      <span key={tid} className="bg-accent-green/20 text-accent-green text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                        {t?.name || tid}
                        <button onClick={() => setForm(f => ({ ...f, template_ids: f.template_ids.filter(id => id !== tid) }))}>
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="max-h-56 overflow-y-auto bg-dark-900 border border-dark-600 rounded p-2 space-y-1">
                {filteredTemplates.slice(0, 50).map(t => (
                  <label key={t.templateid} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-dark-800 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={form.template_ids.includes(t.templateid)}
                      onChange={e => {
                        setForm(f => ({
                          ...f,
                          template_ids: e.target.checked
                            ? [...f.template_ids, t.templateid]
                            : f.template_ids.filter(id => id !== t.templateid),
                        }));
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-dark-200 truncate block">{t.name}</span>
                      {t.description && <span className="text-dark-500 text-[10px] truncate block">{t.description}</span>}
                    </div>
                    <span className="text-dark-500 text-[10px] shrink-0">{t.items} items</span>
                  </label>
                ))}
                {filteredTemplates.length === 0 && (
                  <p className="text-dark-400 text-xs text-center py-4">Nenhum template encontrado</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-between">
          {error && <p className="text-red-400 text-xs flex-1 mr-3">{error}</p>}
          <div className="flex items-center gap-2 ml-auto">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="bg-dark-700 text-dark-200 px-4 py-2 rounded text-sm hover:bg-dark-600">
                Voltar
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} className="bg-accent-blue text-white px-4 py-2 rounded text-sm hover:opacity-90">
                Próximo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-accent-green text-white px-6 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Criando...' : 'Criar Dispositivo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
