import { useLicense } from '../contexts/LicenseContext';
import { AlertTriangle, ShieldOff, ShieldAlert } from 'lucide-react';

export default function LicenseBanner() {
  const { license, loading } = useLicense();

  if (loading || !license) return null;

  // Ativa e válida — sem banner
  if (license.is_active && license.valid) return null;

  // Bloqueada — tela inteira de bloqueio
  if (license.is_blocked) {
    return (
      <div className="fixed inset-0 bg-dark-900/95 z-50 flex items-center justify-center">
        <div className="bg-dark-800 border border-red-500/50 rounded-xl p-8 max-w-md text-center">
          <ShieldOff size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Acesso Bloqueado</h2>
          <p className="text-dark-200 text-sm mb-4">
            A licença deste sistema está bloqueada. Entre em contato com o suporte Libernet
            para regularizar.
          </p>
          <a
            href="https://ispacs.libernet.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-500 text-white px-6 py-2 rounded text-sm hover:bg-red-600 transition-colors"
          >
            Acessar Portal Libernet
          </a>
        </div>
      </div>
    );
  }

  // Inativa ou sem permissão de escrita — banner de aviso
  const isWriteBlocked = !license.can_write;
  const isInactive = !license.is_active;

  let message = '';
  let Icon = AlertTriangle;
  let bgColor = 'bg-yellow-500/10 border-yellow-500/30';
  let textColor = 'text-yellow-400';

  if (isInactive) {
    message = 'Licença inativa. Algumas funcionalidades podem estar limitadas.';
    Icon = ShieldAlert;
  } else if (isWriteBlocked) {
    message = 'Licença com permissão somente leitura. Operações de escrita estão bloqueadas.';
    bgColor = 'bg-orange-500/10 border-orange-500/30';
    textColor = 'text-orange-400';
  }

  if (!message) return null;

  return (
    <div className={`border rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3 ${bgColor}`}>
      <Icon size={18} className={textColor} />
      <span className={`text-sm ${textColor}`}>{message}</span>
      <a
        href="https://ispacs.libernet.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className={`ml-auto text-xs ${textColor} underline hover:opacity-80`}
      >
        Portal Libernet
      </a>
    </div>
  );
}
