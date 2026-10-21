import React, { useEffect } from 'react';
import type { SimulatorStats } from '../simulator/types.ts';

interface FailureModalProps {
  reason?: string;
  stats?: SimulatorStats;
  onRestart: () => void;
  onTitle: () => void;
}

export const FailureModal: React.FC<FailureModalProps> = ({
  reason = 'Kargo Rusak!',
  stats,
  onRestart,
  onTitle,
}) => {
  // Keyboard shortcut: Enter / Space / R triggers onRestart, Escape triggers onTitle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();
        onRestart();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onTitle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart, onTitle]);

  return (
    <div
      data-testid="failure-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-2xl animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-lg bg-zinc-900/80 border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-500/20 backdrop-blur-2xl overflow-hidden">
        {/* Background Hazard Red Glow */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Warning Icon & Title Banner */}
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 shadow-xl shadow-red-500/20 backdrop-blur-md">
            {/* Warning Octagon / Exclamation Icon */}
            <svg
              className="w-8 h-8 text-red-400 animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div>
            <div className="inline-block px-3 py-1 mb-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-300 border border-red-500/40 font-mono shadow-sm">
              PERINGATAN OPERASIONAL · LEVEL 4
            </div>

            {/* Judul: MISI GAGAL - Kargo Rusak Akibat Benturan! */}
            <h1
              data-testid="failure-modal-title"
              className="text-xl sm:text-2xl lg:text-3xl font-black tracking-wide uppercase text-white leading-tight font-sans"
            >
              <span className="text-red-400">MISI GAGAL</span>
              <span className="text-zinc-500 mx-2">-</span>
              <span className="text-red-300">{reason}</span>
            </h1>

            <p className="text-xs sm:text-sm font-semibold text-zinc-300 mt-1 font-mono">
              Protokol Keselamatan Kargo Rapuh Dilanggar
            </p>
          </div>
        </div>

        {/* Narrative Description */}
        <div className="my-5 p-4 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-zinc-200 leading-relaxed font-sans backdrop-blur-md">
          Palet Level 4 memuat barang pecah belah rapuh (<em>fragile</em>). Terjadi benturan fisik antara
          badan forklift atau palet kargo dengan rintangan jalan zig-zag (tong/kerucut) atau
          struktur gudang. Seluruh muatan kargo dinyatakan rusak total!
        </div>

        {/* Incident Summary Card */}
        <div className="grid grid-cols-3 gap-2.5 my-5">
          <div className="bg-white/[0.05] border border-white/10 p-3 rounded-2xl text-center backdrop-blur-md shadow-lg">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">STATUS KARGO</div>
            <div className="text-base sm:text-lg font-black text-red-400 uppercase mt-1">
              RUSAK
            </div>
            <div className="text-[10px] text-zinc-400 mt-1 font-mono">Toleransi 0%</div>
          </div>
          <div className="bg-white/[0.05] border border-white/10 p-3 rounded-2xl text-center backdrop-blur-md shadow-lg">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">TOTAL WAKTU</div>
            <div
              data-testid="failure-total-time"
              className="text-base sm:text-lg font-black text-white tabular-nums mt-1 font-mono"
            >
              {stats?.timeElapsed ?? 0}s
            </div>
            <div className="text-[10px] text-amber-300/80 mt-1 font-mono">Waktu Operasi</div>
          </div>
          <div className="bg-white/[0.05] border border-white/10 p-3 rounded-2xl text-center backdrop-blur-md shadow-lg">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">PENYEBAB</div>
            <div className="text-base sm:text-lg font-black text-amber-300 uppercase mt-1">
              BENTURAN
            </div>
            <div className="text-[10px] text-amber-300/80 mt-1 font-mono">Rintangan Fisik</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 mt-2 border-t border-white/10">
          {/* Tombol 'Ulangi Level 4' */}
          <button
            data-testid="btn-ulangi-level-4"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 active:from-red-700 active:to-red-600 text-white font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center space-x-2 group font-mono hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg
              className="w-4 h-4 text-white transition-transform group-hover:-rotate-90 duration-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Ulangi Level 4</span>
          </button>

          {/* Tombol 'Menu Utama' */}
          <button
            data-testid="btn-menu-utama"
            onClick={onTitle}
            className="w-full cursor-pointer py-3 px-4 bg-white/[0.08] hover:bg-white/[0.16] active:bg-white/20 text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Menu Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
};
