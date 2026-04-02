import clsx from 'clsx';

const severityMap = {
  0: { label: 'Não classif.', color: 'bg-gray-600' },
  1: { label: 'Informação', color: 'bg-blue-600' },
  2: { label: 'Warning', color: 'bg-yellow-600' },
  3: { label: 'Médio', color: 'bg-orange-500' },
  4: { label: 'Alto', color: 'bg-red-500' },
  5: { label: 'Desastre', color: 'bg-red-700' },
};

const availabilityMap = {
  '0': { label: 'Desconhecido', color: 'bg-gray-500' },
  '1': { label: 'Online', color: 'bg-green-500' },
  '2': { label: 'Offline', color: 'bg-red-500' },
};

export function SeverityBadge({ severity }) {
  const sev = severityMap[severity] || severityMap[0];
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium text-white', sev.color)}>
      {sev.label}
    </span>
  );
}

export function AvailabilityBadge({ available }) {
  const avail = availabilityMap[available] || availabilityMap['0'];
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium text-white', avail.color)}>
      {avail.label}
    </span>
  );
}
