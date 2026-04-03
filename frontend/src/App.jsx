import { Routes, Route } from 'react-router-dom';
import { LicenseProvider } from './contexts/LicenseContext';
import Sidebar from './components/Sidebar';
import LicenseBanner from './components/LicenseBanner';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail';
import Alerts from './pages/Alerts';
import Topology from './pages/Topology';
import Metrics from './pages/Metrics';
import Sensors from './pages/Sensors';
import Discovery from './pages/Discovery';
import Settings from './pages/Settings';

export default function App() {
  return (
    <LicenseProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <LicenseBanner />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/:hostId" element={<DeviceDetail />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/topology" element={<Topology />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </LicenseProvider>
  );
}
