import React, { useState, useEffect } from 'react';

export type LevelNumber = 1 | 2 | 3 | 4 | 5;

interface LevelDetail {
  id: LevelNumber;
  name: string;
  subtitle: string;
  zoneType: string;
  elevation: string;
  description: string;
  target: string;
  difficulty: string;
  specs: { label: string; value: string }[];
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

const LEVELS_DATA: Record<LevelNumber, LevelDetail> = {
  1: {
    id: 1,
    name: 'Level 1: First Drive',
    subtitle: 'Operasi Dasar Gudang & Pengiriman Lantai',
    zoneType: 'Lantai Gudang',
    elevation: 'Elevasi 0.0m',
    description:
      'Tugas dasar operator: Dorong garpu ke bawah bukaan palet kayu, tekan tombol [Q] untuk mengangkat & mengunci muatan, lalu bawa melewati jalur gudang ke Drop Zone hijau di lantai.',
    target: 'Drop Zone Hijau Lantai Gudang (Elevasi 0.0m)',
    difficulty: 'Dasar (Pemula)',
    specs: [
      { label: 'Jarak Tempuh', value: '~15 Meter' },
      { label: 'Muatan', value: 'Palet Standar 1.2m' },
      { label: 'Toleransi', value: 'Standar' },
    ],
    accentColor: 'amber',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/40',
  },
  2: {
    id: 2,
    name: 'Level 2: Rack Placement',
    subtitle: 'Presisi Pengangkatan Mast & Penataan Rak Tinggi',
    zoneType: 'Tingkat 2 · 1.36M',
    elevation: 'Elevasi 1.36m - 1.45m',
    description:
      'Tantangan presisi mast hidrolik: Ambil palet dari lantai, angkat garpu setinggi [1.45m], posisikan tepat di atas rak gudang tingkat dua, lalu turunkan garpu dengan tombol [E] ke Drop Zone atas rak.',
    target: 'Para Rak Atas Gudang (1.36m Solid Shelf)',
    difficulty: 'Menengah (Presisi)',
    specs: [
      { label: 'Ketinggian Rak', value: '1.36 Meter' },
      { label: 'Pengangkatan', value: 'Mast Hidrolik [Q/E]' },
      { label: 'Toleransi', value: 'Ketat (Presisi)' },
    ],
    accentColor: 'emerald',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/40',
  },
  3: {
    id: 3,
    name: 'Level 3: Narrow Aisle',
    subtitle: 'Navigasi Lorong Sempit Antar Rak Bertingkat (VNA)',
    zoneType: 'Lorong Sempit · VNA',
    elevation: 'Elevasi Lantai 0.0m',
    description:
      'Manuver lorong sempit: Ambil palet kayu sebelum memasuki lorong, kemudikan forklift melewati lorong sempit sepanjang 17m yang diapit rak berkisi solid tanpa menabrak dinding, dan letakkan di Drop Zone hijau ujung lorong.',
    target: 'Drop Zone Hijau Ujung Lorong Sempit (Lantai)',
    difficulty: 'Lanjutan (Manuver Sempit)',
    specs: [
      { label: 'Panjang Lorong', value: '17 Meter' },
      { label: 'Lebar Jalur', value: 'Sempit (VNA)' },
      { label: 'Rintangan', value: 'Dinding Rak Samping' },
    ],
    accentColor: 'cyan',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-500/40',
  },
  4: {
    id: 4,
    name: 'Level 4: Fragile Cargo',
    subtitle: 'Rintangan Berkelok Zig-Zag Kargo Sensitif',
    zoneType: 'Rintangan Zig-Zag',
    elevation: 'Elevasi Lantai 0.0m',
    description:
      'Tantangan kargo rapuh & lintasan berliku: Angkat palet kargo di depan, kendalikan forklift melewati serangkaian tong pengaman dan kotak kargo di sepanjang lintasan zig-zag, lalu letakkan di Drop Zone hijau.',
    target: 'Drop Zone Hijau Ujung Lintasan Zig-Zag (18.0m)',
    difficulty: 'Tinggi (Stabilitas Kemudi)',
    specs: [
      { label: 'Rute', value: 'Zig-Zag Berkelok' },
      { label: 'Rintangan', value: 'Drum & Kotak Industri' },
      { label: 'Sensitivitas', value: 'Kargo Sensitif' },
    ],
    accentColor: 'orange',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
    badgeBorder: 'border-orange-500/40',
  },
  5: {
    id: 5,
    name: 'Level 5: Overpass Bridge',
    subtitle: 'Jembatan Layang Berbukit Menuju Platform Loading Dock',
    zoneType: 'Jembatan & Dock',
    elevation: 'Puncak 2.4m → Dock Platform',
    description:
      'Simulasi lintasan jembatan berbukit: Ambil palet di awal, pacu forklift menaiki tanjakan kurva mulus dengan torsi stabil, melintasi jembatan layang datar, menuruni lereng bukit, dan letakkan palet tepat di Drop Zone hijau platform loading dock.',
    target: 'Drop Zone Hijau Platform Loading Dock (Setelah Turunan)',
    difficulty: 'Ahli (Tanjakan, Turunan & Dock)',
    specs: [
      { label: 'Elevasi Puncak', value: '+2.40 Meter' },
      { label: 'Kemiringan', value: 'Smooth Cosine Ramp' },
      { label: 'Zona Akhir', value: 'Loading Dock Platform' },
    ],
    accentColor: 'violet',
    badgeBg: 'bg-violet-500/20',
    badgeText: 'text-violet-300',
    badgeBorder: 'border-violet-500/40',
  },
};

const ALL_LEVELS: LevelNumber[] = [1, 2, 3, 4, 5];

interface TitleScreenProps {
  onStart: (level?: LevelNumber) => void;
  onSelectLevel?: (level: LevelNumber) => void;
  initialLevel?: LevelNumber;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onSelectLevel,
  initialLevel,
}) => {
  // Awalnya tampilkan daftar judul dalam bentuk baris tombol yang elegan
  // Jika initialLevel diberikan secara spesifik gunakan itu, selain itu null (semua baris tertutup awal)
  const [activeLevel, setActiveLevel] = useState<LevelNumber | null>(initialLevel ?? null);

  // Toggle Accordion: Jika judul diklik (active), barisnya memanjang (expand) ke bawah.
  // Jika judul lain diklik, menu yang sebelumnya terbuka akan menutup otomatis.
  const handleToggleAccordion = (lvl: LevelNumber) => {
    setActiveLevel((prev) => (prev === lvl ? null : lvl));
  };

  // Mulai bermain pada level yang dipilih (saat tombol 'MULAI LEVEL INI' ditekan atau Enter/Space)
  const handleStartLevel = (lvl: LevelNumber) => {
    onStart(lvl);
  };

  // Keyboard navigation & shortcuts:
  // 1/2/3/4/5 = Buka accordion level terkait
  // Enter / Space = Mulai level yang sedang aktif (atau buka Level 1 jika belum ada yang terbuka)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Digit1', 'Numpad1'].includes(e.code)) {
        e.preventDefault();
        setActiveLevel(1);
      } else if (['Digit2', 'Numpad2'].includes(e.code)) {
        e.preventDefault();
        setActiveLevel(2);
      } else if (['Digit3', 'Numpad3'].includes(e.code)) {
        e.preventDefault();
        setActiveLevel(3);
      } else if (['Digit4', 'Numpad4'].includes(e.code)) {
        e.preventDefault();
        setActiveLevel(4);
      } else if (['Digit5', 'Numpad5'].includes(e.code)) {
        e.preventDefault();
        setActiveLevel(5);
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        const target = activeLevel ?? 1;
        handleStartLevel(target);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setActiveLevel((prev) => {
          if (prev === null) return 1;
          return (prev < 5 ? prev + 1 : 1) as LevelNumber;
        });
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setActiveLevel((prev) => {
          if (prev === null) return 5;
          return (prev > 1 ? prev - 1 : 5) as LevelNumber;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLevel, onStart]);

  return (
    <div
      data-testid="main-menu-container"
      className="fixed inset-0 z-40 pointer-events-none select-none text-zinc-100 font-sans overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8"
    >
      {/* Subtle Cinematic Left Scrim (Menjamin keterbacaan teks tanpa menutup model 3D Showroom di tengah/kanan) */}
      <div className="absolute inset-y-0 left-0 w-full sm:w-[580px] bg-gradient-to-r from-zinc-950/85 via-zinc-950/45 to-transparent pointer-events-none -z-10" />

      {/* Top Header Bar: Status Simulator & Showroom Badge */}
      <div className="pointer-events-auto flex items-center justify-between border-b border-white/10 pb-3 w-full max-w-7xl mx-auto">
        <div className="flex items-center space-x-3 bg-zinc-950/60 border border-white/10 px-3.5 py-1.5 rounded-2xl backdrop-blur-xl shadow-lg">
          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-200 font-bold">
            3D SHOWROOM DIORAMA · RAPIER 3D PHYSICS
          </span>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-2xl backdrop-blur-xl shadow-lg">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px] text-emerald-300 uppercase tracking-wider font-bold">
            WEBGL 60 FPS AKTIF
          </span>
        </div>
      </div>

      {/* Center Left Floating Panel: Menu Accordion */}
      <div className="pointer-events-auto my-auto w-full max-w-md sm:max-w-lg space-y-4 py-2">
        {/* Game Title & Branding Tag */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] uppercase tracking-widest font-bold backdrop-blur-md">
            <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span>Warehouse Heavy Logistics</span>
          </div>

          <h1
            data-testid="main-menu-title"
            className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white leading-tight font-sans drop-shadow-md"
          >
            FORKLIFT OPERATOR <span className="text-amber-400">SIMULATOR</span>
          </h1>

          <p className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
            Pilih Misi Operasi Gudang untuk Memulai
          </p>
        </div>

        {/* Accordion Menu Container */}
        <div
          data-testid="level-select-accordion"
          className="space-y-2.5 bg-zinc-950/50 border border-white/10 p-3 sm:p-4 rounded-3xl backdrop-blur-2xl shadow-2xl shadow-black/80"
        >
          {ALL_LEVELS.map((lvl) => {
            const detail = LEVELS_DATA[lvl];
            const isExpanded = activeLevel === lvl;

            return (
              <div
                key={lvl}
                className={`rounded-2xl transition-all duration-300 border overflow-hidden ${
                  isExpanded
                    ? 'bg-zinc-900/90 border-amber-400/80 shadow-xl shadow-amber-500/10'
                    : 'bg-zinc-900/40 hover:bg-zinc-850/60 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Accordion Title Row Button */}
                <button
                  type="button"
                  data-testid={`btn-select-level-${lvl}`}
                  onClick={() => handleToggleAccordion(lvl)}
                  aria-expanded={isExpanded}
                  className="w-full text-left p-3 sm:p-3.5 flex items-center justify-between cursor-pointer group transition-colors"
                >
                  <div className="flex items-center space-x-3 truncate">
                    {/* Level Number Badge */}
                    <span
                      className={`font-mono text-xs font-black px-2.5 py-1 rounded-xl uppercase tracking-wider transition-colors ${
                        isExpanded
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-white/10 text-zinc-300 group-hover:text-white group-hover:bg-white/15'
                      }`}
                    >
                      LVL 0{lvl}
                    </span>

                    {/* Level Name */}
                    <div className="truncate">
                      <div
                        className={`text-sm sm:text-base font-bold tracking-wide transition-colors uppercase ${
                          isExpanded ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                        }`}
                      >
                        {detail.name}
                      </div>
                    </div>
                  </div>

                  {/* Right: Zone Type Tag & Chevron Arrow */}
                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    <span className="hidden sm:inline text-[11px] font-mono text-zinc-400 bg-white/[0.06] px-2 py-0.5 rounded-lg border border-white/5">
                      {detail.zoneType}
                    </span>

                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isExpanded
                          ? 'bg-amber-400/20 text-amber-400 rotate-180'
                          : 'bg-white/[0.05] text-zinc-400 group-hover:text-white group-hover:bg-white/10'
                      }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded Accordion Body (Hanya tampil saat active) */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 pt-1 space-y-3.5 border-t border-white/10 bg-black/40 animate-in fade-in duration-200">
                    {/* Subtitle / Objective Pill */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                      <span className="text-amber-300 font-semibold">{detail.subtitle}</span>
                      <span className="text-zinc-400">
                        Kesulitan: <b className="text-white">{detail.difficulty}</b>
                      </span>
                    </div>

                    {/* Deskripsi Misi */}
                    <div>
                      <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        Deskripsi Tugas:
                      </div>
                      <p
                        data-testid="level-description"
                        className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans"
                      >
                        {detail.description}
                      </p>
                    </div>

                    {/* Target Misi */}
                    <div>
                      <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        Target Sasaran Operasi:
                      </div>
                      <div className="flex items-center space-x-2 bg-white/[0.06] border border-white/10 px-3 py-2 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span
                          data-testid="level-target"
                          className="font-mono text-xs font-bold text-emerald-300 truncate"
                        >
                          {detail.target}
                        </span>
                      </div>
                    </div>

                    {/* Key Specs Row */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                      {detail.specs.map((spec, i) => (
                        <div
                          key={i}
                          className="bg-white/[0.04] p-2 rounded-xl border border-white/5"
                        >
                          <div className="text-[10px] text-zinc-400 uppercase">{spec.label}</div>
                          <div className="text-zinc-200 font-bold mt-0.5 truncate">{spec.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tombol 'MULAI LEVEL INI' */}
                    <div className="pt-1">
                      <button
                        type="button"
                        data-testid="btn-mulai-level-ini"
                        onClick={() => handleStartLevel(lvl)}
                        className="w-full cursor-pointer py-3.5 px-5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:from-amber-600 text-zinc-950 font-black tracking-wider uppercase text-xs sm:text-sm transition-all duration-200 rounded-xl shadow-xl shadow-amber-500/25 flex items-center justify-center space-x-2.5 font-mono group hover:scale-[1.01] active:scale-[0.98]"
                      >
                        <span>MULAI LEVEL INI</span>
                        <svg
                          className="w-4 h-4 text-zinc-950 transition-transform group-hover:translate-x-1 duration-200"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Info Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-y-2 text-xs font-mono text-zinc-300 w-full max-w-7xl mx-auto border-t border-white/10 pt-3">
        <div className="flex items-center space-x-2 bg-zinc-950/60 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xl">
          <span className="text-amber-400 font-bold">KENDALI:</span>
          <span>W/A/S/D Kemudi</span>
          <span className="text-zinc-500">·</span>
          <span>Q/E Garpu Mast</span>
          <span className="text-zinc-500">·</span>
          <span>Space Rem</span>
        </div>

        <div className="text-zinc-400 bg-zinc-950/60 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xl">
          Pilih judul level di atas atau tekan <kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded border border-white/15 text-[11px] font-semibold">1-5</kbd> di keyboard
        </div>
      </div>
    </div>
  );
};
