import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, SkipForward, RotateCcw, Film, Shield } from 'lucide-react';

export default function TimelinePlayer({ scenes, plan }) {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const [activeSlot, setActiveSlot] = useState('A'); // 'A' | 'B'
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentScene = scenes[activeIdx] || null;
  const nextScene = scenes[activeIdx + 1] || null;

  useEffect(() => {
    setActiveIdx(0);
    setActiveSlot('A');
    setIsPlaying(false);
  }, [scenes.length]);

  // Load current scene into active slot and preload next scene into standby slot
  useEffect(() => {
    const activeEl = activeSlot === 'A' ? videoARef.current : videoBRef.current;
    const standbyEl = activeSlot === 'A' ? videoBRef.current : videoARef.current;

    if (activeEl && currentScene) {
      const targetUrl = new URL(currentScene.videoUrl, window.location.origin).href;
      if (activeEl.src !== targetUrl) {
        activeEl.src = currentScene.videoUrl;
        activeEl.load();
      }
      if (isPlaying && activeEl.paused) {
        activeEl.play().catch(() => {});
      }
    }

    if (standbyEl) {
      if (nextScene) {
        const nextUrl = new URL(nextScene.videoUrl, window.location.origin).href;
        if (standbyEl.src !== nextUrl) {
          standbyEl.src = nextScene.videoUrl;
          standbyEl.preload = 'auto';
          standbyEl.load();
        }
      } else {
        standbyEl.removeAttribute('src');
        standbyEl.load();
      }
    }
  }, [activeIdx, activeSlot, currentScene?.videoUrl, nextScene?.videoUrl]);

  const handleEnded = (slot) => {
    if (slot !== activeSlot) return;
    if (activeIdx < scenes.length - 1) {
      const nextSlot = activeSlot === 'A' ? 'B' : 'A';
      const nextEl = nextSlot === 'A' ? videoARef.current : videoBRef.current;
      setActiveSlot(nextSlot);
      setActiveIdx((i) => i + 1);
      setIsPlaying(true);
      if (nextEl) {
        nextEl.currentTime = 0;
        nextEl.play().catch(() => {});
      }
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const activeEl = activeSlot === 'A' ? videoARef.current : videoBRef.current;
    if (!activeEl) return;
    if (activeEl.paused) {
      activeEl.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      activeEl.pause();
      setIsPlaying(false);
    }
  };

  const jumpToScene = (idx) => {
    setActiveIdx(idx);
    setIsPlaying(true);
  };

  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);

  if (!scenes.length) return null;

  return (
    <section className="bg-[#0f0f13] border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#d4ff00]/15 border border-[#d4ff00]/40 flex items-center justify-center text-[#d4ff00]">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">
              Reproductor Continuo Multi-Escena ({totalDuration}s totales)
            </h2>
            <p className="text-xs text-zinc-400">
              Doble búfer precargado para transición fluida entre las {scenes.length} escena(s) generadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="px-3.5 py-2 rounded-lg bg-[#d4ff00] hover:bg-[#c2eb00] text-black font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pausar' : 'Reproducir Todo'}</span>
          </button>

          {scenes.length > 1 && (
            <button
              type="button"
              onClick={() => jumpToScene((activeIdx + 1) % scenes.length)}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Siguiente</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => jumpToScene(0)}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
            title="Reiniciar desde Escena 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Double-buffered Video Viewport */}
      <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800 aspect-video flex items-center justify-center">
        <video
          ref={videoARef}
          controls={activeSlot === 'A'}
          playsInline
          onEnded={() => handleEnded('A')}
          onPlay={() => activeSlot === 'A' && setIsPlaying(true)}
          onPause={() => activeSlot === 'A' && setIsPlaying(false)}
          className={`absolute inset-0 w-full h-full object-contain ${
            activeSlot === 'A' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
          }`}
        />
        <video
          ref={videoBRef}
          controls={activeSlot === 'B'}
          playsInline
          onEnded={() => handleEnded('B')}
          onPlay={() => activeSlot === 'B' && setIsPlaying(true)}
          onPause={() => activeSlot === 'B' && setIsPlaying(false)}
          className={`absolute inset-0 w-full h-full object-contain ${
            activeSlot === 'B' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
          }`}
        />
        {currentScene && (
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded bg-black/75 backdrop-blur border border-zinc-700/80 font-mono text-[11px] text-[#d4ff00] pointer-events-none">
            ESCENA {currentScene.index}/{scenes.length} · {currentScene.startSec}s–{currentScene.endSec}s ({currentScene.duration}s)
          </div>
        )}
      </div>

      {/* Scene Switcher & Downloads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {scenes.map((sc, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div
              key={sc.index}
              className={`rounded-lg border p-3 flex flex-col justify-between gap-2 transition-colors ${
                isActive
                  ? 'bg-zinc-800/80 border-[#d4ff00]/60'
                  : 'bg-[#08080a] border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <button
                type="button"
                onClick={() => jumpToScene(idx)}
                className="text-left flex flex-col gap-1 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-white">
                    Escena {sc.index} ({sc.duration}s)
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-[#00f5ff] border border-zinc-700">
                    {sc.mode === 'r2v_base'
                      ? 'Base'
                      : sc.mode === 'chapter_bridge'
                      ? 'Puente'
                      : 'Extensión'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-2">
                  {sc.transitionNote}
                </p>
              </button>

              <a
                href={sc.videoUrl}
                download={`escena_${sc.index}_${sc.duration}s.mp4`}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-zinc-900 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono border border-zinc-700 transition-colors"
              >
                <Download className="w-3 h-3" />
                <span>Descargar MP4</span>
              </a>
            </div>
          );
        })}
      </div>

      {/* Consistency Anchors Used */}
      {plan && (
        <div className="rounded-lg bg-[#08080a] border border-zinc-800/90 p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#d4ff00] mb-1">
              <Shield className="w-3.5 h-3.5" />
              ANCLA DE PERSONAJE (CONSISTENCIA)
            </div>
            <p className="text-zinc-300 leading-relaxed">{plan.character_anchor}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#00f5ff] mb-1">
              <Shield className="w-3.5 h-3.5" />
              ANCLA DE ESCENARIO / FONDO (CONSISTENCIA)
            </div>
            <p className="text-zinc-300 leading-relaxed">{plan.environment_anchor}</p>
          </div>
        </div>
      )}
    </section>
  );
}
