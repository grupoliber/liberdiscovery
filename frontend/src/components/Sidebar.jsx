import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Network,
  BarChart3,
  Activity,
  Radar,
  Settings,
} from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sensors', label: 'Sensores', icon: Activity },
  { to: '/devices', label: 'Dispositivos', icon: Server },
  { to: '/alerts', label: 'Alertas', icon: AlertTriangle },
  { to: '/discovery', label: 'Discovery', icon: Radar },
  { to: '/topology', label: 'Topologia', icon: Network },
  { to: '/metrics', label: 'Métricas', icon: BarChart3 },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-dark-900 border-r border-dark-700 flex flex-col">
      <div className="p-5 border-b border-dark-700">
        <h1 className="text-xl font-bold text-accent-green tracking-tight">
          LiberDiscovery
        </h1>
        <p className="text-xs text-dark-300 mt-1">Network Monitoring System</p>
      </div>

      <nav className="flex-1 py-4">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-dark-800 text-accent-green border-r-2 border-accent-green'
                  : 'text-dark-200 hover:bg-dark-800 hover:text-gray-100'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-700 text-xs text-dark-400">
        Powered by Libernet
      </div>
    </aside>
  );
}
