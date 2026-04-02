export default function Loading({ text = 'Carregando...' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-dark-600 border-t-accent-green mr-3" />
      <span className="text-dark-300 text-sm">{text}</span>
    </div>
  );
}
