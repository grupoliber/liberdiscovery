/**
 * LiberDiscovery - useApi Hook
 * Hook genérico para chamadas à API com loading/error states.
 */

import { useState, useEffect, useCallback } from 'react';

export function useApi(fetchFn, deps = [], autoFetch = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Erro desconhecido');
      return null;
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (autoFetch) execute();
  }, [execute, autoFetch]);

  return { data, loading, error, refetch: execute };
}

export function usePolling(fetchFn, intervalMs = 30000, deps = []) {
  const { data, loading, error, refetch } = useApi(fetchFn, deps, true);

  useEffect(() => {
    const timer = setInterval(refetch, intervalMs);
    return () => clearInterval(timer);
  }, [refetch, intervalMs]);

  return { data, loading, error, refetch };
}
