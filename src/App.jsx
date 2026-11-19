import { useEffect, useState } from 'react';
import {
  User,
  Mountain,
  Clapperboard,
  Wand2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import ApiKeyBar from './components/ApiKeyBar.jsx';
import IngredientDropzone from './components/IngredientDropzone.jsx';
import DurationSelector from './components/DurationSelector.jsx';
import TimelinePlayer from './components/TimelinePlayer.jsx';

const PROMPT_CHIPS = [
  'Caminando con naturalidad hacia la cámara, iluminación cinematográfica',
  'Plano medio con movimiento suave de cámara orbital, música ambiental sutil',
  'Hablando a cámara con expresión confiada y gestos naturales',
  'Atardecer dorado con brisa ligera, estilo documental 35mm',
];

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('flow_studio_api_key') || '');

  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState('');

  const [personFile, setPersonFile] = useState(null);
  const [personPreview, setPersonPreview] = useState('');

  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(15);
  const [singleClipMax, setSingleClipMax] = useState(15);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');

  const [schedule, setSchedule] = useState([]);
  const [jobState, setJobState] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    localStorage.setItem('flow_studio_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    let active = true;
    fetch('/api/plan-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration, singleClipMax }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data.schedule)) {
          setSchedule(data.schedule);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [duration, singleClipMax]);

  const handleSelectBg = (file) => {
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBgFile(file);
    setBgPreview(URL.createObjectURL(file));
  };

  const handleClearBg = () => {
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBgFile(null);
    setBgPreview('');
  };

  const handleSelectPerson = (file) => {
    if (personPreview) URL.revokeObjectURL(personPreview);
    setPersonFile(file);
    setPersonPreview(URL.createObjectURL(file));
  };

  const handleClearPerson = () => {
    if (personPreview) URL.revokeObjectURL(personPreview);
    setPersonFile(null);
    setPersonPreview('');
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!apiKey.trim()) {
      setErrorMsg('Ingresa tu Google API Key en la barra superior antes de generar.');
      return;
    }
    if (!bgFile || !personFile) {
      setErrorMsg('Debes subir tanto la foto del fondo como la foto de la persona.');
      return;
    }
    if (!prompt.trim()) {
      setErrorMsg('Escribe un prompt describiendo la acción del video.');
      return;
    }

    setIsGenerating(true);
    setJobState({
      stage: 'uploading',
      message: 'Iniciando trabajo y subiendo ingredientes...',
      progressPct: 3,
      completedScenes: [],
      plan: null,
    });

    try {
      const formData = new FormData();
      formData.append('background', bgFile);
      formData.append('person', personFile);
      formData.append('prompt', prompt.trim());
      formData.append('duration', String(duration));
      formData.append('singleClipMax', String(singleClipMax));
      formData.append('aspectRatio', aspectRatio);
      formData.append('resolution', resolution);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'x-gemini-api-key': apiKey.trim(),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error iniciando la generación.');
      }

      const evtSource = new EventSource(`/api/jobs/${data.jobId}/events`);
      evtSource.onmessage = (msg) => {
        const parsed = JSON.parse(msg.data);
        setJobState(parsed);

        if (parsed.stage === 'completed') {
          setIsGenerating(false);
          evtSource.close();
        } else if (parsed.stage === 'error') {
          setErrorMsg(parsed.error || parsed.message || 'Error durante la generación.');
          setIsGenerating(false);
          evtSource.close();
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        setIsGenerating(false);
      };
    } catch (err) {
      setErrorMsg(err.message || 'Error inesperado.');
      setIsGenerating(false);
    }
  };

  const completedScenes = jobState?.completedScenes || [];

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-100 flex flex-col">
      <ApiKeyBar apiKey={apiKey} setApiKey={setApiKey} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <form onSubmit={handleGenerate} className="flex flex-col gap-6">
          {/* Step 1: Ingredients */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IngredientDropzone
              label="1. Foto del Fondo (Escenario)"
              badge="INGREDIENTE A"
              description="Define el entorno, arquitectura, iluminación y atmósfera."
              file={bgFile}
              previewUrl={bgPreview}
              onSelectFile={handleSelectBg}
              onClear={handleClearBg}
              icon={Mountain}
            />
            <IngredientDropzone
              label="2. Foto de la Persona (Sujeto)"
              badge="INGREDIENTE B"
              description="Define la identidad facial, cabello y vestimenta del personaje."
              file={personFile}
              previewUrl={personPreview}
              onSelectFile={handleSelectPerson}
              onClear={handleClearPerson}
              icon={User}
            />
          </section>

          {/* Step 2: Prompt & Format */}
          <section className="bg-[#0f0f13] border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-[#d4ff00]">
                  <Clapperboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-semibold text-zinc-100">
                    3. Prompt del Video & Formato
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Describe qué hace la persona dentro del fondo y cómo se mueve la cámara.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  aria-label="Relación de aspecto"
                  className="bg-[#08080a] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:border-[#d4ff00] focus:outline-none"
                >
                  <option value="16:9">16:9 Horizontal</option>
                  <option value="9:16">9:16 Vertical (Reels/TikTok)</option>
                </select>

                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  aria-label="Resolución"
                  className="bg-[#08080a] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:border-[#d4ff00] focus:outline-none"
                >
                  <option value="720p">720p HD (Rápido)</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="4k">4K Ultra HD</option>
                </select>
              </div>
            </div>

            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: La persona camina tranquilamente por el lugar observando alrededor, luego se gira hacia la cámara y sonríe mientras la cámara hace un travelling suave..."
              className="w-full bg-[#08080a] border border-zinc-700/90 focus:border-[#d4ff00] focus:outline-none rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-500 resize-y"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-500">Sugerencias:</span>
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setPrompt((p) => (p ? `${p.trim()}. ${chip}` : chip))}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </section>

          {/* Step 3: Duration Selector + Auto Multi-Scene Compensation */}
          <DurationSelector
            duration={duration}
            onChangeDuration={setDuration}
            singleClipMax={singleClipMax}
            onChangeSingleClipMax={setSingleClipMax}
            schedule={schedule}
          />

          {/* Error Banner */}
          {errorMsg && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/40 p-4 flex items-start gap-3 text-sm text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No se pudo completar la generación</p>
                <p className="text-xs text-red-300/90 mt-0.5 font-mono">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="text-xs text-zinc-400 font-mono">
              Motor: <span className="text-zinc-200">gemini-omni-1.2-flash</span> · Director:{' '}
              <span className="text-zinc-200">gemini-4-hydrogen</span>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="px-6 py-3.5 rounded-xl bg-[#d4ff00] hover:bg-[#c3eb00] disabled:opacity-60 text-black font-display font-bold text-sm tracking-tight flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(212,255,0,0.2)] transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Produciendo {schedule.length} escena(s)...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>
                    Generar Video de {duration}s ({schedule.length}{' '}
                    {schedule.length === 1 ? 'escena' : 'escenas'})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Progress Panel */}
        {jobState && jobState.stage !== 'error' && (
          <section className="bg-[#0f0f13] border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                {jobState.stage === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#d4ff00]" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-[#00f5ff]" />
                )}
                <span className="text-zinc-100">{jobState.message}</span>
              </div>
              <span className="font-mono text-xs text-[#d4ff00]">
                {jobState.progressPct || 0}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-[#00f5ff] to-[#d4ff00] transition-all duration-500"
                style={{ width: `${jobState.progressPct || 0}%` }}
              />
            </div>
          </section>
        )}

        {/* Output Video Timeline Player */}
        <TimelinePlayer scenes={completedScenes} plan={jobState?.plan} />
      </main>
    </div>
  );
}
