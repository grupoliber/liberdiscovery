import { useState, useCallback, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getMaps, getMap } from '../services/api';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { Network } from 'lucide-react';

export default function Topology() {
  const { data: maps, loading: loadingMaps } = useApi(getMaps);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const canvasRef = useRef(null);

  const fetchMap = useCallback(
    () => (selectedMapId ? getMap(selectedMapId) : Promise.resolve(null)),
    [selectedMapId]
  );
  const { data: mapData, loading: loadingMap } = useApi(fetchMap, [selectedMapId]);

  // Auto-selecionar o primeiro mapa
  useEffect(() => {
    if (maps?.length > 0 && !selectedMapId) {
      setSelectedMapId(maps[0].sysmapid);
    }
  }, [maps, selectedMapId]);

  // Renderizar mapa no canvas
  useEffect(() => {
    if (!mapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = parseInt(mapData.width) || 800;
    const height = parseInt(mapData.height) || 600;

    canvas.width = width;
    canvas.height = height;

    // Fundo
    ctx.fillStyle = '#0a0f24';
    ctx.fillRect(0, 0, width, height);

    // Links (conexões)
    if (mapData.links) {
      ctx.strokeStyle = '#3b4a74';
      ctx.lineWidth = 2;
      mapData.links.forEach((link) => {
        const from = mapData.selements?.find((s) => s.selementid === link.selementid1);
        const to = mapData.selements?.find((s) => s.selementid === link.selementid2);
        if (from && to) {
          ctx.beginPath();
          ctx.moveTo(parseInt(from.x) + 24, parseInt(from.y) + 24);
          ctx.lineTo(parseInt(to.x) + 24, parseInt(to.y) + 24);
          ctx.stroke();
        }
      });
    }

    // Elementos (nós)
    if (mapData.selements) {
      mapData.selements.forEach((el) => {
        const x = parseInt(el.x) || 0;
        const y = parseInt(el.y) || 0;

        // Nó
        ctx.beginPath();
        ctx.arc(x + 24, y + 24, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#16213e';
        ctx.fill();
        ctx.strokeStyle = '#0f9d58';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        const label = el.label || '';
        ctx.fillStyle = '#c1c5d6';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label.substring(0, 15), x + 24, y + 60);
      });
    }
  }, [mapData]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Network className="text-accent-green" size={24} />
        <h2 className="text-2xl font-bold">Topologia</h2>
      </div>

      {/* Seletor de mapa */}
      {maps && maps.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-dark-300">Mapa:</span>
            <select
              value={selectedMapId || ''}
              onChange={(e) => setSelectedMapId(e.target.value)}
              className="bg-dark-800 border border-dark-600 rounded px-3 py-1.5 text-sm text-gray-100"
            >
              {maps.map((m) => (
                <option key={m.sysmapid} value={m.sysmapid}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Canvas do mapa */}
      <Card>
        {loadingMaps || loadingMap ? (
          <Loading text="Carregando mapa..." />
        ) : mapData ? (
          <div className="overflow-auto rounded">
            <canvas ref={canvasRef} className="mx-auto" />
          </div>
        ) : (
          <div className="text-center py-16 text-dark-400">
            <Network size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum mapa de rede configurado no Zabbix.</p>
            <p className="text-xs mt-2">
              Crie um mapa em Monitoramento &gt; Mapas no Zabbix para visualizá-lo aqui.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
