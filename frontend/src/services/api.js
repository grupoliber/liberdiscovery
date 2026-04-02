/**
 * LiberDiscovery - API Service
 * Comunicação com o backend FastAPI.
 */

const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `Erro ${res.status}`);
  }
  return res.json();
}

// === Dashboard ===
export const getDashboardStats = () => request('/dashboard/stats');

// === Dispositivos ===
export const getDevices = (groupId, limit = 100) => {
  const params = new URLSearchParams();
  if (groupId) params.set('group_id', groupId);
  if (limit) params.set('limit', limit);
  return request(`/devices?${params}`);
};

export const getDeviceGroups = () => request('/devices/groups');

export const getDevice = (hostId) => request(`/devices/${hostId}`);

// === Alertas ===
export const getAlerts = (severityMin = 0, acknowledged = null, limit = 100) => {
  const params = new URLSearchParams();
  params.set('severity_min', severityMin);
  params.set('limit', limit);
  if (acknowledged !== null) params.set('acknowledged', acknowledged);
  return request(`/alerts?${params}`);
};

export const getTriggers = (hostId = null, minSeverity = 0, onlyActive = true) => {
  const params = new URLSearchParams();
  if (hostId) params.set('host_id', hostId);
  params.set('min_severity', minSeverity);
  params.set('only_active', onlyActive);
  return request(`/alerts/triggers?${params}`);
};

export const acknowledgeAlerts = (eventIds, message = '') =>
  request('/alerts/ack', {
    method: 'POST',
    body: JSON.stringify({ event_ids: eventIds, message }),
  });

export const closeAlerts = (eventIds, message = '') =>
  request('/alerts/close', {
    method: 'POST',
    body: JSON.stringify({ event_ids: eventIds, message }),
  });

// === Métricas ===
export const getItems = (hostId, search = null) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  return request(`/metrics/${hostId}/items?${params}`);
};

export const getHistory = (itemIds, valueType = 0, timeFrom = null, timeTill = null, limit = 500) => {
  const params = new URLSearchParams();
  params.set('item_ids', itemIds.join(','));
  params.set('value_type', valueType);
  params.set('limit', limit);
  if (timeFrom) params.set('time_from', timeFrom);
  if (timeTill) params.set('time_till', timeTill);
  return request(`/metrics/history?${params}`);
};

// === Topologia ===
export const getMaps = () => request('/topology/maps');

export const getMap = (mapId) => request(`/topology/maps/${mapId}`);

// === Health ===
export const healthCheck = () => request('/health');
