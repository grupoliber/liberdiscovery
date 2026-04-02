import { useParams } from 'react-router-dom';
import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { getDevice, getItems } from '../services/api';
import Card from '../components/Card';
import { AvailabilityBadge, SeverityBadge } from '../components/StatusBadge';
import Loading from '../components/Loading';
import { ArrowLeft, Cpu, HardDrive, Network, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DeviceDetail() {
  const { hostId } = useParams();

  const fetchDevice = useCallback(() => getDevice(hostId), [hostId]);
  const fetchItems = useCallback(() => getItems(hostId), [hostId]);

  const { data: device, loading } = useApi(fetchDevice, [hostId]);
  const { data: items } = useApi(fetchItems, [hostId]);

  if (loading && !device) return <Loading text="Carregando dispositivo..." />;
  if (!device) return <p className="text-dark-400">Dispositivo não encontrado.</p>;

  const keyItems = items?.filter((item) => {
    const key = item.key_ || '';
    return (
      key.includes('cpu') ||
      key.includes('memory') ||
      key.includes('icmp') ||
      key.includes('system.uptime') ||
      key.includes('net.if')
    );
  }) || [];

  return (
    <div>
      <Link to="/devices" className="flex items-center gap-2 text-accent-blue text-sm mb-4 hover:underline">
        <ArrowLeft size={14} /> Voltar para dispositivos
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">{device.name}</h2>
        <AvailabilityBadge available={device.available} />
      </div>

      {/* Info geral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Informações">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-dark-300">Hostname</dt>
              <dd className="font-mono">{device.host}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-300">IP</dt>
              <dd className="font-mono">{device.interfaces?.[0]?.ip || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-300">Grupos</dt>
              <dd>{device.groups?.map((g) => g.name).join(', ') || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-300">Templates</dt>
              <dd className="text-xs">{device.parentTemplates?.map((t) => t.name).join(', ') || '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Triggers Ativos">
          {device.triggers?.filter((t) => t.value === '1').length > 0 ? (
            <div className="space-y-2">
              {device.triggers
                .filter((t) => t.value === '1')
                .map((trigger) => (
                  <div key={trigger.triggerid} className="flex items-center gap-2">
                    <SeverityBadge severity={parseInt(trigger.priority)} />
                    <span className="text-xs">{trigger.description}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-dark-400 text-sm">Nenhum trigger ativo</p>
          )}
        </Card>

        <Card title="Interfaces">
          {device.interfaces?.length > 0 ? (
            <div className="space-y-2">
              {device.interfaces.map((iface) => (
                <div key={iface.interfaceid} className="flex justify-between text-sm">
                  <span className="font-mono text-dark-200">{iface.ip}:{iface.port}</span>
                  <span className="text-dark-400 text-xs">
                    {iface.type === '1' ? 'Agent' : iface.type === '2' ? 'SNMP' : iface.type === '3' ? 'IPMI' : 'JMX'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dark-400 text-sm">Sem interfaces</p>
          )}
        </Card>
      </div>

      {/* Métricas chave */}
      <Card title="Métricas Principais">
        {keyItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {keyItems.slice(0, 12).map((item) => (
              <div key={item.itemid} className="bg-dark-800 rounded p-3">
                <p className="text-xs text-dark-300 truncate">{item.name}</p>
                <p className="text-lg font-bold mt-1">
                  {item.lastvalue} <span className="text-xs text-dark-400">{item.units}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-400 text-sm">Nenhuma métrica coletada ainda.</p>
        )}
      </Card>
    </div>
  );
}
