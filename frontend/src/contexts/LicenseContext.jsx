import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLicense = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/license/status');
      if (res.ok) {
        const data = await res.json();
        setLicense(data);
      }
    } catch (err) {
      console.warn('Falha ao obter status da licença:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLicense();
    // Revalida a cada 1h no frontend
    const interval = setInterval(fetchLicense, 3600000);
    return () => clearInterval(interval);
  }, [fetchLicense]);

  return (
    <LicenseContext.Provider value={{ license, loading, refresh: fetchLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}
