import * as THREE from 'three';
import { createForkliftModel, ForkliftMeshComponents } from './forkliftModel.ts';
import { createWarehouseScene, WarehouseEnvironment } from './warehouseScene.ts';
import { canPickupCargo, isCargoInDropZone, SIM_CONSTANTS } from './physics.ts';
import { initRapier, PhysicsRapierWorld, getLevel5TrackHeight, lerp } from './physicsRapier.ts';
import { sound } from './audio.ts';
import type { ForkliftKinematics, InputState, CameraMode, SimulatorStats, GameState } from './types.ts';

// Pre-allocated reusable scratch math objects (Zero GC in animation loop)
const _cameraTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class SimulatorEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private warehouse: WarehouseEnvironment;
  private forklift: ForkliftMeshComponents;
  public physicsWorld: PhysicsRapierWorld | null = null;

  public currentPitch: number = 0;
  private smoothedPitch: number = 0;

  private kinematics: ForkliftKinematics = {
    x: 0,
    z: 4,
    rotation: 0,
    speed: 0,
    steerAngle: 0,
    forkHeight: 0.1,
    wheelRotation: 0,
  };

  private inputState: InputState = {
    forward: false,
    backward: false,
    steerLeft: false,
    steerRight: false,
    forkUp: false,
    forkDown: false,
    brake: false,
    horn: false,
  };

  private cameraMode: CameraMode = 'chase';
  private gameState: GameState = 'title';
  public isIntroActive: boolean = false;
  private introElapsed: number = 0;
  private readonly introDuration: number = 2.5; // 2.5s durasi animasi intro kamera
  private onIntroCompleteCallback?: () => void;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private timeElapsed: number = 0;
  private isTimerPaused: boolean = false;
  private score: number = 0;
  private deliveredCount: number = 0;
  private loadedCargoId: string | null = null;
  private currentLevel: 1 | 2 | 3 | 4 | 5 = 1;
  private isDelivered: boolean = false;
  private isFailed: boolean = false;
  public isInputLocked: boolean = false;
  private hasEverCarriedPallet: boolean = false;
  private wasCarriedPrevFrame: boolean = false;
  private wasLockedPrevFrame: boolean = false;
  private hasLandedFirstTime: boolean = false;
  private cameraShakeTrauma: number = 0;

  private onStatsUpdate?: (stats: SimulatorStats) => void;
  private onGameOver?: () => void;
  private onGameFailed?: (reason: string) => void;
  private statsThrottleTimer: number = 0;

  constructor(
    container: HTMLElement,
    onStatsUpdate?: (stats: SimulatorStats) => void,
    onGameOver?: () => void,
    onGameFailed?: (reason: string) => void
  ) {
    this.container = container;
    this.onStatsUpdate = onStatsUpdate;
    this.onGameOver = onGameOver;
    this.onGameFailed = onGameFailed;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Headless / Playwright detection
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    // Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 150);
    this.camera.position.set(0, 5, 12);

    // Scene & Environment
    this.warehouse = createWarehouseScene(this.renderer);
    this.forklift = createForkliftModel();
    this.warehouse.scene.add(this.forklift.group);

    // Initial position
    this.updateForkliftVisuals();

    // Initialize Rapier Physics Engine
    initRapier().then(() => {
      this.physicsWorld = new PhysicsRapierWorld();
      // Drop forklift from height onto floor
      this.dropForklift(3.8, 0, 4);
    });

    // Resize listener
    window.addEventListener('resize', this.handleResize);

    // Start loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public setGameState(state: GameState) {
    this.gameState = state;
    this.lastTime = performance.now();
    if (state === 'playing') {
      this.isFailed = false;
      this.isDelivered = false;
      this.isTimerPaused = false;
      this.unlockInput();
      this.unpausePhysics();
      // Pastikan loop requestAnimationFrame aktif berjalan
      if (this.animationFrameId === null) {
        this.animationFrameId = requestAnimationFrame(this.tick);
      }
      sound.startEngine();
      if (!this.hasLandedFirstTime && this.physicsWorld) {
        if (this.currentLevel === 3) {
          this.dropForklift(0.55, 6.0, 21.0, 0);
        } else if (this.currentLevel === 4) {
          this.dropForklift(0.55, 0.0, -17.5, Math.PI);
        } else if (this.currentLevel === 5) {
          this.dropForklift(0.55, 17.5, -23.5, Math.PI / 2);
        } else {
          this.dropForklift(0.55, 0, 4.0, 0);
        }
      }
    } else if (state === 'intro') {
      this.isFailed = false;
      this.isDelivered = false;
      this.isTimerPaused = false;
      this.isIntroActive = true;
      this.introElapsed = 0;
      this.unpausePhysics();
      sound.startEngine();
      if (this.animationFrameId === null) {
        this.animationFrameId = requestAnimationFrame(this.tick);
      }
    } else if (state === 'failed') {
      this.isFailed = true;
      this.isTimerPaused = true;
      this.lockInput();
      this.pausePhysics();
      sound.stopEngine();
      sound.stopHydraulics();
    } else if (state === 'paused' || state === 'gameover') {
      this.isTimerPaused = true;
      sound.stopEngine();
      sound.stopHydraulics();
    }
  }

  /**
   * Kunci status input kendali pemain semasa FailureModal atau jeda
   */
  public lockInput() {
    this.isInputLocked = true;
    this.resetInputs();
  }

  /**
   * Buka semula (unlock) status input kendali agar pemain boleh segera bergerak selepas restart (Langkah 3)
   */
  public unlockInput() {
    this.isInputLocked = false;
  }

  /**
   * Jeda (pause) enjin fizik Rapier (Langkah 2)
   */
  public pausePhysics() {
    this.physicsWorld?.pause();
  }

  /**
   * Nyahjeda (unpause) enjin fizik Rapier & kejutkan rigid-body (Langkah 2)
   */
  public unpausePhysics() {
    if (this.physicsWorld) {
      this.physicsWorld.unpause();
      this.physicsWorld.forkliftBody.wakeUp();
      this.physicsWorld.palletBody.wakeUp();
    }
  }

  /**
   * Setel ulang kecepatan linear dan angular (setLinearVelocity dan setAngularVelocity) (Langkah 1)
   */
  public setLinearVelocity(
    target: 'forklift' | 'pallet' | 'both',
    xOrVec: number | { x?: number; y?: number; z?: number } = 0,
    y: number = 0,
    z: number = 0
  ) {
    this.physicsWorld?.setLinearVelocity(target, xOrVec, y, z);
  }

  public setAngularVelocity(
    target: 'forklift' | 'pallet' | 'both',
    xOrVec: number | { x?: number; y?: number; z?: number } = 0,
    y: number = 0,
    z: number = 0
  ) {
    this.physicsWorld?.setAngularVelocity(target, xOrVec, y, z);
  }

  public updateInput(newInput: Partial<InputState>) {
    // Abaikan input jika terkunci (isInputLocked) kecuali jika arahan kosong (semua false)
    if (this.isInputLocked) {
      const hasActiveInput = Object.values(newInput).some((v) => Boolean(v));
      if (hasActiveInput) return;
    }

    const prevForkUp = this.inputState.forkUp;
    const prevForkDown = this.inputState.forkDown;

    this.inputState = { ...this.inputState, ...newInput };

    // Hydraulics sound feedback
    const isMovingForks = this.inputState.forkUp || this.inputState.forkDown;
    const wasMovingForks = prevForkUp || prevForkDown;

    if (isMovingForks && !wasMovingForks) {
      sound.startHydraulics();
    } else if (!isMovingForks && wasMovingForks) {
      sound.stopHydraulics();
    }

    if (newInput.horn) {
      sound.playHorn();
    }
  }

  /**
   * Drops the forklift from the air under gravity using Rapier physics
   */
  public dropForklift(height: number = 3.8, x?: number, z?: number, heading?: number) {
    if (!this.physicsWorld) return;
    const targetX = x ?? this.kinematics.x;
    const targetZ = z ?? this.kinematics.z;
    this.physicsWorld.dropForklift(height, targetX, targetZ, heading);
    this.hasLandedFirstTime = false;
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  /**
   * Sets fork height directly to a preset value
   */
  public setForkHeight(height: number) {
    const prevHeight = this.kinematics.forkHeight;
    this.kinematics.forkHeight = Math.max(
      SIM_CONSTANTS.MIN_FORK_HEIGHT,
      Math.min(SIM_CONSTANTS.MAX_FORK_HEIGHT, height)
    );
    if (this.physicsWorld) {
      this.physicsWorld.updateForkKinematics(
        this.kinematics.forkHeight,
        this.kinematics.forkHeight > prevHeight,
        this.kinematics.forkHeight <= 0.085
      );
    }
    sound.startHydraulics();
    setTimeout(() => sound.stopHydraulics(), 350);
  }

  private handleResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private tick(now: number) {
    this.animationFrameId = requestAnimationFrame(this.tick);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Clamped delta time

    // 1. Advance Timer: Mulai menghitung otomatis sejak level dimuat (playing & intro),
    // dan HANYA berhenti/pause saat fungsi win/lose terpanggil (isDelivered, isFailed, isTimerPaused)
    if (this.gameState === 'playing' || this.gameState === 'intro') {
      if (!this.isTimerPaused && !this.isDelivered && !this.isFailed) {
        this.timeElapsed += dt;
      }
    }

    if (this.physicsWorld) {

      if (this.gameState === 'playing') {

        // 1. Advance fork lifting / lowering from user input
        if (this.inputState.forkUp) {
          this.kinematics.forkHeight = Math.min(
            SIM_CONSTANTS.MAX_FORK_HEIGHT,
            this.kinematics.forkHeight + SIM_CONSTANTS.FORK_SPEED * dt
          );
        } else if (this.inputState.forkDown) {
          this.kinematics.forkHeight = Math.max(
            0.04,
            this.kinematics.forkHeight - SIM_CONSTANTS.FORK_SPEED * dt
          );
        }

        // 2. Apply authentic vehicle movement:
        // Left/Right rotates heading, Forward/Backward drives along current heading!
        this.physicsWorld.applyMovement(
          this.inputState.forward,
          this.inputState.backward,
          this.inputState.steerLeft,
          this.inputState.steerRight,
          this.inputState.brake,
          this.kinematics.forkHeight,
          dt,
          this.inputState.forkUp,
          this.inputState.forkDown
        );

        // 3. Step Rapier physics world forward
        this.physicsWorld.step(dt);

        // Check landing impact sound & camera shake
        const translation = this.physicsWorld.forkliftBody.translation();
        if (!this.hasLandedFirstTime && translation.y <= 0.65) {
          this.hasLandedFirstTime = true;
          sound.playCrateClack();
          this.cameraShakeTrauma = 0.4;
        }

        // Sync kinematics with Rapier physics body
        this.kinematics.x = translation.x;
        this.kinematics.z = translation.z;
        this.kinematics.rotation = this.physicsWorld.getHeading();

        const rawSpeed = this.physicsWorld.getCurrentSpeed();
        const speedKmh = Math.abs(rawSpeed * 3.6);
        this.kinematics.speed = rawSpeed;

        // Rear-Wheel Steering angle animation: Linear Interpolation (Lerp) untuk transisi bertahap dan mulus
        const targetSteer = this.physicsWorld
          ? this.physicsWorld.getRearSteerAngle()
          : (this.inputState.steerLeft ? 0.78 : 0) - (this.inputState.steerRight ? 0.78 : 0);
        const steerLerpT = 1.0 - Math.exp(-16.0 * dt);
        this.kinematics.steerAngle = lerp(this.kinematics.steerAngle, targetSteer, steerLerpT);
        if (Math.abs(targetSteer - this.kinematics.steerAngle) < 0.003) {
          this.kinematics.steerAngle = targetSteer;
        }
        this.kinematics.wheelRotation += (rawSpeed * dt) / SIM_CONSTANTS.WHEEL_RADIUS;

        // Audio update with speed
        sound.updateEngine(speedKmh);

        // SYNC TARGET PALLET 3D MESH DENGAN RAPID PHYSICS RIGIDBODY
        // Tiada sebarang magnet / snap tiruan; posisi mesh 100% dipacu fizik Rapier
        const pTrans = this.physicsWorld.getPalletTranslation();
        const pRot = this.physicsWorld.getPalletRotation();
        if (this.warehouse.targetPalletMesh) {
          this.warehouse.targetPalletMesh.position.set(pTrans.x, pTrans.y, pTrans.z);
          this.warehouse.targetPalletMesh.quaternion.set(pRot.x, pRot.y, pRot.z, pRot.w);
        }

        // DETEKSI TABRAKAN KHUSUS LEVEL 4 (Fragile Cargo):
        // Jika badan forklift atau palet menyentuh rintangan atau menyentuh rak, langsung hentikan permainan
        if (
          this.currentLevel === 4 &&
          this.gameState === 'playing' &&
          !this.isDelivered &&
          !this.isFailed &&
          this.hasLandedFirstTime &&
          this.timeElapsed > 0.25
        ) {
          const hitDetected = this.checkLevel4Collisions(translation, pTrans);
          if (hitDetected) {
            this.triggerLevel4Failure('Kargo Rusak!');
          }
        }

        // Animasikan penunjuk sasaran terapung
        if (this.warehouse.targetMarkerMesh) {
          this.warehouse.targetMarkerMesh.rotation.y += dt * 2.0;
          this.warehouse.targetMarkerMesh.position.y = 1.25 + Math.sin(now * 0.005) * 0.08;
        }

        // Animasikan penunjuk suar Area Pengiriman (Level 1 di lantai atau Level 2 di atas rak)
        if (this.warehouse.dropZoneBeacon && this.warehouse.dropZoneMesh.visible) {
          this.warehouse.dropZoneBeacon.rotation.y += dt * 1.6;
          this.warehouse.dropZoneBeacon.position.y = 1.8 + Math.sin(now * 0.004) * 0.15;
        }
        if (this.warehouse.dropZoneLight && this.warehouse.dropZoneMesh.visible) {
          this.warehouse.dropZoneLight.intensity = 2.4 + Math.sin(now * 0.005) * 0.8;
        }

        if (this.warehouse.dropZoneShelfBeacon && this.warehouse.dropZoneShelfMesh?.visible) {
          this.warehouse.dropZoneShelfBeacon.rotation.y += dt * 1.6;
          this.warehouse.dropZoneShelfBeacon.position.y = 0.95 + Math.sin(now * 0.004) * 0.08;
        }
        if (this.warehouse.dropZoneShelfLight && this.warehouse.dropZoneShelfMesh?.visible) {
          this.warehouse.dropZoneShelfLight.intensity = 2.6 + Math.sin(now * 0.005) * 0.8;
        }

        // Semakan status fizik muatan & penyampaian zon
        const isPalletOnForks = this.handleCargoPhysicsLogic(pTrans, translation, dt);

        // 4. Update visuals & camera
        this.updateForkliftVisuals();
        this.updateCamera(dt);

        // 5. Throttle React HUD state update to ~10Hz
        this.statsThrottleTimer += dt;
        if (this.statsThrottleTimer >= 0.1) {
          this.statsThrottleTimer = 0;
          this.dispatchStats();
        }
      } else if (this.gameState === 'intro') {
        // Intro Sinematik Kamera: Step physics untuk stabilitas & mainkan animasi kamera swooping
        this.physicsWorld.step(dt);
        this.updateForkliftVisuals();

        const pTrans = this.physicsWorld.getPalletTranslation();
        const pRot = this.physicsWorld.getPalletRotation();
        if (this.warehouse.targetPalletMesh) {
          this.warehouse.targetPalletMesh.position.set(pTrans.x, pTrans.y, pTrans.z);
          this.warehouse.targetPalletMesh.quaternion.set(pRot.x, pRot.y, pRot.z, pRot.w);
        }

        // Animasikan suar penunjuk sasaran
        if (this.warehouse.dropZoneBeacon && this.warehouse.dropZoneMesh.visible) {
          this.warehouse.dropZoneBeacon.rotation.y += dt * 1.6;
          this.warehouse.dropZoneBeacon.position.y = 1.8 + Math.sin(now * 0.004) * 0.15;
        }

        this.forklift.beaconLight.intensity = (Math.sin(now * 0.01) + 1) * 0.9;
        this.updateIntroCamera(dt);

        this.statsThrottleTimer += dt;
        if (this.statsThrottleTimer >= 0.1) {
          this.statsThrottleTimer = 0;
          this.dispatchStats();
        }
      } else if (this.gameState === 'title') {
        // Title Screen: 3D Showroom / Diorama Camera menyorot forklift yang sedang parkir statis dari sudut serong depan
        this.physicsWorld.step(dt);
        this.updateForkliftVisuals();

        const pTrans = this.physicsWorld.getPalletTranslation();
        const pRot = this.physicsWorld.getPalletRotation();
        if (this.warehouse.targetPalletMesh) {
          this.warehouse.targetPalletMesh.position.set(pTrans.x, pTrans.y, pTrans.z);
          this.warehouse.targetPalletMesh.quaternion.set(pRot.x, pRot.y, pRot.z, pRot.w);
        }

        // Sudut pandang serong depan (showroom 3/4 front view) dengan mikro-floating halus ala diorama profesional
        const slowT = now * 0.0003;
        const showroomCamX = 3.2 + Math.sin(slowT) * 0.15;
        const showroomCamY = 1.4 + Math.sin(slowT * 0.7) * 0.05;
        const showroomCamZ = 0.8 + Math.cos(slowT * 0.8) * 0.12;
        this.camera.position.set(showroomCamX, showroomCamY, showroomCamZ);
        _cameraTarget.set(-0.35, 1.0, 3.8);
        this.camera.lookAt(_cameraTarget);

        this.forklift.beaconLight.intensity = (Math.sin(now * 0.008) + 1) * 0.8;
      } else {
        // Paused, Gameover, atau Failed:
        // Kekalkan paparan visual statik tanpa memutar orbit kamera menjauh
        this.updateForkliftVisuals();
        const pTrans = this.physicsWorld.getPalletTranslation();
        const pRot = this.physicsWorld.getPalletRotation();
        if (this.warehouse.targetPalletMesh) {
          this.warehouse.targetPalletMesh.position.set(pTrans.x, pTrans.y, pTrans.z);
          this.warehouse.targetPalletMesh.quaternion.set(pRot.x, pRot.y, pRot.z, pRot.w);
        }
      }
    }

    this.renderer.render(this.warehouse.scene, this.camera);
  }

  /**
   * Logik Misi:
   * - Level 1: Mengambil palet kayu dan menurunkannya di Area Pengiriman hijau lantai.
   * - Level 2: Mengambil palet kayu dan menurunkannya dengan aman ke dalam Drop Zone di atas rak tingkat atas (y = 1.36m).
   */
  private handleCargoPhysicsLogic(
    pTrans: { x: number; y: number; z: number },
    _fTrans: { x: number; y: number; z: number },
    _dt: number
  ): boolean {
    this.forklift.beaconLight.intensity = 1.0 + Math.sin(performance.now() * 0.01) * 0.5;

    if (!this.physicsWorld) return false;

    // Palet dianggap diangkat jika berada di atas bilah garpu atau terkunci secara parenting
    const isPalletOnForks = this.physicsWorld.isPalletRestingOnForks();
    const isLocked = this.physicsWorld.isLocked();

    if ((isPalletOnForks || isLocked) && (!this.wasCarriedPrevFrame || (!this.wasLockedPrevFrame && isLocked))) {
      sound.playCrateClack();
    }
    this.wasCarriedPrevFrame = isPalletOnForks;
    this.wasLockedPrevFrame = isLocked;

    // Rekod bahawa pemain telah mula memuat / mengangkat palet kargo
    if (isPalletOnForks || isLocked) {
      this.hasEverCarriedPallet = true;
    }

    // Semakan Syarat Kemenangan (Win Condition Check):
    // Semakan Syarat Kemenangan (Win Condition Check):
    const hasWon = this.checkWinCondition(pTrans);

    if (hasWon) {
      this.isDelivered = true;
      this.isTimerPaused = true; // Otomatis berhenti (paused) tepat pada saat fungsi kemenangan terpicu
      this.deliveredCount = 1;
      const baseScore =
        this.currentLevel === 1
          ? 3000
          : this.currentLevel === 2
          ? 5000
          : this.currentLevel === 3
          ? 7000
          : this.currentLevel === 4
          ? 9000
          : 12000;
      this.score = Math.max(
        1000,
        baseScore - Math.round(this.timeElapsed) * 15
      );
      sound.playDeliverySuccess();

      // Pancarkan data statistik seketika agar waktu di HUD langsung membeku
      this.dispatchStats();

      if (this.onGameOver) {
        setTimeout(() => this.onGameOver?.(), 700);
      }
    }

    return isPalletOnForks;
  }

  /**
   * Semakan Syarat Kemenangan (Win Condition Check):
   * Memeriksa overlap zona Drop Zone, ketinggian bersesuaian mengikut aras platform/lantai,
   * dan status palet yang telah dilepas (detached) secara stabil di dalam zona sasaran.
   */
  public checkWinCondition(pTrans: { x: number; y: number; z: number }): boolean {
    if (!this.physicsWorld) return false;

    const isPalletOnForks = this.physicsWorld.isPalletRestingOnForks();
    const isLocked = this.physicsWorld.isLocked();
    const dropZone = this.warehouse.dropZone;

    // Semakan Syarat Kemenangan Khusus Level 2 (Rack Placement):
    // Fungsi win HANYA boleh terpicu JIKA posisi palet sudah berada di dalam Drop Zone rak atas,
    // DAN status muatan palet sudah sepenuhnya 'dilepas/diturunkan' (detached/unlocked) dari garpu.
    // Jika pemain masih mengunci/mengangkat palet di area hijau, jangan picu layar kemenangan!
    if (this.currentLevel === 2) {
      if (isLocked || isPalletOnForks || this.kinematics.forkHeight > 1.33) {
        return false;
      }

      const inShelfZone =
        Math.abs(pTrans.x - dropZone.x) <= dropZone.width / 2 + 0.20 &&
        Math.abs(pTrans.z - dropZone.z) <= dropZone.depth / 2 + 0.20;

      const onShelfElevation = (pTrans.y >= 1.32 && pTrans.y <= 1.55) || this.physicsWorld.isPalletOnRackShelf();

      const isForkDisengaged =
        this.kinematics.forkHeight <= 1.32 ||
        !this.physicsWorld.isForkUnderPallet(this.kinematics.forkHeight);

      const pLinvel = this.physicsWorld.palletBody.linvel();
      const isPalletStable = Math.abs(pLinvel.y) < 0.25 && Math.hypot(pLinvel.x, pLinvel.z) < 0.35;

      return (
        this.hasEverCarriedPallet &&
        inShelfZone &&
        onShelfElevation &&
        isForkDisengaged &&
        isPalletStable &&
        !this.isDelivered
      );
    }

    // Semakan Kedudukan di dalam Area Pengiriman (Drop Zone Level 1, 3, 4, 5)
    const zoneTolerance = this.currentLevel === 5 ? 0.45 : 0.25;
    const inDropZone =
      Math.abs(pTrans.x - dropZone.x) <= dropZone.width / 2 + zoneTolerance &&
      Math.abs(pTrans.z - dropZone.z) <= dropZone.depth / 2 + zoneTolerance;

    // Semakan Ketinggian Bersesuaian mengikut Misi Level:
    // Level 1 & Level 3 & Level 4: Palet mendarat di lantai (y <= 0.20m)
    // Level 5: Palet mendarat di atas platform akhir / Drop Zone ujung lintasan (y <= 0.35m)
    const isCorrectElevation =
      this.currentLevel === 5
        ? pTrans.y <= 0.35 // Tepat di atas platform akhir Level 5 (y platform = 0.06m)
        : pTrans.y <= 0.20;

    // Palet terlepas / dilepas dari garpu (tidak terkunci / detached dan garpu tidak sedang menampung atau telah diturunkan/dijauhkan)
    const isReleasedFromFork =
      !isLocked &&
      (
        (this.currentLevel === 5 && (!isLocked || !isPalletOnForks || this.kinematics.forkHeight <= 0.14 || pTrans.y > this.kinematics.forkHeight + 0.02)) ||
        (this.currentLevel !== 5 && (this.kinematics.forkHeight <= 0.09 || !isPalletOnForks || pTrans.y > this.kinematics.forkHeight + 0.03))
      );

    // Semakan kestabilan palet (palet telah mendarat dan pegun di atas permukaan)
    const pLinvel = this.physicsWorld.palletBody.linvel();
    const isPalletStable = Math.abs(pLinvel.y) < 0.40;

    return (
      this.hasEverCarriedPallet &&
      inDropZone &&
      isCorrectElevation &&
      isReleasedFromFork &&
      isPalletStable &&
      !this.isDelivered
    );
  }

  /**
   * Hentikan permainan serta-merta apabila pelanggaran dikesan pada Level 4 (Fragile Cargo)
   */
  private triggerLevel4Failure(incidentDesc: string = 'Kargo Rusak!') {
    if (this.isFailed) return;
    this.isFailed = true;
    this.isTimerPaused = true; // Otomatis berhenti (paused) tepat saat kegagalan terpicu
    this.gameState = 'failed';
    this.lockInput();
    this.pausePhysics();
    sound.stopEngine();
    sound.stopHydraulics();
    sound.playCrash();
    this.cameraShakeTrauma = 0.8;

    // Hentikan serta-merta sebarang kelajuan sisa momentum forklift & palet (Langkah 1)
    if (this.physicsWorld) {
      this.physicsWorld.resetAllVelocities();
    }

    this.dispatchStats();

    if (this.onGameFailed) {
      this.onGameFailed(incidentDesc);
    }
  }

  /**
   * Sistem Deteksi Tabrakan (Collision) Khusus Level 4:
   * Mengesan jika badan forklift atau palet menyentuh rintangan (tong/kerucut/kotak) atau rak gudang.
   */
  private checkLevel4Collisions(
    fTrans: { x: number; y: number; z: number },
    pTrans: { x: number; y: number; z: number }
  ): boolean {
    const heading = this.physicsWorld?.getHeading() ?? this.kinematics.rotation;
    const fwdX = -Math.sin(heading);
    const fwdZ = -Math.cos(heading);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);

    // 1. Rintangan Berbentuk Silinder (Tong Drum Industri: r=0.35m & Kerucut Lalu Lintas: r=0.18m)
    // SAMA PERSIS dengan ukuran visual 3D (tidak boleh melebar / tiada hitbox membengkak)
    const circleObstacles = [
      // Row 1 (z = -11.0):
      { x: -1.8, z: -11.0, r: 0.35 },
      { x: -0.6, z: -11.0, r: 0.35 },
      { x: 0.4, z: -11.0, r: 0.35 },
      { x: 1.1, z: -11.0, r: 0.18 },
      { x: 1.1, z: -10.2, r: 0.18 },
      // Row 2 (z = -3.5):
      { x: -1.1, z: -3.5, r: 0.18 },
      { x: -1.1, z: -2.7, r: 0.18 },
      { x: -0.4, z: -3.5, r: 0.35 },
      { x: 0.6, z: -3.5, r: 0.35 },
      { x: 1.8, z: -3.5, r: 0.35 },
      // Row 3 (z = 4.0):
      { x: -1.8, z: 4.0, r: 0.35 },
      { x: -0.6, z: 4.0, r: 0.35 },
      { x: 0.4, z: 4.0, r: 0.35 },
      { x: 1.1, z: 4.0, r: 0.18 },
      { x: 1.1, z: 4.8, r: 0.18 },
      // Row 4 (z = 11.5):
      { x: -1.1, z: 11.5, r: 0.18 },
      { x: -1.1, z: 12.3, r: 0.18 },
      { x: -0.4, z: 11.5, r: 0.35 },
      { x: 0.6, z: 11.5, r: 0.35 },
      { x: 1.8, z: 11.5, r: 0.35 },
      // Kerucut sempadan selekoh luar laluan (r=0.18m):
      { x: 5.8, z: -7.5, r: 0.18 },
      { x: -5.8, z: 0.0, r: 0.18 },
      { x: 5.8, z: 7.5, r: 0.18 },
      { x: -5.8, z: 15.0, r: 0.18 },
    ];

    // 2. Rintangan Berbentuk Kotak (Dimensi tepat sama visual)
    const boxObstacles = [
      // Row 1 Crates (z = -11.0):
      { minX: -5.5, maxX: -4.1, minZ: -11.6, maxZ: -10.4 },
      { minX: -3.8, maxX: -2.6, minZ: -11.6, maxZ: -10.4 },
      // Row 2 Crates (z = -3.5):
      { minX: 2.6, maxX: 3.8, minZ: -4.1, maxZ: -2.9 },
      { minX: 4.1, maxX: 5.5, minZ: -4.1, maxZ: -2.9 },
      // Row 3 Crates (z = 4.0):
      { minX: -5.5, maxX: -4.1, minZ: 3.4, maxZ: 4.6 },
      { minX: -3.8, maxX: -2.6, minZ: 3.4, maxZ: 4.6 },
      // Row 4 Crates (z = 11.5):
      { minX: 2.6, maxX: 3.8, minZ: 10.9, maxZ: 12.1 },
      { minX: 4.1, maxX: 5.5, minZ: 10.9, maxZ: 12.1 },

      // RAK GUDANG (Pallet Racking System):
      // Perimeter racks:
      { minX: -19.0, maxX: -17.0, minZ: -12.3, maxZ: 4.3 },
      { minX: -19.0, maxX: -17.0, minZ: 9.7, maxZ: 22.3 },
      { minX: 17.0, maxX: 19.0, minZ: -12.3, maxZ: 4.3 },
      { minX: 17.0, maxX: 19.0, minZ: 9.7, maxZ: 22.3 },
      // Rak bertingkat di (-8.0, -15.0):
      { minX: -9.5, maxX: -6.5, minZ: -15.9, maxZ: -14.1 },
      // Tiang gudang (Pillars):
      { minX: -12.8, maxX: -11.2, minZ: -10.8, maxZ: -9.2 },
      { minX: -12.8, maxX: -11.2, minZ: 9.2, maxZ: 10.8 },
      { minX: 11.2, maxX: 12.8, minZ: -10.8, maxZ: -9.2 },
      { minX: 11.2, maxX: 12.8, minZ: 9.2, maxZ: 10.8 },
    ];

    // Helper: Titik (px, pz) melanggar sebarang rintangan / rak / dinding
    const testPointCollision = (px: number, pz: number): boolean => {
      // Dinding luar gudang
      if (px < -23.5 || px > 23.5 || pz < -28.5 || pz > 28.5) return true;

      // Lingkaran tong / kerucut
      for (let i = 0; i < circleObstacles.length; i++) {
        const c = circleObstacles[i];
        const dx = px - c.x;
        const dz = pz - c.z;
        if (dx * dx + dz * dz < c.r * c.r) return true;
      }

      // Kotak kargo / rak gudang / tiang
      for (let i = 0; i < boxObstacles.length; i++) {
        const b = boxObstacles[i];
        if (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ) return true;
      }

      return false;
    };

    // A. UJI SAMPEL BADAN FORKLIFT (Casis, Kabin, Pengimbang Belakang, Tiang, & Bilah Garpu)
    const chassisLongOffsets = [-1.15, -0.85, -0.5, -0.15, 0.2, 0.55, 0.9, 1.15];
    const chassisLatOffsets = [-0.62, -0.31, 0, 0.31, 0.62];
    for (let i = 0; i < chassisLongOffsets.length; i++) {
      const s = chassisLongOffsets[i];
      for (let j = 0; j < chassisLatOffsets.length; j++) {
        const w = chassisLatOffsets[j];
        const px = fTrans.x + fwdX * s + rightX * w;
        const pz = fTrans.z + fwdZ * s + rightZ * w;
        if (testPointCollision(px, pz)) return true;
      }
    }

    // Titik bilah garpu hadapan
    const forkLongOffsets = [1.4, 1.75, 2.1, 2.38];
    const forkLatOffsets = [-0.38, 0, 0.38];
    for (let i = 0; i < forkLongOffsets.length; i++) {
      const s = forkLongOffsets[i];
      for (let j = 0; j < forkLatOffsets.length; j++) {
        const w = forkLatOffsets[j];
        const px = fTrans.x + fwdX * s + rightX * w;
        const pz = fTrans.z + fwdZ * s + rightZ * w;
        if (testPointCollision(px, pz)) return true;
      }
    }

    // B. UJI SAMPEL PALET KARGO (1.2m x 1.0m)
    const palletOffsetsX = [-0.55, -0.27, 0, 0.27, 0.55];
    const palletOffsetsZ = [-0.45, -0.22, 0, 0.22, 0.45];
    for (let i = 0; i < palletOffsetsX.length; i++) {
      const dx = palletOffsetsX[i];
      for (let j = 0; j < palletOffsetsZ.length; j++) {
        const dz = palletOffsetsZ[j];
        const px = pTrans.x + dx;
        const pz = pTrans.z + dz;
        if (testPointCollision(px, pz)) return true;
      }
    }

    // Uji jarak pusat palet kargo dengan lingkaran & kotak
    for (let i = 0; i < circleObstacles.length; i++) {
      const c = circleObstacles[i];
      const dist = Math.hypot(pTrans.x - c.x, pTrans.z - c.z);
      if (dist < c.r + 0.52) return true;
    }

    for (let i = 0; i < boxObstacles.length; i++) {
      const b = boxObstacles[i];
      const clampedX = Math.max(b.minX, Math.min(b.maxX, pTrans.x));
      const clampedZ = Math.max(b.minZ, Math.min(b.maxZ, pTrans.z));
      if (Math.hypot(pTrans.x - clampedX, pTrans.z - clampedZ) < 0.50) return true;
    }

    return false;
  }

  private updateForkliftVisuals() {
    let yPos = 0.2;
    if (this.physicsWorld) {
      const translation = this.physicsWorld.forkliftBody.translation();
      this.forklift.group.position.set(translation.x, translation.y - 0.45, translation.z);

      // Hitung sudut kemiringan lereng lintasan jembatan berbukit Level 5
      let localPitch = 0;
      if (
        this.currentLevel === 5 &&
        translation.z >= -27.0 &&
        translation.z <= -20.0
      ) {
        const info = getLevel5TrackHeight(translation.x);
        const heading = this.physicsWorld.getHeading();
        const forwardX = -Math.sin(heading);
        // Tanjakan/Turunan kurva mulus: kemiringan badan forklift = arctan(forwardX * slope)
        localPitch = Math.atan(forwardX * info.slope);
      }
      this.currentPitch = localPitch;

      this.forklift.group.rotation.order = 'YXZ';
      this.forklift.group.rotation.set(localPitch, this.physicsWorld.getHeading(), 0);

      // Jika palet sedang terkunci, selaraskan rotasi palet dengan orientasi forklift (termasuk kemiringan di tanjakan)
      if (this.physicsWorld.isLocked() && this.warehouse.targetPalletMesh) {
        this.warehouse.targetPalletMesh.quaternion.copy(this.forklift.group.quaternion);
      }
    } else {
      this.forklift.group.position.set(this.kinematics.x, yPos, this.kinematics.z);
      this.forklift.group.rotation.set(0, this.kinematics.rotation, 0);
      this.currentPitch = 0;
    }

    // Forks vertical translation along mast
    this.forklift.forksCarriage.position.y = this.kinematics.forkHeight;

    // Realisme Kemudi: Roda Belakang (Rear-Wheel Steering)
    // Roda belakang mengaplikasikan sudut steering (Rear-Wheel Steering), bukan roda depan.
    this.forklift.leftRearWheel.rotation.y = this.kinematics.steerAngle;
    this.forklift.rightRearWheel.rotation.y = this.kinematics.steerAngle;

    // Roda depan TIDAK berbelok (tetap lurus sejajar casis kendaraan, hanya berputar maju/mundur)
    this.forklift.leftFrontWheel.rotation.y = 0;
    this.forklift.rightFrontWheel.rotation.y = 0;

    // Putaran roda menggelinding (rolling)
    this.forklift.leftFrontWheel.rotation.x = this.kinematics.wheelRotation;
    this.forklift.rightFrontWheel.rotation.x = this.kinematics.wheelRotation;
    if (this.forklift.leftRearWheel.children[0]) {
      this.forklift.leftRearWheel.children[0].rotation.x = this.kinematics.wheelRotation;
    }
    if (this.forklift.rightRearWheel.children[0]) {
      this.forklift.rightRearWheel.children[0].rotation.x = this.kinematics.wheelRotation;
    }
  }

  private updateCamera(dt: number) {
    const k = 7.0; // Exponential damping factor
    const alpha = 1 - Math.exp(-k * dt);

    // Damping halus untuk respon pitch kamera yang responsif terhadap gravitasi dan sudut kemiringan
    this.smoothedPitch = THREE.MathUtils.damp(this.smoothedPitch || 0, this.currentPitch, 5.5, dt);

    // True forward vector for camera framing
    _forward.set(-Math.sin(this.kinematics.rotation), 0, -Math.cos(this.kinematics.rotation));

    if (this.cameraMode === 'chase') {
      // Kamera Orang Ketiga (Third-Person Camera) di atas dan di belakang forklift
      const distBehind = 7.5;
      const heightAbove = 4.8;

      const currentY = this.physicsWorld
        ? this.physicsWorld.forkliftBody.translation().y
        : 0.6;

      // Respon Dinamis Pitch Kamera (Sensasi Gravitasi & Kemiringan Tanjakan / Turunan):
      // Saat menanjak (smoothedPitch > 0): kamera merendah di belakang & melongok ke atas menghadap puncak jembatan
      // Saat menurun (smoothedPitch < 0): kamera meninggi di belakang & menunduk curam menghadap turunan lereng
      const pitchOffsetCamY = -Math.sin(this.smoothedPitch) * 2.4;
      const pitchOffsetTargetY = Math.sin(this.smoothedPitch) * 6.2;

      _desiredCamPos.set(
        this.kinematics.x - _forward.x * distBehind,
        currentY + heightAbove + pitchOffsetCamY,
        this.kinematics.z - _forward.z * distBehind
      );

      // Camera shake decay
      if (this.cameraShakeTrauma > 0) {
        const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.3;
        _desiredCamPos.x += (Math.random() - 0.5) * shake;
        _desiredCamPos.y += (Math.random() - 0.5) * shake;
        this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.0);
      }

      this.camera.position.lerp(_desiredCamPos, alpha);

      // Titik sasaran fokus: ikut condong dinamis mengikuti derajat kemiringan tanjakan/turunan
      _cameraTarget.set(
        this.kinematics.x + _forward.x * 2.8,
        currentY + 0.45 + pitchOffsetTargetY,
        this.kinematics.z + _forward.z * 2.8
      );
      this.camera.lookAt(_cameraTarget);
    } else if (this.cameraMode === 'overhead') {
      _desiredCamPos.set(this.kinematics.x, 22, this.kinematics.z + 14);
      this.camera.position.lerp(_desiredCamPos, alpha);
      _cameraTarget.set(this.kinematics.x, 0, this.kinematics.z);
      this.camera.lookAt(_cameraTarget);
    } else if (this.cameraMode === 'driver') {
      const currentY = this.physicsWorld
        ? this.physicsWorld.forkliftBody.translation().y
        : 0.6;
      _desiredCamPos.set(
        this.kinematics.x + _forward.x * 0.1,
        currentY + 1.2,
        this.kinematics.z + _forward.z * 0.1
      );
      this.camera.position.copy(_desiredCamPos);

      // Pandangan kokpit pengemudi langsung menatap dinamis ke arah kemiringan tanjakan atau turunan
      const lookDist = 12.0;
      const pitchLookY = Math.sin(this.smoothedPitch) * lookDist;
      _cameraTarget.set(
        this.kinematics.x + _forward.x * lookDist,
        currentY + 1.0 + pitchLookY,
        this.kinematics.z + _forward.z * lookDist
      );
      this.camera.lookAt(_cameraTarget);
    }
  }

  /**
   * Animasi Kamera Sinematik Intro ala 'Need for Speed':
   * Memulai posisi kamera dari sudut dramatis di lantai depan forklift menyorot ke atas,
   * lalu secara mulus (smooth interpolation lerp & quadratic bezier arc) terbang/memutar ke posisi
   * default Third Person (belakang forklift) dalam durasi 2-3 detik (2.5 detik).
   */
  private updateIntroCamera(dt: number) {
    this.introElapsed += dt;
    const progress = Math.min(1, this.introElapsed / this.introDuration);

    // Easing cubic yang sangat mulus (easeInOutCubic)
    const t =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const heading = this.physicsWorld?.getHeading() ?? this.kinematics.rotation;
    _forward.set(-Math.sin(heading), 0, -Math.cos(heading));
    const right = new THREE.Vector3(-_forward.z, 0, _forward.x);

    const forkPos = this.physicsWorld
      ? this.physicsWorld.forkliftBody.translation()
      : { x: this.kinematics.x, y: 0.55, z: this.kinematics.z };

    // 1. Posisi Mulai (t = 0): Di lantai depan forklift menyorot ke atas secara dramatis
    const startCamPos = new THREE.Vector3(
      forkPos.x + _forward.x * 3.6 + right.x * 1.3,
      forkPos.y - 0.22,
      forkPos.z + _forward.z * 3.6 + right.z * 1.3
    );
    const startTarget = new THREE.Vector3(
      forkPos.x,
      forkPos.y + 1.35,
      forkPos.z
    );

    // 2. Titik Kontrol Lengkungan Bezier di Samping Forklift (mencegah kamera tembus/menabrak bodi)
    const midCamPos = new THREE.Vector3(
      forkPos.x + right.x * 6.5,
      forkPos.y + 2.6,
      forkPos.z + right.z * 6.5
    );

    // 3. Posisi Akhir (t = 1): Third Person default di belakang forklift
    const distBehind = 7.5;
    const heightAbove = 4.8;
    const endCamPos = new THREE.Vector3(
      forkPos.x - _forward.x * distBehind,
      forkPos.y + heightAbove,
      forkPos.z - _forward.z * distBehind
    );
    const endTarget = new THREE.Vector3(
      forkPos.x + _forward.x * 2.8,
      forkPos.y + 0.45,
      forkPos.z + _forward.z * 2.8
    );

    // Interpolasi kurva Quadratic Bezier: B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
    const invT = 1 - t;
    const currentCamX =
      invT * invT * startCamPos.x +
      2 * invT * t * midCamPos.x +
      t * t * endCamPos.x;
    const currentCamY =
      invT * invT * startCamPos.y +
      2 * invT * t * midCamPos.y +
      t * t * endCamPos.y;
    const currentCamZ =
      invT * invT * startCamPos.z +
      2 * invT * t * midCamPos.z +
      t * t * endCamPos.z;

    this.camera.position.set(currentCamX, currentCamY, currentCamZ);

    // Smooth lerp pada titik fokus tatapan kamera (LookAt Target)
    _cameraTarget.lerpVectors(startTarget, endTarget, t);
    this.camera.lookAt(_cameraTarget);

    if (progress >= 1) {
      this.isIntroActive = false;
      this.gameState = 'playing';
      this.isTimerPaused = false;
      this.camera.position.copy(endCamPos);
      this.camera.lookAt(endTarget);
      const cb = this.onIntroCompleteCallback;
      this.onIntroCompleteCallback = undefined;
      cb?.();
    }
  }

  /**
   * Mulai Animasi Kamera Sinematik Intro
   */
  public startCameraIntro(onComplete?: () => void) {
    this.isIntroActive = true;
    this.introElapsed = 0;
    this.gameState = 'intro';
    this.onIntroCompleteCallback = onComplete;
    this.isTimerPaused = false; // Timer aktif menghitung otomatis sejak level dimuat
    this.unlockInput();
    this.resetInputs();
    sound.startEngine();
    this.updateIntroCamera(0);
  }

  /**
   * Lewati animasi intro seketika (Skip intro)
   */
  public skipCameraIntro() {
    if (!this.isIntroActive && this.gameState !== 'intro') return;
    this.isIntroActive = false;
    this.introElapsed = this.introDuration;
    this.gameState = 'playing';
    this.isTimerPaused = false;
    this.resetCamera();
    const cb = this.onIntroCompleteCallback;
    this.onIntroCompleteCallback = undefined;
    cb?.();
  }

  /**
   * Reset status kendali input secara menyeluruh (Clean Reset)
   * Memastikan tiada kekunci stereng atau brek tersekat (freeze)
   */
  public resetInputs() {
    this.inputState = {
      forward: false,
      backward: false,
      steerLeft: false,
      steerRight: false,
      forkUp: false,
      forkDown: false,
      brake: false,
      horn: false,
    };
    if (this.physicsWorld) {
      this.physicsWorld.resetControls();
    }
  }

  /**
   * Mengembalikan kedudukan dan fokus sasaran kamera secara serta-merta tanpa lag lerp
   */
  public resetCamera() {
    const heading = this.physicsWorld?.getHeading() ?? this.kinematics.rotation;
    _forward.set(-Math.sin(heading), 0, -Math.cos(heading));
    const currentY = this.physicsWorld
      ? this.physicsWorld.forkliftBody.translation().y
      : 0.6;

    if (this.cameraMode === 'chase') {
      const distBehind = 7.5;
      const heightAbove = 4.8;
      this.camera.position.set(
        this.kinematics.x - _forward.x * distBehind,
        currentY + heightAbove,
        this.kinematics.z - _forward.z * distBehind
      );
      _cameraTarget.set(
        this.kinematics.x + _forward.x * 2.8,
        currentY + 0.45,
        this.kinematics.z + _forward.z * 2.8
      );
      this.camera.lookAt(_cameraTarget);
    } else if (this.cameraMode === 'overhead') {
      this.camera.position.set(this.kinematics.x, 22, this.kinematics.z + 14);
      _cameraTarget.set(this.kinematics.x, 0, this.kinematics.z);
      this.camera.lookAt(_cameraTarget);
    } else if (this.cameraMode === 'driver') {
      this.camera.position.set(
        this.kinematics.x + _forward.x * 0.1,
        currentY + 1.2,
        this.kinematics.z + _forward.z * 0.1
      );
      _cameraTarget.set(
        this.kinematics.x + _forward.x * 12,
        currentY + 1.0,
        this.kinematics.z + _forward.z * 12
      );
      this.camera.lookAt(_cameraTarget);
    }
    this.cameraShakeTrauma = 0;
    this.smoothedPitch = 0;
  }

  /**
   * Reset status palet kargo: melepaskan sepenuhnya dari bilah garpu,
   * menetapkan semula jenis Dynamic, dan menyelaraskan posisi mesh 3D seketika itu juga.
   */
  public resetPallet() {
    let px = 0;
    let py = 0.01;
    let pz = -2.5;
    let rotY = 0;
    if (this.currentLevel === 3) {
      px = 6.0;
      pz = 16.0;
    } else if (this.currentLevel === 4) {
      px = 0.0;
      pz = -14.0;
    } else if (this.currentLevel === 5) {
      // Level 5: Palet sasaran di awal lintasan pada lantai utama gudang di (12.0, 0.01, -23.5)
      // Menghadap arah hadap forklift (-X) sebelum tanjakan kurva naik (X = 7.0 ke -3.0)
      px = 12.0;
      pz = -23.5;
      rotY = Math.PI / 2;
    }

    if (this.physicsWorld) {
      this.physicsWorld.resetPallet(px, py, pz, rotY);
    }

    if (this.warehouse.targetPalletMesh) {
      this.warehouse.targetPalletMesh.position.set(px, py, pz);
      const halfA = rotY / 2;
      this.warehouse.targetPalletMesh.quaternion.set(0, Math.sin(halfA), 0, Math.cos(halfA));
    }

    this.loadedCargoId = null;
    this.wasCarriedPrevFrame = false;
    this.wasLockedPrevFrame = false;
    this.hasEverCarriedPallet = false;
  }

  /**
   * Clean reset menyeluruh: Forklift, Kargo, Kawalan Kendali, dan Kamera
   * Menepati 3 langkah wajib: kecepatan 0, physics unpause, dan input unlocked
   */
  public resetForklift() {
    this.unlockInput();
    this.resetInputs();
    this.unpausePhysics();

    this.setLinearVelocity('both', 0, 0, 0);
    this.setAngularVelocity('both', 0, 0, 0);
    if (this.physicsWorld) {
      this.physicsWorld.resetAllVelocities();
    }

    this.kinematics.speed = 0;
    this.kinematics.steerAngle = 0;
    this.kinematics.forkHeight = 0.04;
    this.kinematics.wheelRotation = 0;
    this.loadedCargoId = null;
    this.isDelivered = false;
    this.isFailed = false;
    this.isTimerPaused = false;
    this.gameState = 'playing';
    this.hasEverCarriedPallet = false;
    this.wasCarriedPrevFrame = false;
    this.wasLockedPrevFrame = false;
    this.score = 0;
    this.deliveredCount = 0;
    this.timeElapsed = 0; // Waktu di-reset ke 0 saat pemain menekan Mulai Ulang atau pindah level
    this.currentPitch = 0;
    this.smoothedPitch = 0;

    if (this.currentLevel === 3) {
      // Level 3: Forklift di-spawn pada (6.0, 0.55, 21.0) menghadap tepat ke -Z (heading 0) terus ke arah palet di (6.0, 0.01, 16.0)
      this.kinematics.x = 6.0;
      this.kinematics.z = 21.0;
      this.kinematics.rotation = 0;
      this.dropForklift(0.55, 6.0, 21.0, 0);
    } else if (this.currentLevel === 4) {
      // Level 4: Forklift di-spawn pada (0.0, 0.55, -17.5) menghadap ke +Z (heading Math.PI) terus ke arah palet di (0.0, 0.01, -14.0)
      this.kinematics.x = 0.0;
      this.kinematics.z = -17.5;
      this.kinematics.rotation = Math.PI;
      this.dropForklift(0.55, 0.0, -17.5, Math.PI);
    } else if (this.currentLevel === 5) {
      // Level 5: Forklift bermula pada lantai utama di awal lintasan pada (17.5, 0.55, -23.5) menghadap ke -X (heading Math.PI / 2)
      // Menghadap tepat ke palet di (12.0, 0.01, -23.5) sebelum menaiki tanjakan jembatan berbukit (X = 7.0 ke -3.0)
      this.kinematics.x = 17.5;
      this.kinematics.z = -23.5;
      this.kinematics.rotation = Math.PI / 2;
      this.dropForklift(0.55, 17.5, -23.5, Math.PI / 2);
    } else {
      // Level 1 & 2: Forklift bermula pada (0, 0.55, 4) menghadap -Z
      this.kinematics.x = 0;
      this.kinematics.z = 4.0;
      this.kinematics.rotation = 0;
      this.dropForklift(0.55, 0, 4.0, 0);
    }

    this.hasLandedFirstTime = true;
    this.resetPallet();

    if (this.physicsWorld) {
      this.physicsWorld.setLevel(this.currentLevel);
      this.physicsWorld.updateForkKinematics(0.04, false, true);
      this.physicsWorld.resetAllVelocities();
      this.physicsWorld.setLinearVelocity('both', 0, 0, 0);
      this.physicsWorld.setAngularVelocity('both', 0, 0, 0);
      this.physicsWorld.unpause();
    }

    this.updateForkliftVisuals();
    this.resetCamera();
    this.dispatchStats();
  }

  /**
   * Pancarkan data statistik terkini ke React HUD
   */
  public dispatchStats() {
    if (!this.onStatsUpdate) return;
    const rawSpeed = this.physicsWorld ? this.physicsWorld.getCurrentSpeed() : this.kinematics.speed;
    const speedKmh = Math.abs(rawSpeed * 3.6);
    const isPalletOnForks = this.physicsWorld ? this.physicsWorld.isPalletRestingOnForks() : false;
    const isLocked = this.physicsWorld ? this.physicsWorld.isLocked() : false;

    this.onStatsUpdate({
      speedKmh: Math.round(speedKmh),
      forkHeightM: parseFloat(this.kinematics.forkHeight.toFixed(2)),
      deliveredCount: this.deliveredCount,
      totalCount: 1, // 1 Palet Sasaran Utama
      score: this.score,
      timeElapsed: Math.floor(this.timeElapsed),
      cargoLoaded: isPalletOnForks,
      cargoLocked: isLocked,
      level: this.currentLevel,
    });
  }

  /**
   * Mengatur tahap permainan (Level 1, Level 2, Level 3, Level 4, atau Level 5)
   * Mengalihkan posisi Drop Zone dan mereset posisi forklift & palet
   */
  public setLevel(level: 1 | 2 | 3 | 4 | 5) {
    this.currentLevel = level;
    this.warehouse.setDropZoneLevel(level);
    this.resetForklift();
    this.unpausePhysics();
    this.unlockInput();
    this.isTimerPaused = false;
    this.dispatchStats();
  }

  public getLevel(): 1 | 2 | 3 | 4 | 5 {
    return this.currentLevel;
  }

  public getTimeElapsed(): number {
    return this.timeElapsed;
  }

  public setTimeElapsed(val: number) {
    this.timeElapsed = Math.max(0, val);
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);
    this.warehouse.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
