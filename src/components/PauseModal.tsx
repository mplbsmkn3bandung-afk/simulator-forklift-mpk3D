import React, { useEffect } from 'react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart, onTitle }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'KeyP') {
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-2xl select-none font-sans animate-in fade-in duration-200">
      <div className="bg-zinc-900/80 border border-white/10 w-full max-w-sm p-6 sm:p-7 shadow-2xl shadow-black/50 text-zinc-100 rounded-3xl backdrop-blur-2xl relative overflow-hidden">
        {/* Subtle amber ambient glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center space-x-2.5 pb-4 border-b border-white/10">
          <span className="w-3 h-3 bg-amber-400 rounded-full shadow-md shadow-amber-400/50" />
          <h2 className="text-lg font-black tracking-wider uppercase text-white font-mono">
            SIMULASI DIJEDA
          </h2>
        </div>

        <p className="text-xs text-zinc-300 my-4 leading-relaxed font-sans">
          Simulasi sedang dijeda. Anda dapat melanjutkan simulasi atau mengatur ulang posisi forklift.
        </p>

        <div className="space-y-2.5 pt-2">
          <button
            data-start="true"
            onClick={onResume}
            className="w-full cursor-pointer py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 active:to-amber-700 text-zinc-950 font-black uppercase text-xs tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-mono"
          >
            LANJUTKAN SIMULASI (ESC)
          </button>
          <button
            onClick={onRestart}
            className="w-full cursor-pointer py-3 bg-white/[0.08] hover:bg-white/[0.16] active:bg-white/20 text-white border border-white/10 hover:border-white/25 font-bold uppercase text-xs tracking-wider rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md font-mono"
          >
            RESET MISI (R)
          </button>
          <button
            onClick={onTitle}
            className="w-full cursor-pointer py-2.5 bg-transparent hover:bg-white/[0.08] text-zinc-400 hover:text-white uppercase text-xs tracking-wider rounded-2xl transition-all duration-200 font-mono"
          >
            KEMBALI KE MENU UTAMA
          </button>
        </div>
      </div>
    </div>
  );
};
