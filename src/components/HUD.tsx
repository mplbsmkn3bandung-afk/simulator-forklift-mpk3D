import React from 'react';
import type { SimulatorStats, CameraMode } from '../simulator/types.ts';

interface HUDProps {
  stats: SimulatorStats;
  cameraMode: CameraMode;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onPause: () => void;
  onReset: () => void;
  onResetPallet?: () => void;
  onDropForklift: () => void;
  onTriggerHorn: () => void;
  onSetForkHeight: (height: number) => void;
  onButtonInput: (key: string, pressed: boolean) => void;
  onTitle?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  cameraMode,
  isMuted,
  onToggleMute,
  onToggleCamera,
  onPause,
  onReset,
  onResetPallet,
  onDropForklift,
  onTriggerHorn,
  onSetForkHeight,
  onButtonInput,
  onTitle,
}) => {
  const cameraLabel =
    cameraMode === 'chase' ? 'KAMERA' : cameraMode === 'overhead' ? 'ISOMETRIK' : 'KOKPIT';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* Top Bar: Specs, Objective, & Utility Buttons */}
      <div className="animate-hud-slide-down flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Unit status badge & Physics badge */}
        <div className="bg-zinc-950/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl shadow-black/40 flex flex-col justify-center">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50 animate-pulse" />
            <span className="text-xs font-black text-white uppercase tracking-wider">
              FORKLIFT 3D
            </span>
            <span
              data-testid="hud-level-badge"
              className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-lg font-black tracking-wider shadow-sm"
            >
              LEVEL {stats.level ?? 1}
            </span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg font-semibold shadow-sm">
              RAPIER 3D
            </span>
          </div>
          <div className="text-[11px] text-zinc-300 mt-1 flex items-center space-x-3 font-mono">
            <span>
              WAKTU: <b className="text-white font-bold tabular-nums">{stats.timeElapsed}s</b>
            </span>
            <span>
              SKOR: <b className="text-amber-300 font-bold tabular-nums">{stats.score}</b>
            </span>
            <span className="hidden sm:inline text-zinc-400">GRAVITASI: -9.82 m/s²</span>
          </div>
        </div>

        {/* Center: Mission Objective Banner */}
        <div className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-3 bg-zinc-950/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-2xl shadow-black/40">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
              {stats.level === 5
                ? 'MISI LEVEL 5:'
                : stats.level === 4
                ? 'MISI LEVEL 4:'
                : stats.level === 3
                ? 'MISI LEVEL 3:'
                : stats.level === 2
                ? 'MISI LEVEL 2:'
                : 'MISI LEVEL 1:'}
            </span>
          </div>
          <span className="text-xs font-semibold text-amber-200">
            {stats.deliveredCount > 0
              ? stats.level === 5
                ? 'BERHASIL MEMUAT KE LOADING DOCK ✓'
                : stats.level === 4
                ? 'BERHASIL MELEWATI RINTANGAN ZIG-ZAG ✓'
                : stats.level === 3
                ? 'BERHASIL MELEWATI LORONG SEMPIT ✓'
                : stats.level === 2
                ? 'BERHASIL DILETAKKAN DI ATAS RAK ✓'
                : 'BERHASIL DIKIRIM KE DROP ZONE ✓'
              : stats.level === 5
              ? stats.cargoLocked
                ? 'Kemudikan menaiki tanjakan ramp & letakkan palet di Drop Zone platform [E]'
                : 'Ambil palet sasaran di lantai [Q] & kemudikan menaiki tanjakan menuju platform loading dock'
              : stats.level === 4
              ? stats.cargoLocked
                ? 'Bawa muatan kargo melewati rintangan zig-zag & letakkan di Drop Zone hijau [E]'
                : 'Ambil palet kargo di depan [Q] & kemudikan melewati rintangan zig-zag'
              : stats.level === 3
              ? stats.cargoLocked
                ? 'Bawa palet melewati lorong L berkelok & letakkan di Drop Zone hijau [E]'
                : 'Ambil palet sasaran di depan [Q] & kemudikan masuk ke lorong L'
              : stats.level === 2
              ? stats.cargoLocked
                ? 'Bawa ke Rak (-8, -15), Naikkan Garpu [1.45m], lalu Turunkan Garpu [E] untuk melepas muatan ke rak'
                : 'Ambil palet dari lantai [Q] dan posisikan di Drop Zone atas Rak'
              : stats.cargoLocked
              ? 'Bawa ke Area Pengiriman Lantai & Turunkan Garpu [E]'
              : 'Dorong garpu ke bawah palet & tekan Naik Garpu [Q]'}
          </span>
          <span className="hidden sm:inline text-xs text-white/20">|</span>
          {stats.cargoLocked ? (
            <span
              data-testid="hud-muatan-terkunci-banner"
              className="text-xs px-3 py-1 rounded-xl font-black bg-gradient-to-r from-emerald-500 to-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 animate-pulse"
            >
              <svg className="w-3.5 h-3.5 text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.5" />
              </svg>
              <span>MUATAN TERKUNCI</span>
            </span>
          ) : (
            <span
              className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all duration-200 ${
                stats.cargoLoaded
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-sm'
                  : 'bg-white/10 text-zinc-300 border border-white/10'
              }`}
            >
              {stats.cargoLoaded ? 'TERANGKAT PADA GARPU' : 'DI ATAS LANTAI'}
            </span>
          )}
        </div>

        {/* Right: Modern Glassmorphic Utility Buttons Cluster */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 pointer-events-auto">
          {/* Reset Pallet Button (Physics Pallet Reposition) */}
          {onResetPallet && (
            <button
              onClick={onResetPallet}
              className="cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500 active:text-zinc-950 text-amber-300 border border-amber-500/40 hover:border-amber-400/70 px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-200 hover:scale-105 active:scale-95"
              title="Kembalikan Palet Sasaran ke Depan Forklift"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span className="text-[11px] uppercase font-bold tracking-wide">Reset Palet</span>
            </button>
          )}

          {/* Drop Forklift button (Physics Gravity Drop) */}
          <button
            onClick={onDropForklift}
            className="cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 active:to-amber-700 text-zinc-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 backdrop-blur-xl transition-all duration-200 hover:scale-105 active:scale-95"
            title="Turunkan Forklift dari Udara dengan Gravitasi"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 3v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] uppercase tracking-wider font-bold">Turunkan Forklift</span>
          </button>

          {/* Camera View Switch */}
          <button
            onClick={onToggleCamera}
            className="cursor-pointer bg-zinc-900/60 hover:bg-white/15 text-white border border-white/10 hover:border-white/30 px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 active:scale-95 backdrop-blur-xl transition-all duration-200 shadow-lg shadow-black/20"
            title="Ganti Sudut Kamera [C]"
            tabIndex={-1}
          >
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="hidden sm:inline text-[11px] font-bold tracking-wide">{cameraLabel}</span>
          </button>

          {/* Horn Button */}
          <button
            onClick={onTriggerHorn}
            className="cursor-pointer bg-zinc-900/60 hover:bg-white/15 text-white border border-white/10 hover:border-white/30 px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 active:bg-amber-500 active:text-zinc-950 backdrop-blur-xl transition-all duration-200 shadow-lg shadow-black/20 hover:scale-105 active:scale-95"
            title="Bunyikan Klakson [H]"
            tabIndex={-1}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" />
            </svg>
            <span className="hidden md:inline text-[11px] font-bold tracking-wide">KLAKSON</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className="cursor-pointer bg-zinc-900/60 hover:bg-white/15 text-white border border-white/10 hover:border-white/30 p-2 rounded-xl text-xs active:scale-95 backdrop-blur-xl transition-all duration-200 shadow-lg shadow-black/20"
            title={isMuted ? 'Bunyikan Suara [M]' : 'Bisukan Suara [M]'}
            tabIndex={-1}
          >
            {isMuted ? (
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0a7 7 0 0 1-.11 1.23" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Reset Position */}
          <button
            onClick={onReset}
            className="cursor-pointer bg-zinc-900/60 hover:bg-white/15 text-white border border-white/10 hover:border-white/30 p-2 rounded-xl text-xs active:scale-95 backdrop-blur-xl transition-all duration-200 shadow-lg shadow-black/20"
            title="Reset [R]"
            tabIndex={-1}
          >
            <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>

          {/* Pause */}
          <button
            onClick={onPause}
            className="cursor-pointer bg-zinc-900/60 hover:bg-white/15 text-white border border-white/10 hover:border-white/30 p-2 rounded-xl text-xs active:scale-95 backdrop-blur-xl transition-all duration-200 shadow-lg shadow-black/20"
            title="Jeda [Esc]"
            tabIndex={-1}
          >
            <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>

          {/* Tombol Kembali ke Menu Utama */}
          {onTitle && (
            <button
              data-testid="hud-btn-menu-utama"
              onClick={onTitle}
              className="cursor-pointer bg-zinc-900/60 hover:bg-white/15 hover:text-amber-300 text-white border border-white/10 hover:border-white/30 px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 active:scale-95 backdrop-blur-xl transition-all duration-200 shadow-lg shadow-black/20 font-bold"
              title="Kembali ke Menu Utama"
              tabIndex={-1}
            >
              <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="text-[11px] uppercase tracking-wider hidden sm:inline">
                Kembali ke Menu Utama
              </span>
              <span className="text-[11px] uppercase tracking-wider sm:hidden">
                Menu
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Middle Right: Visual Mast & Fork Elevation Height Indicator */}
      <div className="animate-hud-slide-left self-end my-auto pointer-events-auto bg-zinc-950/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl shadow-black/40 flex flex-col items-center">
        <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider mb-1">
          ELEVASI GARPU
        </div>
        <div className="text-2xl font-black text-white tabular-nums tracking-tight font-mono">
          {stats.forkHeightM.toFixed(2)} <span className="text-xs text-zinc-400 font-normal">m</span>
        </div>

        {/* Visual Mast with 2 Fork Blades representation */}
        <div className="relative w-16 h-36 bg-black/40 rounded-xl border border-white/15 my-2 flex justify-between px-1.5 overflow-hidden">
          {/* Left Mast Rail */}
          <div className="w-1.5 h-full bg-white/20 rounded-full" />
          {/* Middle hydraulic cylinder */}
          <div className="w-1 h-full bg-white/10" />
          {/* Right Mast Rail */}
          <div className="w-1.5 h-full bg-white/20 rounded-full" />

          {/* Animated Fork Carriage & 2 Blades */}
          <div
            className="absolute left-0 right-0 h-4 bg-zinc-800/90 border-t border-b border-amber-400 transition-all duration-75 flex items-center justify-around px-1 shadow-md"
            style={{
              bottom: `${Math.min(88, Math.max(4, ((stats.forkHeightM - 0.08) / 2.72) * 88))}%`,
            }}
          >
            {/* Bilah Kiri */}
            <div className="w-2.5 h-1.5 bg-white rounded-xs shadow" title="Bilah Garpu Kiri" />
            {/* Backplate */}
            <div className="w-4 h-2 bg-amber-500 rounded-xs" />
            {/* Bilah Kanan */}
            <div className="w-2.5 h-1.5 bg-white rounded-xs shadow" title="Bilah Garpu Kanan" />
          </div>
        </div>

        {/* Indikator Status Kuncian Muatan */}
        {stats.cargoLocked ? (
          <div
            data-testid="hud-muatan-terkunci-mast"
            className="mt-1 w-full bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1.5 rounded-xl flex items-center justify-center space-x-1.5 shadow-sm animate-pulse"
          >
            <svg className="w-3 h-3 text-emerald-300 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.5" />
            </svg>
            <span className="text-[10px] font-black text-emerald-200 uppercase tracking-tight">
              Muatan Terkunci
            </span>
          </div>
        ) : (
          <div className="mt-1 w-full bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl flex items-center justify-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-tight">
              Bebas di Lantai
            </span>
          </div>
        )}

        {/* Quick Height Preset Buttons */}
        <div className="grid grid-cols-3 gap-1.5 w-full mt-2">
          <button
            onClick={() => onSetForkHeight(0.08)}
            className="cursor-pointer py-1.5 bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 hover:text-white text-[9px] font-bold rounded-lg text-center border border-white/10 transition-all duration-150 active:scale-95"
            title="Turunkan ke lantai (Lepas Muatan)"
          >
            0.1m
          </button>
          <button
            onClick={() => onSetForkHeight(1.45)}
            className="cursor-pointer py-1.5 bg-amber-500/20 hover:bg-amber-500/35 active:bg-amber-500 active:text-zinc-950 text-amber-300 text-[9px] font-bold rounded-lg text-center border border-amber-500/40 transition-all duration-150 hover:scale-105 active:scale-95"
            title="Angkat ke paras Rak Tingkat 2 (1.45m)"
          >
            1.45m (Rak)
          </button>
          <button
            onClick={() => onSetForkHeight(2.6)}
            className="cursor-pointer py-1.5 bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 hover:text-white text-[9px] font-bold rounded-lg text-center border border-white/10 transition-all duration-150 active:scale-95"
            title="Angkat ke puncak mast"
          >
            2.6m
          </button>
        </div>
      </div>

      {/* Center Floating Notification Toast for Cargo Lock */}
      {stats.cargoLocked && (
        <div
          data-testid="hud-muatan-terkunci-toast"
          className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 pointer-events-none z-30 transition-all duration-300"
        >
          <div className="bg-emerald-950/80 border border-emerald-400/60 text-emerald-200 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-2xl flex items-center space-x-2.5 animate-pulse shadow-emerald-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            <svg className="w-4 h-4 text-emerald-300" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.5" />
            </svg>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              MUATAN TERKUNCI
            </span>
            <span className="text-[11px] text-emerald-300 font-semibold hidden md:inline">
              · 100% Menempel Kuat pada Garpu
            </span>
          </div>
        </div>
      )}

      {/* Bottom Modern Dashboard Dock with On-Screen Touch Controls */}
      <div className="flex flex-col md:flex-row items-end md:items-end justify-between gap-3 pointer-events-auto">
        {/* Speedometer & Gear */}
        <div className="animate-hud-slide-right bg-zinc-950/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl shadow-black/40 flex items-center space-x-4">
          <div className="text-center">
            <div className="text-3xl font-black text-white tabular-nums tracking-tighter font-mono">
              {stats.speedKmh}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">KM/JAM</div>
          </div>

          <div className="h-8 w-px bg-white/15" />

          {/* Quick Fork Status Info */}
          <div>
            <div className="text-[10px] text-zinc-400 font-medium mb-0.5">STATUS FORK & MUATAN</div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-amber-300">
                {stats.forkHeightM < 0.25 ? 'DI LANTAI' : stats.forkHeightM > 2.2 ? 'PUNCAK TIANG' : 'TERANGKAT'}
              </span>
              {stats.cargoLocked ? (
                <span className="text-[10px] font-black bg-emerald-500 text-zinc-950 px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                  <svg className="w-2.5 h-2.5 text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span>Muatan Terkunci</span>
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400">Bebas di Lantai</span>
              )}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Tombol: <b className="text-white font-semibold">Q</b> (Naik & Kunci) · <b className="text-white font-semibold">E</b> (Turun & Lepas)
            </div>
          </div>
        </div>

        {/* ON-SCREEN TOUCH / MOUSE CONTROLS: Maju, Mundur, Kiri, Kanan + Naik/Turun Garpu */}
        <div className="animate-hud-slide-up bg-zinc-950/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl shadow-black/40 flex flex-wrap items-center gap-4">
          {/* Directional Pad: Maju, Mundur, Kiri, Kanan */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-[10px] uppercase font-black text-zinc-300 tracking-wider">
              MENGEMUDI (W, A, S, D)
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div />
              {/* Maju (W) Button */}
              <button
                data-testid="btn-forward"
                onMouseDown={() => onButtonInput('forward', true)}
                onMouseUp={() => onButtonInput('forward', false)}
                onMouseLeave={() => onButtonInput('forward', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('forward', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('forward', false); }}
                onTouchCancel={() => onButtonInput('forward', false)}
                className="w-14 sm:w-16 h-12 bg-white/[0.08] hover:bg-white/[0.18] active:bg-amber-500 active:text-zinc-950 text-white rounded-xl border border-white/15 hover:border-white/30 font-bold flex flex-col items-center justify-center cursor-pointer select-none shadow-lg backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95"
                title="Maju (W / Panah Atas)"
              >
                <span className="text-xs">▲</span>
                <span className="text-[10px] font-black uppercase">Maju</span>
              </button>
              <div />

              {/* Kiri (A) Button */}
              <button
                data-testid="btn-left"
                onMouseDown={() => onButtonInput('steerLeft', true)}
                onMouseUp={() => onButtonInput('steerLeft', false)}
                onMouseLeave={() => onButtonInput('steerLeft', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('steerLeft', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('steerLeft', false); }}
                onTouchCancel={() => onButtonInput('steerLeft', false)}
                className="w-14 sm:w-16 h-12 bg-white/[0.08] hover:bg-white/[0.18] active:bg-amber-500 active:text-zinc-950 text-white rounded-xl border border-white/15 hover:border-white/30 font-bold flex flex-col items-center justify-center cursor-pointer select-none shadow-lg backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95"
                title="Kiri (A / Panah Kiri)"
              >
                <span className="text-xs">◀</span>
                <span className="text-[10px] font-black uppercase">Kiri</span>
              </button>

              {/* Mundur (S) Button */}
              <button
                data-testid="btn-backward"
                onMouseDown={() => onButtonInput('backward', true)}
                onMouseUp={() => onButtonInput('backward', false)}
                onMouseLeave={() => onButtonInput('backward', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('backward', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('backward', false); }}
                onTouchCancel={() => onButtonInput('backward', false)}
                className="w-14 sm:w-16 h-12 bg-white/[0.08] hover:bg-white/[0.18] active:bg-amber-500 active:text-zinc-950 text-white rounded-xl border border-white/15 hover:border-white/30 font-bold flex flex-col items-center justify-center cursor-pointer select-none shadow-lg backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95"
                title="Mundur (S / Panah Bawah)"
              >
                <span className="text-xs">▼</span>
                <span className="text-[10px] font-black uppercase">Mundur</span>
              </button>

              {/* Kanan (D) Button */}
              <button
                data-testid="btn-right"
                onMouseDown={() => onButtonInput('steerRight', true)}
                onMouseUp={() => onButtonInput('steerRight', false)}
                onMouseLeave={() => onButtonInput('steerRight', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('steerRight', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('steerRight', false); }}
                onTouchCancel={() => onButtonInput('steerRight', false)}
                className="w-14 sm:w-16 h-12 bg-white/[0.08] hover:bg-white/[0.18] active:bg-amber-500 active:text-zinc-950 text-white rounded-xl border border-white/15 hover:border-white/30 font-bold flex flex-col items-center justify-center cursor-pointer select-none shadow-lg backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95"
                title="Kanan (D / Panah Kanan)"
              >
                <span className="text-xs">▶</span>
                <span className="text-[10px] font-black uppercase">Kanan</span>
              </button>
            </div>
          </div>

          <div className="h-24 w-px bg-white/15 mx-1 hidden sm:block" />

          {/* DEDICATED FORK MOVEMENT TOUCH BUTTONS: NAIKKAN & TURUNKAN GARPU */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-[10px] uppercase font-black text-amber-300 tracking-wider">
              MEKANIK GARPU (Q, E)
            </div>

            <div className="flex flex-col space-y-2 w-36">
              {/* NAIKKAN GARPU (Q) Button */}
              <button
                data-testid="btn-fork-up"
                onMouseDown={() => onButtonInput('forkUp', true)}
                onMouseUp={() => onButtonInput('forkUp', false)}
                onMouseLeave={() => onButtonInput('forkUp', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('forkUp', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('forkUp', false); }}
                onTouchCancel={() => onButtonInput('forkUp', false)}
                className="w-full py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/35 active:bg-amber-500 active:text-zinc-950 text-amber-200 border border-amber-500/50 hover:border-amber-400 rounded-xl text-xs font-black flex flex-col items-center justify-center cursor-pointer select-none shadow-lg shadow-amber-500/10 backdrop-blur-md transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                title="Tekan & Tahan untuk Menaikkan Garpu di sepanjang tiang & kunci muatan (Tombol: Q)"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm">▲</span>
                  <span>NAIK GARPU [Q]</span>
                </div>
                <span className="text-[9px] text-amber-300/80 font-medium tracking-tight">
                  (Kunci Muatan)
                </span>
              </button>

              {/* TURUNKAN GARPU (E) Button */}
              <button
                data-testid="btn-fork-down"
                onMouseDown={() => onButtonInput('forkDown', true)}
                onMouseUp={() => onButtonInput('forkDown', false)}
                onMouseLeave={() => onButtonInput('forkDown', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('forkDown', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('forkDown', false); }}
                onTouchCancel={() => onButtonInput('forkDown', false)}
                className="w-full py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/35 active:bg-amber-500 active:text-zinc-950 text-amber-200 border border-amber-500/50 hover:border-amber-400 rounded-xl text-xs font-black flex flex-col items-center justify-center cursor-pointer select-none shadow-lg shadow-amber-500/10 backdrop-blur-md transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                title="Tekan & Tahan untuk Menurunkan Garpu ke lantai & lepaskan kuncian (Tombol: E)"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm">▼</span>
                  <span>TURUN GARPU [E]</span>
                </div>
                <span className="text-[9px] text-amber-300/80 font-medium tracking-tight">
                  (Lepas di Lantai)
                </span>
              </button>

              {/* Handbrake Button */}
              <button
                onMouseDown={() => onButtonInput('brake', true)}
                onMouseUp={() => onButtonInput('brake', false)}
                onMouseLeave={() => onButtonInput('brake', false)}
                onTouchStart={(e) => { e.preventDefault(); onButtonInput('brake', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onButtonInput('brake', false); }}
                onTouchCancel={() => onButtonInput('brake', false)}
                className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/35 active:bg-red-600 text-red-200 border border-red-500/40 rounded-xl text-[10px] font-bold text-center cursor-pointer select-none shadow-md backdrop-blur-md transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                title="Rem Tangan (Space)"
              >
                REM (SPACE)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
