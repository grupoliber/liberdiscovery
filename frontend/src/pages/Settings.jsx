import { useState, useEffect } from 'react';
import { useLicense } from '../contexts/LicenseContext';
import Card from '../components/Card';
import { Settings as SettingsIcon, Key, CheckCircle, XCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';

const STATUS_CONFIG = {
  active: { label: 'Ativa', color: 'text-green-400', bg: 'bg-green-500/10', Icon: CheckCircle },
  inactive: { label: 'Inativa', color: 'text-yellow-400', bg: 'bg-yellow-500/10', Icon: AlertTriangle },
  blocked: { label: 'Bloqueada', color: 'text-red-400', bg: 'bg-red-500/10', Icon: XCircle },
  expired: { label: 'Expirada', color: 'text-red-400', bg: 'bg-red-500/10', Icon: XCircle },
  unknown: { label: 'Desconhecido', color: 'text-dark-400', bg: 'bg-dark-700', Icon: AlertTriangle },
};

export default function Settings() {
  const { license, loading: licLoading, refresh } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Não preenche o campo com a chave atual por segurança
  }, []);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.detail || 'Erro ao ativar licença' });
        return;
      }

      if (data.license?.is_active) {
        setMessage({ type: 'success', text: 'Licença ativada com sucesso!' });
        setLicenseKey('');
      } else {
        setMessage({
          type: 'warning',
          text: `Chave salva, mas licença com status: ${data.license?.status || 'desconhecido'}. Verifique a chave no Portal Libernet.`,
        });
      }

      refresh();
    } catch (err) {
      setMessage({ type: 'error', text: `Erro de conexão: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleRevalidate = async () => {
    setRevalidating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/license/revalidate', { method: 'POST' });
      const data = await res.json();
      if (data.is_active) {
        setMessage({ type: 'success', text: 'Licença revalidada com sucesso!' });
      } else {
        setMessage({ type: 'warning', text: `Status: ${data.status}` });
      }
      refresh();
    } catch (err) {
      setMessage({ type: 'error', text: `Erro: ${err.message}` });
    } finally {
      setRevalidating(false);
    }
  };

  const statusKey = license?.status || 'unknown';
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;
  const StatusIcon = statusCfg.Icon;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="text-accent-purple" size={24} />
        <h2 className="text-2xl font-bold">Configurações</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status da Licença */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-accent-blue" />
            <h3 className="font-semibold">Status da Licença</h3>
          </div>

          {licLoading ? (
            <p className="text-dark-400 text-sm">Carregando...</p>
          ) : license ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${statusCfg.bg}`}>
                <StatusIcon size={20} className={statusCfg.color} />
                <div>
                  <span className={`font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                  {license.message && (
                    <p className="text-xs text-dark-300 mt-0.5">{license.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-dark-800 rounded p-2.5">
                  <span className="text-dark-400 text-xs block">Produto</span>
                  <span className="text-dark-100">{license.product?.name || 'LiberDiscovery'}</span>
                </div>
                <div className="bg-dark-800 rounded p-2.5">
                  <span className="text-dark-400 text-xs block">Expira em</span>
                  <span className="text-dark-100">
                    {license.expires_at
                      ? new Date(license.expires_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
                <div className="bg-dark-800 rounded p-2.5">
                  <span className="text-dark-400 text-xs block">Leitura</span>
                  <span className={license.can_read ? 'text-green-400' : 'text-red-400'}>
                    {license.can_read ? 'Permitida' : 'Bloqueada'}
                  </span>
                </div>
                <div className="bg-dark-800 rounded p-2.5">
                  <span className="text-dark-400 text-xs block">Escrita</span>
                  <span className={license.can_write ? 'text-green-400' : 'text-red-400'}>
                    {license.can_write ? 'Permitida' : 'Bloqueada'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleRevalidate}
                disabled={revalidating}
                className="flex items-center gap-2 text-sm text-accent-blue hover:underline disabled:opacity-50 mt-2"
              >
                <RefreshCw size={14} className={revalidating ? 'animate-spin' : ''} />
                {revalidating ? 'Revalidando...' : 'Revalidar licença'}
              </button>
            </div>
          ) : (
            <p className="text-dark-400 text-sm">Nenhuma licença configurada.</p>
          )}
        </Card>

        {/* Ativar / Alterar Licença */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Key size={18} className="text-accent-green" />
            <h3 className="font-semibold">Ativar Licença</h3>
          </div>

          <form onSubmit={handleActivate}>
            <label className="text-xs text-dark-300 block mb-1">Chave de Licença</label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="LD-XXXX-XXXX-XXXX-XXXX"
              className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2.5 text-sm text-gray-100 font-mono tracking-wider mb-3"
              required
            />

            <button
              type="submit"
              disabled={saving || !licenseKey.trim()}
              className="w-full bg-accent-green text-white py-2.5 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Ativando...' : 'Ativar Licença'}
            </button>
          </form>

          {message && (
            <div className={`mt-3 p-3 rounded text-sm ${
              message.type === 'success' ? 'bg-green-500/10 text-green-400' :
              message.type === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <p className="text-xs text-dark-400 mt-3">
            Obtenha sua chave em{' '}
            <a href="https://ispacs.libernet.com.br" target="_blank" rel="noopener noreferrer"
               className="text-accent-blue hover:underline">
              ispacs.libernet.com.br
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}
