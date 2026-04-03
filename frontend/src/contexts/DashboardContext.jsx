import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const DashboardContext = createContext();

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
};

const TIME_RANGES = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '3h': 3 * 60 * 60,
  '6h': 6 * 60 * 60,
  '12h': 12 * 60 * 60,
  '24h': 24 * 60 * 60,
  '2d': 2 * 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
};

const REFRESH_INTERVALS = {
  'off': null,
  '5s': 5000,
  '10s': 10000,
  '30s': 30000,
  '1m': 60000,
  '5m': 5 * 60000,
};

export const DashboardProvider = ({ children }) => {
  const [timeRangeKey, setTimeRangeKey] = useState('24h');
  const [refreshIntervalKey, setRefreshIntervalKey] = useState('off');
  const [selectedHost, setSelectedHost] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const timeRange = TIME_RANGES[timeRangeKey];
  const refreshInterval = REFRESH_INTERVALS[refreshIntervalKey];

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLastRefresh(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  useEffect(() => {
    if (!refreshInterval) return;

    const timer = setInterval(() => {
      triggerRefresh();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [refreshInterval, triggerRefresh]);

  const value = {
    timeRangeKey,
    setTimeRangeKey,
    timeRange,
    timeRanges: TIME_RANGES,
    refreshIntervalKey,
    setRefreshIntervalKey,
    refreshIntervals: REFRESH_INTERVALS,
    selectedHost,
    setSelectedHost,
    lastRefresh,
    triggerRefresh,
    isRefreshing,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export default DashboardContext;
