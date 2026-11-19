import { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function ApiKeyBar({ apiKey, setApiKey }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | checking | valid | invalid
  const [statusMsg, setStatusMsg] = useState('');

  const handleVerify = async () => {
    if (!apiKey.trim()) {
      setStatus('invalid');
      setStatusMsg('Ingresa tu Google API Key primero.');
      return;
    }
    setStatus('checking');
    setStatusMsg('');
    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey.trim(),
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setStatus('valid');
        setStatusMsg('API Key verificada');
      } else {
        setStatus('invalid');
        setStatusMsg(data.error || 'No se pudo validar la API Key');
      }
    } catch {
      setStatus('invalid');
      setStatusMsg('Error de red al conectar con el servidor local.');
    }
  };

  return (
    <header className="border-b border-zinc-800/90 bg-[#0f0f13]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#d4ff00] text-black flex items-center justify-center font-display font-bold text-lg tracking-tighter">
            FS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-base sm:text-lg tracking-tight text-white">
                FLOW STUDIO
              </h1>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-[#00f5ff] border border-zinc-700/80">
                OMNI 1.2 FLASH
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Video con ingredientes (Fondo + Persona) y extensión multi-escena consistente
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex items-center flex-1 sm:w-80">
            <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              type={visible ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (status !== 'idle') setStatus('idle');
              }}
              placeholder="Ingresa tu Google Gemini API Key (AIza...)"
              aria-label="Google Gemini API Key"
              className="w-full bg-[#08080a] border border-zinc-700/90 focus:border-[#d4ff00] focus:outline-none rounded-lg pl-9 pr-10 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar API Key' : 'Mostrar API Key'}
              className="absolute right-2.5 text-zinc-400 hover:text-zinc-200 p-1 cursor-pointer"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={status === 'checking'}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {status === 'checking' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4ff00]" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-[#d4ff00]" />
            )}
            <span>Verificar Key</span>
          </button>

          {status === 'valid' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#d4ff00] px-2.5 py-1 rounded bg-[#d4ff00]/10 border border-[#d4ff00]/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {statusMsg}
            </span>
          )}
          {status === 'invalid' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-red-400 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 max-w-xs truncate" title={statusMsg}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{statusMsg}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
