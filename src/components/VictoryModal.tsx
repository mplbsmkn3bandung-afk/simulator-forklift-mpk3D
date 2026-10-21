import React, { useEffect } from 'react';
import type { SimulatorStats } from '../simulator/types.ts';

interface VictoryModalProps {
  stats: SimulatorStats;
  onRestart: () => void;
  onNextLevel?: () => void;
  onTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  stats,
  onRestart,
  onNextLevel,
  onTitle,
}) => {
  const [showCompletionScreen, setShowCompletionScreen] = React.useState(false);
  const isLevel1 = stats.level === 1;
  const isLevel2 = stats.level === 2;
  const isLevel3 = stats.level === 3;
  const isLevel4 = stats.level === 4;
  const isLevel5 = stats.level === 5;

  // Keyboard shortcut: Enter/Space triggers primary action, R restarts current level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCompletionScreen) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onTitle();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          e.stopPropagation();
          setShowCompletionScreen(false);
          onRestart();
        }
        return;
      }

      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (isLevel5) {
          setShowCompletionScreen(true);
        } else if (onNextLevel) {
          onNextLevel();
        } else {
          onRestart();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLevel1, isLevel4, isLevel5, onNextLevel, onRestart, onTitle, showCompletionScreen]);

  if (showCompletionScreen) {
    return (
      <div
        data-testid="completion-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-2xl select-none font-sans animate-in fade-in duration-300"
      >
        <div className="relative bg-zinc-900/90 border border-amber-500/50 shadow-2xl shadow-amber-500/20 w-full max-w-lg p-6 sm:p-8 text-zinc-100 rounded-3xl overflow-hidden backdrop-blur-2xl">
          {/* Top Decorative Glows */}
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Trophy & Title Header */}
          <div className="text-center pb-5 border-b border-white/10">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/30 via-yellow-400/20 to-emerald-500/30 border border-amber-400/60 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/25 backdrop-blur-md mb-4">
              🏆
            </div>

            <div className="inline-block px-3.5 py-1 mb-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono shadow-sm">
              ★ SERTIFIKASI OPERATOR FORKLIFT TUNTAS ★
            </div>

            <h1
              data-testid="completion-title"
              className="text-2xl sm:text-3xl font-black tracking-wide uppercase text-white font-sans"
            >
              UJIAN PRAKTIK SELESAI!
            </h1>

            <p
              data-testid="completion-subtitle"
              className="text-sm sm:text-base font-bold text-emerald-400 mt-2 font-sans px-2"
            >
              Ujian Praktik Selesai! Anda siap bekerja di gudang nyata.
            </p>
          </div>

          {/* Detailed Performance Metrics */}
          <div className="grid grid-cols-2 gap-3.5 my-5">
            <div className="bg-white/[0.05] border border-white/10 p-4 rounded-2xl text-center backdrop-blur-md shadow-lg">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">TOTAL WAKTU</div>
              <div
                data-testid="completion-total-time"
                className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-1 font-mono"
              >
                {stats.timeElapsed}s
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1">
                {Math.floor(stats.timeElapsed / 60)}m {stats.timeElapsed % 60}s
              </div>
            </div>

            <div className="bg-white/[0.05] border border-white/10 p-4 rounded-2xl text-center backdrop-blur-md shadow-lg">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">TOTAL SKOR AKHIR</div>
              <div
                data-testid="completion-total-score"
                className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums mt-1 font-mono"
              >
                {stats.score}
              </div>
              <div className="text-[10px] text-amber-300/80 font-mono mt-1">★ Nilai Istimewa</div>
            </div>
          </div>

          {/* Congratulations Card */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-zinc-200 leading-relaxed font-sans mb-6">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-1 font-mono text-[11px]">
              <span>✓</span>
              <span>5 DARI 5 TAHAPAN UJIAN DITUNTASKAN SECARA PROFESIONAL</span>
            </div>
            <p className="text-zinc-300 text-[11px]">
              Anda telah menguasai operasional forklift: pengiriman kargo lantai, presisi rak bertingkat tinggi, manuver lorong sempit, kendali rute zig-zag kargo rapuh, serta pendakian dan penanganan tanjakan/turunan loading dock.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              data-testid="btn-kembali-menu-utama"
              onClick={onTitle}
              className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:from-amber-600 active:to-yellow-600 text-zinc-950 font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center space-x-2 group hover:scale-[1.02] active:scale-[0.98] font-mono"
            >
              <span>Kembali ke Menu Utama</span>
              <svg
                className="w-4 h-4 text-zinc-950"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>

            <button
              data-testid="btn-mainkan-lagi-level-5"
              onClick={() => {
                setShowCompletionScreen(false);
                onRestart();
              }}
              className="w-full cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Mainkan Lagi Level 5</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="level-completed-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-2xl select-none font-sans animate-in fade-in duration-300"
    >
      <div className="relative bg-zinc-900/80 border border-emerald-500/40 shadow-2xl shadow-emerald-500/20 w-full max-w-lg p-6 sm:p-8 text-zinc-100 rounded-3xl overflow-hidden backdrop-blur-2xl">
        {/* Top Decorative Glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Trophy Icon */}
        <div className="flex items-start space-x-4 pb-4 border-b border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-2xl shrink-0 shadow-xl shadow-emerald-500/20 backdrop-blur-md">
            <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <div className="inline-block px-3 py-1 mb-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono shadow-sm">
              {isLevel1
                ? 'MISI LEVEL 1 TUNTAS · 100%'
                : isLevel2
                ? 'MISI LEVEL 2 TUNTAS · ELEVASI RAK 1.36M'
                : isLevel3
                ? 'MISI LEVEL 3 TUNTAS · LORONG SEMPIT 17M'
                : isLevel4
                ? 'MISI LEVEL 4 TUNTAS · RINTANGAN ZIG-ZAG'
                : 'MISI LEVEL 5 TUNTAS · LOADING DOCK PLATFORM'}
            </div>

            {/* Pop-up UI besar di tengah layar */}
            <h1
              data-testid="level-completed-title"
              className="text-xl sm:text-2xl lg:text-3xl font-black tracking-wide uppercase text-white leading-tight font-sans"
            >
              <span>
                {isLevel1
                  ? 'LEVEL 1 SELESAI'
                  : isLevel2
                  ? 'LEVEL 2 SELESAI'
                  : isLevel3
                  ? 'LEVEL 3 SELESAI'
                  : isLevel4
                  ? 'LEVEL 4 SELESAI'
                  : 'LEVEL 5 SELESAI'}
              </span>
              <span className="text-emerald-400 mx-2">-</span>
              <span className="text-emerald-400">
                {isLevel1
                  ? 'Kerja Bagus, Operator!'
                  : isLevel2
                  ? 'Presisi yang Bagus!'
                  : isLevel3
                  ? 'Manuver Sempurna!'
                  : isLevel4
                  ? 'Penanganan Kargo Sempurna!'
                  : 'Pemuatan Kargo Sukses!'}
              </span>
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-zinc-300 mt-1 font-mono">
              {isLevel1
                ? 'Operasi Pengiriman Lantai Selesai'
                : isLevel2
                ? 'Penempatan Palet di Atas Rak Berhasil'
                : isLevel3
                ? 'Lorong Sempit Dilalui Tanpa Insiden'
                : isLevel4
                ? 'Rintangan Zig-Zag Dilalui dengan Selamat'
                : 'Pemuatan Kargo ke Loading Dock Berhasil Sempurna'}
            </p>
          </div>
        </div>

        {/* Mission Summary Narrative */}
        <div className="my-5 p-4 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-zinc-200 leading-relaxed font-sans backdrop-blur-md">
          {isLevel1
            ? 'Palet kayu berhasil diambil dari posisi awal, dipindahkan melewati lorong gudang, dan diturunkan dengan tepat dan aman di dalam Area Pengiriman lantai.'
            : isLevel2
            ? 'Luar biasa! Palet kayu berhasil diangkat tinggi, bermanuver di depan rak, dan diletakkan dengan presisi di atas rak tingkat atas (1.36m) tanpa terjatuh.'
            : isLevel3
            ? 'Manuver luar biasa! Anda sukses mengendalikan forklift membawa muatan palet melewati lorong sempit berjejer rak padat sepanjang 17 meter, dan menurunkan palet dengan aman tepat di Drop Zone hijau.'
            : isLevel4
            ? 'Hebat! Anda sukses mengemudikan forklift membawa muatan kargo melewati rintangan zig-zag yang penuh tantangan, dan menurunkannya secara aman di Drop Zone.'
            : 'Luar biasa, Operator! Anda berhasil mengambil palet di lantai gudang, menaiki tanjakan ramp bersudut landai dengan mulus dan stabil, lalu menempatkan kargo tepat di Drop Zone platform loading dock!'}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3.5 my-5">
          <div className="bg-white/[0.05] border border-white/10 p-4 rounded-2xl text-center backdrop-blur-md shadow-lg">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">WAKTU SELESAI</div>
            <div className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-1 font-mono">
              {stats.timeElapsed}s
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">Efisiensi Tinggi</div>
          </div>
          <div className="bg-white/[0.05] border border-white/10 p-4 rounded-2xl text-center backdrop-blur-md shadow-lg">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">SKOR OPERATOR</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums mt-1 font-mono">
              {stats.score}
            </div>
            <div className="text-[10px] text-amber-300/80 mt-1">★ Skor Maksimal</div>
          </div>
        </div>

        {/* Verification Checkpoints */}
        <div className="space-y-2 py-1 text-[11px] text-zinc-300 font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>
              {isLevel1
                ? 'Palet tepat di dalam batas garis hijau Drop Zone lantai'
                : isLevel2
                ? 'Palet bertumpu stabil di atas collider tingkat 2 rak (y = 1.36m)'
                : isLevel3
                ? 'Palet berhasil dibawa melewati lorong sempit dan mendarat di Drop Zone'
                : isLevel4
                ? 'Palet berhasil dibawa melintasi rute zig-zag dan mendarat di Drop Zone'
                : 'Palet berhasil dibawa menaiki tanjakan ramp dan mendarat di platform loading dock'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Kuncian garpu dilepaskan bersih &amp; muatan aman di zona tujuan</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 mt-2 border-t border-white/10">
          {isLevel1 ? (
            <>
              {/* Tombol 'Lanjut ke Level 2' untuk Level 1 */}
              <button
                data-testid="btn-lanjut-level-2"
                onClick={onNextLevel ?? onRestart}
                className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-zinc-950 font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 group hover:scale-[1.02] active:scale-[0.98] font-mono"
              >
                <span>Lanjut ke Level 2</span>
                <svg
                  className="w-4 h-4 text-zinc-950 transition-transform group-hover:translate-x-1 duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  data-testid="btn-muat-ulang-level-1"
                  onClick={onRestart}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Muat Ulang Level 1</span>
                </button>
                <button
                  onClick={onTitle}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Menu Utama</span>
                </button>
              </div>
            </>
          ) : isLevel2 ? (
            <>
              {/* Tombol 'Lanjut ke Level 3' untuk Level 2 */}
              <button
                data-testid="btn-lanjut-level-3"
                onClick={onNextLevel ?? onRestart}
                className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-zinc-950 font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 group hover:scale-[1.02] active:scale-[0.98] font-mono"
              >
                <span>Lanjut ke Level 3</span>
                <svg
                  className="w-4 h-4 text-zinc-950 transition-transform group-hover:translate-x-1 duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  data-testid="btn-muat-ulang-level-2"
                  onClick={onRestart}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg
                    className="w-3.5 h-3.5 text-zinc-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2.5 11.5a10 10 0 0 1 17.5-5.5l1.5 2M21.5 12.5a10 10 0 0 1-17.5 5.5l-1.5-2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Muat Ulang Level 2</span>
                </button>
                <button
                  onClick={onTitle}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Menu Utama</span>
                </button>
              </div>
            </>
          ) : isLevel3 ? (
            <>
              {/* Tombol 'Lanjut ke Level 4' untuk Level 3 */}
              <button
                data-testid="btn-lanjut-level-4"
                onClick={onNextLevel ?? onRestart}
                className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-zinc-950 font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 group hover:scale-[1.02] active:scale-[0.98] font-mono"
              >
                <span>Lanjut ke Level 4</span>
                <svg
                  className="w-4 h-4 text-zinc-950 transition-transform group-hover:translate-x-1 duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  data-testid="btn-muat-ulang-level-3"
                  onClick={onRestart}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg
                    className="w-3.5 h-3.5 text-zinc-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2.5 11.5a10 10 0 0 1 17.5-5.5l1.5 2M21.5 12.5a10 10 0 0 1-17.5 5.5l-1.5-2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Muat Ulang Level 3</span>
                </button>
                <button
                  onClick={onTitle}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Menu Utama</span>
                </button>
              </div>
            </>
          ) : isLevel4 ? (
            <>
              {/* Tombol 'Lanjut ke Level 5' untuk Level 4 */}
              <button
                data-testid="btn-lanjut-level-5"
                onClick={onNextLevel ?? onRestart}
                className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-zinc-950 font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 group hover:scale-[1.02] active:scale-[0.98] font-mono"
              >
                <span>Lanjut ke Level 5: Loading Dock</span>
                <svg
                  className="w-4 h-4 text-zinc-950 transition-transform group-hover:translate-x-1 duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  data-testid="btn-muat-ulang-level-4"
                  onClick={onRestart}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Muat Ulang Level 4</span>
                </button>
                <button
                  data-testid="btn-menu-utama"
                  onClick={onTitle}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Menu Utama</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Tombol Kemenangan Level 5: 'Selesai & Lihat Skor' */}
              <button
                data-testid="btn-selesai-lihat-skor"
                onClick={() => setShowCompletionScreen(true)}
                className="w-full cursor-pointer py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-zinc-950 font-black uppercase text-xs sm:text-sm tracking-wider transition-all duration-200 rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2 group hover:scale-[1.02] active:scale-[0.98] font-mono"
              >
                <span>Selesai &amp; Lihat Skor</span>
                <svg
                  className="w-4 h-4 text-zinc-950 transition-transform group-hover:translate-x-1 duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  data-testid="btn-muat-ulang-level-5"
                  onClick={onRestart}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Muat Ulang Level 5</span>
                </button>
                <button
                  data-testid="btn-menu-utama"
                  onClick={onTitle}
                  className="cursor-pointer py-3 px-3 bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white uppercase text-xs tracking-wider transition-all duration-200 border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center space-x-1.5 font-mono backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Menu Utama</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
