import { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

export default function IngredientDropzone({
  label,
  badge,
  description,
  file,
  previewUrl,
  onSelectFile,
  onClear,
  icon: Icon = ImageIcon,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files) => {
    const picked = files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) return;
    onSelectFile(picked);
  };

  return (
    <div className="bg-[#0f0f13] border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-[#d4ff00]">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-zinc-100">{label}</h3>
            <p className="text-[11px] text-zinc-400">{description}</p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
          {badge}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {previewUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-zinc-700/80 bg-[#08080a] aspect-video flex items-center justify-center">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-zinc-200 truncate">
              {file?.name} ({Math.round((file?.size || 0) / 1024)} KB)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-2 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 text-[11px] text-zinc-100 border border-zinc-600 cursor-pointer"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={onClear}
                aria-label={`Quitar ${label}`}
                className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`aspect-video rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 p-4 cursor-pointer ${
            isDragging
              ? 'border-[#d4ff00] bg-[#d4ff00]/5'
              : 'border-zinc-700/80 hover:border-zinc-500 bg-[#08080a]/70'
          }`}
        >
          <Upload className="w-6 h-6 text-zinc-400" />
          <div className="text-center">
            <p className="text-xs font-medium text-zinc-200">
              Arrastra una imagen o haz clic para subir
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
              PNG, JPG o WebP (máx. 25 MB)
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
