import { Clock, Layers, Sparkles, Lock } from 'lucide-react';

const DURATION_OPTIONS = [
  { seconds: 5, label: '5s', tag: 'Rápido' },
  { seconds: 8, label: '8s', tag: 'Flow Base' },
  { seconds: 10, label: '10s', tag: 'Estándar' },
  { seconds: 15, label: '15s', tag: 'Máx. 1 Toma' },
  { seconds: 20, label: '20s', tag: 'Multi-Escena' },
  { seconds: 25, label: '25s', tag: 'Multi-Escena' },
  { seconds: 30, label: '30s', tag: 'Cadena 30s' },
  { seconds: 45, label: '45s', tag: '2 Capítulos' },
  { seconds: 60, label: '60s', tag: 'Largo 1 Min' },
];

export default function DurationSelector({
  duration,
  onChangeDuration,
  singleClipMax,
  onChangeSingleClipMax,
  schedule,
}) {
  const isMultiScene = schedule.length > 1;

  return (
    <div className="bg-[#0f0f13] border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-[#00f5ff]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-zinc-100">
              Duración del Video Producido
            </h3>
            <p className="text-[11px] text-zinc-400">
              Si supera el límite por toma, se añaden escenas automáticamente manteniendo consistencia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#08080a] p-1 rounded-lg border border-zinc-800 self-start">
          <button
            type="button"
            onClick={() => onChangeSingleClipMax(15)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              singleClipMax === 15
                ? 'bg-zinc-800 text-[#d4ff00] border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Omni Máx 15s/toma
          </button>
          <button
            type="button"
            onClick={() => onChangeSingleClipMax(8)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              singleClipMax === 8
                ? 'bg-zinc-800 text-[#00f5ff] border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Google Flow 8s/toma
          </button>
        </div>
      </div>

      {/* Duration Buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {DURATION_OPTIONS.map((opt) => {
          const active = duration === opt.seconds;
          const exceeds = opt.seconds > singleClipMax;
          return (
            <button
              key={opt.seconds}
              type="button"
              onClick={() => onChangeDuration(opt.seconds)}
              className={`relative rounded-lg px-2.5 py-2.5 border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                active
                  ? 'bg-[#d4ff00] text-black border-[#d4ff00] shadow-[0_0_20px_rgba(212,255,0,0.18)]'
                  : 'bg-[#08080a] text-zinc-200 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <span className="font-display font-bold text-base leading-none">
                {opt.label}
              </span>
              <span
                className={`font-mono text-[10px] leading-tight ${
                  active ? 'text-black/75 font-semibold' : exceeds ? 'text-[#00f5ff]' : 'text-zinc-500'
                }`}
              >
                {exceeds ? '+Escenas' : opt.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live Multi-Scene Compensation Preview */}
      <div
        className={`rounded-lg border p-3 flex flex-col gap-2.5 ${
          isMultiScene
            ? 'bg-[#00f5ff]/5 border-[#00f5ff]/25'
            : 'bg-[#08080a]/80 border-zinc-800/90'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            {isMultiScene ? (
              <>
                <Layers className="w-4 h-4 text-[#00f5ff]" />
                <span className="text-zinc-100">
                  Compensación Multi-Escena Activa:{' '}
                  <strong className="text-[#00f5ff] font-mono">
                    {schedule.length} escenas
                  </strong>{' '}
                  para alcanzar <strong className="font-mono">{duration}s</strong>
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#d4ff00]" />
                <span className="text-zinc-200">
                  Toma única de <strong className="font-mono">{duration}s</strong> (dentro del límite de {singleClipMax}s)
                </span>
              </>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400">
            <Lock className="w-3 h-3 text-[#d4ff00]" />
            Ingredientes re-inyectados en cada escena
          </span>
        </div>

        {/* Visual Timeline Bar */}
        <div className="flex items-center gap-1.5 w-full overflow-x-auto pb-0.5">
          {schedule.map((sc) => {
            const widthPct = Math.max(12, Math.round((sc.duration / duration) * 100));
            const modeLabel =
              sc.mode === 'r2v_base'
                ? 'Base R2V'
                : sc.mode === 'chapter_bridge'
                ? 'Puente Cap.'
                : 'Extensión';
            return (
              <div
                key={sc.index}
                style={{ width: `${widthPct}%`, minWidth: '88px' }}
                className={`rounded-md px-2.5 py-1.5 border flex flex-col gap-0.5 ${
                  sc.mode === 'r2v_base'
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                    : sc.mode === 'chapter_bridge'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-[#00f5ff]/10 border-[#00f5ff]/30 text-[#00f5ff]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span>E{sc.index}</span>
                  <span>{sc.duration}s</span>
                </div>
                <span className="text-[10px] opacity-85 truncate">{modeLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
