import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SimulatorEngine } from './simulator/engine.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { HUD } from './components/HUD.tsx';
import { PauseModal } from './components/PauseModal.tsx';
import { VictoryModal } from './components/VictoryModal.tsx';
import { FailureModal } from './components/FailureModal.tsx';
import { sound } from './simulator/audio.ts';
import type { GameState, CameraMode, SimulatorStats } from './simulator/types.ts';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulatorEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isInputLocked, setIsInputLocked] = useState<boolean>(false);
  const isInputLockedRef = useRef<boolean>(false);
  const [failureReason, setFailureReason] = useState<string>('Kargo Rusak!');
  const [stats, setStats] = useState<SimulatorStats>({
    speedKmh: 0,
    forkHeightM: 0.1,
    deliveredCount: 0,
    totalCount: 1,
    score: 0,
    timeElapsed: 0,
    cargoLoaded: false,
    cargoLocked: false,
    level: 1,
  });

  // Keep track of active keys
  const keysDownRef = useRef<Set<string>>(new Set());

  // Update body dataset state for accessibility and automated testing
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Check for ?autostart=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
      engineRef.current?.setGameState('playing');
    }
  }, []);

  // Timer Otomatis: Mulai menghitung otomatis sejak level dimuat (playing/intro),
  // dan HANYA berhenti/pause saat fungsi win ('gameover') atau lose ('failed') atau pause ('paused') terpanggil
  useEffect(() => {
    if (gameState !== 'playing' && gameState !== 'intro') return;

    const timerInterval = setInterval(() => {
      setStats((prev) => {
        const engineTime = engineRef.current ? Math.floor(engineRef.current.getTimeElapsed()) : prev.timeElapsed + 1;
        const nextTime = engineTime > prev.timeElapsed ? engineTime : prev.timeElapsed + 1;
        if (engineRef.current && engineTime < nextTime) {
          engineRef.current.setTimeElapsed(nextTime);
        }
        return {
          ...prev,
          timeElapsed: nextTime,
        };
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [gameState]);

  // Initialize Three.js Simulator Engine once
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new SimulatorEngine(
      containerRef.current,
      (newStats) => {
        setStats(newStats);
      },
      () => {
        setGameState('gameover');
        engineRef.current?.setGameState('gameover');
      },
      (reason) => {
        setIsInputLocked(true);
        isInputLockedRef.current = true;
        setFailureReason(reason || 'Kargo Rusak!');
        setGameState('failed');
        engineRef.current?.setGameState('failed');
      }
    );

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      sound.dispose();
    };
  }, []);

  // Handle Input Keydown / Keyup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Jika dalam state intro kamera sinematik, tekan Space/Enter/Escape untuk lewati
      if (gameState === 'intro') {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          e.preventDefault();
          engineRef.current?.skipCameraIntro();
        }
        return;
      }

      // Jika modal gagal atau input dikunci, jangan proses input stereng/pemanduan
      if (isInputLockedRef.current || gameState === 'failed') {
        if (gameState === 'playing') {
          isInputLockedRef.current = false;
          setIsInputLocked(false);
        } else {
          return;
        }
      }

      // Prevent default scrolling for game controls
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      keysDownRef.current.add(e.code);

      // Edge triggers
      if (e.code === 'KeyC') {
        setCameraMode((prev) => {
          const next: CameraMode =
            prev === 'chase' ? 'overhead' : prev === 'overhead' ? 'driver' : 'chase';
          engineRef.current?.setCameraMode(next);
          return next;
        });
        return;
      }

      if (e.code === 'KeyM') {
        setIsMuted((prev) => {
          const next = !prev;
          sound.setMuted(next);
          return next;
        });
        return;
      }

      if (e.code === 'KeyR' && gameState === 'playing') {
        engineRef.current?.resetForklift();
        return;
      }

      if ((e.code === 'Escape' || e.code === 'KeyP') && (gameState === 'playing' || gameState === 'paused')) {
        setGameState((prev) => {
          const next = prev === 'playing' ? 'paused' : 'playing';
          engineRef.current?.setGameState(next);
          return next;
        });
        return;
      }

      syncInputsToEngine();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.code);
      if (!isInputLockedRef.current && gameState === 'playing') {
        syncInputsToEngine();
      }
    };

    const handleBlur = () => {
      // Clear keys on window blur so they never stick
      keysDownRef.current.clear();
      syncInputsToEngine();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState]);

  const syncInputsToEngine = useCallback(() => {
    const keys = keysDownRef.current;
    const forward = keys.has('KeyW') || keys.has('ArrowUp');
    const backward = keys.has('KeyS') || keys.has('ArrowDown');
    const steerLeft = keys.has('KeyA') || keys.has('ArrowLeft');
    const steerRight = keys.has('KeyD') || keys.has('ArrowRight');
    const forkUp = keys.has('KeyQ') || keys.has('PageUp') || keys.has('KeyU');
    const forkDown = keys.has('KeyE') || keys.has('PageDown') || keys.has('KeyJ');
    const brake = keys.has('Space');
    const horn = keys.has('KeyH') || keys.has('KeyF');

    engineRef.current?.updateInput({
      forward,
      backward,
      steerLeft,
      steerRight,
      forkUp,
      forkDown,
      brake,
      horn,
    });
  }, []);

  const clearAllInputs = useCallback(() => {
    keysDownRef.current.clear();
    engineRef.current?.resetInputs();
  }, []);

  /**
   * Reset flag/state input dan buka kunci (unlocked) secara bersih (Langkah 3)
   */
  const unlockAllInputs = useCallback(() => {
    setIsInputLocked(false);
    isInputLockedRef.current = false;
    keysDownRef.current.clear();
    engineRef.current?.unlockInput();
    engineRef.current?.resetInputs();
    window.focus();
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  const handleStartWithIntro = (level: 1 | 2 | 3 | 4 | 5) => {
    unlockAllInputs();
    setStats((prev) => ({ ...prev, timeElapsed: 0, level }));
    engineRef.current?.setTimeElapsed(0);
    engineRef.current?.setLevel(level);
    setGameState('intro');
    engineRef.current?.startCameraIntro(() => {
      setGameState('playing');
      syncInputsToEngine();
    });
  };

  const handleStartGame = (level?: 1 | 2 | 3 | 4 | 5) => {
    handleStartWithIntro(level ?? 1);
  };

  const handleSelectLevel = (level: 1 | 2 | 3 | 4 | 5) => {
    handleStartWithIntro(level);
  };

  const handleSkipIntro = () => {
    engineRef.current?.skipCameraIntro();
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      return next;
    });
  };

  const handleToggleCamera = () => {
    setCameraMode((prev) => {
      const next: CameraMode =
        prev === 'chase' ? 'overhead' : prev === 'overhead' ? 'driver' : 'chase';
      engineRef.current?.setCameraMode(next);
      return next;
    });
  };

  const handlePause = () => {
    clearAllInputs();
    setGameState('paused');
    engineRef.current?.setGameState('paused');
  };

  const handleResume = () => {
    unlockAllInputs();
    setGameState('playing');
    engineRef.current?.setGameState('playing');
    engineRef.current?.unpausePhysics();
    syncInputsToEngine();
  };

  const handleReset = () => {
    unlockAllInputs();
    setStats((prev) => ({ ...prev, timeElapsed: 0 }));
    engineRef.current?.setTimeElapsed(0);
    engineRef.current?.resetForklift();
    setGameState('playing');
    engineRef.current?.setGameState('playing');
    engineRef.current?.unpausePhysics();
    syncInputsToEngine();
  };

  const handleResetPallet = () => {
    engineRef.current?.resetPallet();
  };

  const handleNextLevel = () => {
    unlockAllInputs();
    setStats((prev) => ({ ...prev, timeElapsed: 0 }));
    engineRef.current?.setTimeElapsed(0);
    if (stats.level === 1) {
      engineRef.current?.setLevel(2);
    } else if (stats.level === 2) {
      engineRef.current?.setLevel(3);
    } else if (stats.level === 3) {
      engineRef.current?.setLevel(4);
    } else if (stats.level === 4) {
      engineRef.current?.setLevel(5);
    } else {
      // Level 5: reset posisi forklift dan kargo
      engineRef.current?.resetForklift();
    }
    setGameState('playing');
    engineRef.current?.setGameState('playing');
    engineRef.current?.unpausePhysics();
    syncInputsToEngine();
  };

  const handleRestartCurrentLevel = () => {
    unlockAllInputs();
    setStats((prev) => ({ ...prev, timeElapsed: 0 }));
    engineRef.current?.setTimeElapsed(0);
    engineRef.current?.setLevel((stats.level ?? 1) as 1 | 2 | 3 | 4 | 5);
    setGameState('playing');
    engineRef.current?.setGameState('playing');
    engineRef.current?.unpausePhysics();
    syncInputsToEngine();
  };

  const handleTitle = () => {
    unlockAllInputs();
    setGameState('title');
    engineRef.current?.setGameState('title');
    engineRef.current?.setLevel(1);
    engineRef.current?.resetForklift();
  };

  const handleTriggerHorn = () => {
    sound.playHorn();
  };

  const handleButtonInput = (actionKey: string, pressed: boolean) => {
    engineRef.current?.updateInput({
      [actionKey]: pressed,
    });
  };

  const handleDropForklift = () => {
    engineRef.current?.dropForklift(4.0);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-950 font-sans select-none">
      {/* Isolated Three.js WebGL Container */}
      <div
        ref={containerRef}
        data-testid="three-canvas-container"
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Screen Views / Game Shell */}
      {gameState === 'title' && (
        <TitleScreen onStart={handleStartGame} onSelectLevel={handleSelectLevel} />
      )}

      {/* Cinematic Intro State (Need for Speed Camera Sweep) */}
      {gameState === 'intro' && (
        <div
          data-testid="cinematic-intro-overlay"
          onClick={handleSkipIntro}
          className="fixed inset-0 z-30 pointer-events-auto flex flex-col justify-between select-none font-sans cursor-pointer"
        >
          {/* Top Letterbox Bar */}
          <div className="w-full h-12 sm:h-16 bg-black border-b border-white/10 flex items-center justify-between px-6 shadow-2xl transition-all duration-700">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono text-xs font-black uppercase tracking-widest text-zinc-300">
                FORKLIFT OPERATOR · KOKPIT AKTIF
              </span>
            </div>
            <div className="font-mono text-[11px] text-amber-300 uppercase tracking-wider font-bold">
              SINEMATIK INTRO
            </div>
          </div>

          {/* Center Subtle Mission Splash */}
          <div className="my-auto text-center space-y-2 pointer-events-none px-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-black/60 border border-amber-400/50 text-amber-300 font-mono text-xs uppercase tracking-widest font-black backdrop-blur-md shadow-xl animate-cinematic-pulse">
              ★ MEMULAI MISI LEVEL {stats.level} ★
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-wider drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              {stats.level === 1
                ? 'FIRST DRIVE'
                : stats.level === 2
                ? 'RACK PLACEMENT'
                : stats.level === 3
                ? 'NARROW AISLE'
                : stats.level === 4
                ? 'FRAGILE CARGO'
                : 'OVERPASS BRIDGE'}
            </h2>
          </div>

          {/* Bottom Letterbox Bar */}
          <div className="w-full h-12 sm:h-16 bg-black border-t border-white/10 flex items-center justify-between px-6 shadow-2xl transition-all duration-700">
            <div className="font-mono text-xs text-zinc-400">
              Menyelaraskan sudut pandang kamera operator...
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono text-amber-300/90 font-bold bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <span>Tekan</span>
              <kbd className="px-2 py-0.5 bg-black/60 rounded border border-white/20 text-white font-mono text-[11px]">
                SPACE
              </kbd>
              <span>untuk lewati</span>
            </div>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <HUD
          stats={stats}
          cameraMode={cameraMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onPause={handlePause}
          onReset={handleReset}
          onResetPallet={handleResetPallet}
          onDropForklift={handleDropForklift}
          onTriggerHorn={handleTriggerHorn}
          onSetForkHeight={(h) => engineRef.current?.setForkHeight(h)}
          onButtonInput={handleButtonInput}
          onTitle={handleTitle}
        />
      )}

      {gameState === 'paused' && (
        <PauseModal onResume={handleResume} onRestart={handleReset} onTitle={handleTitle} />
      )}

      {gameState === 'gameover' && (
        <VictoryModal
          stats={stats}
          onRestart={handleReset}
          onNextLevel={handleNextLevel}
          onTitle={handleTitle}
        />
      )}

      {gameState === 'failed' && (
        <FailureModal
          reason={failureReason}
          stats={stats}
          onRestart={handleRestartCurrentLevel}
          onTitle={handleTitle}
        />
      )}
    </main>
  );
}
