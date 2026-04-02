import clsx from 'clsx';

export default function Card({ title, children, className }) {
  return (
    <div className={clsx('bg-dark-900 border border-dark-700 rounded-lg p-5', className)}>
      {title && <h3 className="text-sm font-semibold text-dark-200 mb-3">{title}</h3>}
      {children}
    </div>
  );
}
