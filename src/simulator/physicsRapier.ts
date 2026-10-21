import RAPIER from '@dimforge/rapier3d-compat';

let rapierInitialized = false;
export async function initRapier(): Promise<void> {
  if (!rapierInitialized) {
    await RAPIER.init();
    rapierInitialized = true;
  }
}

export interface TrackHeightInfo {
  y: number;
  slope: number; // dy/dx
  segment: 'flat_start' | 'ramp_up' | 'bridge' | 'ramp_down' | 'flat_end';
}

/**
 * Fungsi Matematika Kontur Lintasan Level 5 (Simulasi Jembatan Berbukit / Flyover):
 * - Rute Berkesinambungan: Naik (7.0 -> -3.0) -> Platform Datar (-3.0 -> -9.0) -> Turun (-9.0 -> -19.0)
 * - Transisi Kurva Halus (Smooth Curve S-Shape Easing):
 *   Derivatif (kemiringan sudut) di titik awal, puncak, dan akhir bernilai tepat 0.0 derajat,
 *   sehingga roda forklift meluncur naik dan turun tanpa jeda, tanpa sudut tajam, dan tanpa tersangkut.
 */
export function getLevel5TrackHeight(x: number): TrackHeightInfo {
  const H = 1.25; // Ketinggian jembatan layang (1.25 meter)
  if (x >= 7.0) {
    return { y: 0.0, slope: 0, segment: 'flat_start' };
  } else if (x > -3.0) {
    // 1. TANJAKAN NAIK (Smooth S-curve dari X = 7.0 hingga X = -3.0, panjang 10.0m)
    const u = (7.0 - x) / 10.0;
    const y = (H * (1 - Math.cos(Math.PI * u))) / 2;
    const slope = -0.1 * ((H * Math.PI) / 2) * Math.sin(Math.PI * u);
    return { y, slope, segment: 'ramp_up' };
  } else if (x >= -9.0) {
    // 2. PLATFORM JEMBATAN DATAR (Elevasi tetap y = 1.25m dari X = -3.0 hingga X = -9.0, panjang 6.0m)
    return { y: H, slope: 0, segment: 'bridge' };
  } else if (x > -19.0) {
    // 3. TURUNAN (Smooth S-curve dari X = -9.0 hingga X = -19.0, panjang 10.0m)
    const v = (-9.0 - x) / 10.0;
    const y = (H * (1 + Math.cos(Math.PI * v))) / 2;
    const slope = 0.1 * ((H * Math.PI) / 2) * Math.sin(Math.PI * v);
    return { y, slope, segment: 'ramp_down' };
  } else {
    // 4. LANTAI DASAR AKHIR (X <= -19.0 menuju Drop Zone di X = -21.5)
    return { y: 0.0, slope: 0, segment: 'flat_end' };
  }
}

/**
 * Flush Ramp Base Surface Calculator:
 * Menghasilkan ketinggian permukaan dek tanjakan & tinggi bendul pengaman.
 * Pangkal awal tanjakan ditanam sedikit menembus ke bawah lantai (y < 0) pada x in [7.0, 8.5]
 * dan ujung turunan ditanam pada x in [-19.0, -20.5], sehingga roda forklift melindas bidang miring
 * tanpa ada sedikit pun step vertikal atau tonjolan di titik temu lantai.
 */
export function getLevel5RampSurfaceHeight(x: number): { y: number; curbH: number } {
  const H = 1.25;
  if (x >= 7.0) {
    // Ditanam sedikit menembus ke bawah lantai utama (y < 0)
    const buryY = (7.0 - x) * 0.08;
    return { y: Math.max(-0.25, buryY), curbH: 0.0 };
  } else if (x > -3.0) {
    const u = (7.0 - x) / 10.0;
    const y = (H * (1 - Math.cos(Math.PI * u))) / 2;
    const curbFactor = Math.min(1.0, (7.0 - x) / 1.0);
    return { y, curbH: 0.22 * curbFactor };
  } else if (x >= -9.0) {
    return { y: H, curbH: 0.22 };
  } else if (x > -19.0) {
    const v = (-9.0 - x) / 10.0;
    const y = (H * (1 + Math.cos(Math.PI * v))) / 2;
    const curbFactor = Math.min(1.0, (x - (-19.0)) / 1.0);
    return { y, curbH: 0.22 * curbFactor };
  } else {
    // Ditanam sedikit menembus ke bawah lantai di ujung turunan (y < 0)
    const buryY = (-19.0 - x) * (-0.08);
    return { y: Math.max(-0.25, buryY), curbH: 0.0 };
  }
}

/**
 * Fungsi Matematika Lerp (Linear Interpolation)
 * Memastikan pergerakan target velocity gas dan sudut steering berubah secara bertahap dan smooth.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.min(1, Math.max(0, t));
}

export class PhysicsRapierWorld {
  public world: RAPIER.World;
  public forkliftBody: RAPIER.RigidBody;
  public forkBody: RAPIER.RigidBody;
  public palletBody: RAPIER.RigidBody;
  public heading: number = 0; // 0 = menghadap ke -Z (arah hadap mast & garpu)
  public isReady: boolean = false;
  public isPaused: boolean = false;

  private currentSpeed: number = 0;
  private angularVelocity: number = 0; // Halaju sudut putaran paksi-Y (rad/s)
  private readonly MAX_FORWARD_SPEED = 6.5; // m/s (~23 km/j)
  private readonly MAX_REVERSE_SPEED = 6.5; // m/s (~23 km/j) - Tenaga mundur sama kuat dengan saat maju
  private readonly ACCELERATION = 22.0;      // m/s^2 (Gaya dorong / motor torque kuat dan responsif)
  private readonly DECELERATION = 7.0;       // m/s^2 (rolling resistance)
  private readonly BRAKE_DECEL = 28.0;       // m/s^2 (gaya henti brek pantas)

  // Kawalan Putaran Responsif Instan Tanpa Delay (Instant High-Torque Steering)
  // Responsif instan saat A/D ditekan tanpa delay / inersia berat pada sumbu Y
  private readonly MAX_TURN_SPEED = 2.40;      // rad/s (~138 deg/s kemudi lincah)
  private readonly ANGULAR_ACCEL = 75.0;       // rad/s^2 (kemudi langsung berbelok instan saat tombol A/D ditekan)
  private readonly ANGULAR_DAMPING = 40.0;     // s^-1 (berhenti berbelok seketika saat tombol dilepas)

  // Realisme Kemudi Roda Belakang (Rear-Wheel Steering)
  private rearSteerAngle: number = 0;          // Sudut belok aktual roda belakang (rad)
  private readonly MAX_REAR_STEER = 0.78;      // ~45 darjah sudut kemudi maksimum roda belakang
  private readonly FRONT_AXLE_OFFSET = 0.65;   // Gandar depan tetap (Fixed Drive Axle) L_f = 0.65m di depan CoM
  private readonly REAR_AXLE_OFFSET = 0.88;    // Gandar belakang berbelok (Steering Axle) L_r = 0.88m di belakang CoM

  public getRearSteerAngle(): number {
    return this.rearSteerAngle;
  }

  // Mekanik Penguncian Muatan (Temporary Parenting & Rigid Attachment)
  private isCargoLocked: boolean = false;
  private lockOffset: { x: number; y: number; z: number } = { x: 0, y: 0.02, z: 0 };
  private lockRelativeYaw: number = 0;
  private currentForkHeight: number = 0.04;

  // Koleksi Collider khusus mengikut tahap (mencegah tembok gaib di tahap lain)
  private level3Colliders: RAPIER.Collider[] = [];
  private level4Colliders: RAPIER.Collider[] = [];
  private level5Colliders: RAPIER.Collider[] = [];
  public currentLevel: 1 | 2 | 3 | 4 | 5 = 1;

  // Konfigurasi Rak Gudang 2 Tingkat (Level 2 Pallet Rack)
  // Diletakkan di kawasan luas (x: -8.0, z: -15.0) dengan bukaan depan menghadap +Z
  public readonly rackConfig = {
    x: -8.0,
    z: -15.0,
    width: 2.70,
    depth: 1.40,
    shelfElevation: 1.30, // Pusat vertikal para rak
    shelfTopY: 1.36,      // Permukaan atas lantai tingkat kedua
  };

  constructor() {
    // 1. Cipta World Rapier dengan graviti bumi -9.82 m/s²
    const gravity = { x: 0.0, y: -9.82, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    // 2. Lantai Gudang Datar (Static Ground Collider)
    // Permukaan lantai tepat pada y = 0.0
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(30, 0.5, 35)
      .setTranslation(0, -0.5, 0)
      .setFriction(0.8)
      .setRestitution(0.0);
    this.world.createCollider(groundColliderDesc);

    // 3. Badan RigidBody Dinamik Forklift dengan Center of Mass Simetris
    // Ditambahkan linearDamping (1.4) dan angularDamping (1.6) agar pergerakan mulus dan stabil tanpa tersentak kasar
    const forkliftBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 3.6, 4)
      .setLinearDamping(1.4)
      .setAngularDamping(1.6)
      .setCcdEnabled(true);

    this.forkliftBody = this.world.createRigidBody(forkliftBodyDesc);
    this.forkliftBody.setLinearDamping(1.4);
    this.forkliftBody.setAngularDamping(1.6);
    this.forkliftBody.setEnabledRotations(false, true, false, true);

    // Collision Groups:
    // Group 1: Environment (0x0001)
    // Group 2: Forklift Body (0x0002)
    // Group 3: Fork Tines (0x0004)
    // Group 4: Pallet & Cargo (0x0008)
    const GROUP_ENV = 0x0001;
    const GROUP_FORKLIFT = 0x0002;
    const GROUP_FORK = 0x0004;
    const GROUP_PALLET = 0x0008;

    // SOLUSI FISIKA 1 & 2: CENTER OF MASS TEPAT DI SUMBU X (0.0) & INERSIA ROTASI Y DIKURANGKAN
    // Casis Utama Ditinggikan dengan Ground Clearance 30cm:
    // Nilai Center of Mass (CoM) dipusatkan tepat pada X = 0.0,
    // dan inersia rotasi pada sumbu Y dikalibrasi rendah (250) agar respons kemudi seketika instan.
    const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(0.66, 0.35, 0.85)
      .setTranslation(0, 0.20, 0.08)
      .setFriction(1.5)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setMassProperties(
        3500, // Massa casis utama (kg)
        { x: 0.0, y: 0.15, z: 0.05 }, // Center of Mass simetris tepat di X = 0.0
        { x: 600, y: 250, z: 600 },   // Inersia rotasi sumbu Y rendah agar belok seketika tanpa delay
        { x: 0, y: 0, z: 0, w: 1 }
      )
      .setCollisionGroups((GROUP_FORKLIFT << 16) | (GROUP_ENV | GROUP_PALLET));
    this.world.createCollider(chassisColliderDesc, this.forkliftBody);

    // Kabin Atas & Tiang Pelindung Pemandu - CoM Simetris pada X = 0.0
    const cabinUpperDesc = RAPIER.ColliderDesc.cuboid(0.55, 0.48, 0.65)
      .setTranslation(0, 0.88, 0.15)
      .setFriction(1.0)
      .setRestitution(0.0)
      .setMassProperties(
        400,
        { x: 0.0, y: 0.88, z: 0.15 }, // CoM simetris tepat di X = 0.0
        { x: 80, y: 30, z: 80 },
        { x: 0, y: 0, z: 0, w: 1 }
      )
      .setCollisionGroups((GROUP_FORKLIFT << 16) | (GROUP_ENV | GROUP_PALLET));
    this.world.createCollider(cabinUpperDesc, this.forkliftBody);

    // B. 4 Roda Kontak Bulat - Nilai Friction, Damping, & Kekuatan 100% Simetris Kiri & Kanan:
    const wheelFrontRadius = 0.36;
    const wheelRearRadius = 0.30;
    const wheelFriction = 2.0;

    // Roda Hadapan Kiri & Kanan (Front Drive Wheels) - 100% Simetris:
    const wheelFL = RAPIER.ColliderDesc.ball(wheelFrontRadius)
      .setTranslation(-0.70, -0.45 + wheelFrontRadius, -0.65)
      .setFriction(wheelFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitution(0.0)
      .setMass(40)
      .setCollisionGroups((GROUP_FORKLIFT << 16) | GROUP_ENV);
    this.world.createCollider(wheelFL, this.forkliftBody);

    const wheelFR = RAPIER.ColliderDesc.ball(wheelFrontRadius)
      .setTranslation(0.70, -0.45 + wheelFrontRadius, -0.65)
      .setFriction(wheelFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitution(0.0)
      .setMass(40)
      .setCollisionGroups((GROUP_FORKLIFT << 16) | GROUP_ENV);
    this.world.createCollider(wheelFR, this.forkliftBody);

    // Roda Belakang Kiri & Kanan (Rear Steer Wheels) - 100% Simetris:
    const wheelRL = RAPIER.ColliderDesc.ball(wheelRearRadius)
      .setTranslation(-0.65, -0.45 + wheelRearRadius, 0.88)
      .setFriction(wheelFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitution(0.0)
      .setMass(30)
      .setCollisionGroups((GROUP_FORKLIFT << 16) | GROUP_ENV);
    this.world.createCollider(wheelRL, this.forkliftBody);

    const wheelRR = RAPIER.ColliderDesc.ball(wheelRearRadius)
      .setTranslation(0.65, -0.45 + wheelRearRadius, 0.88)
      .setFriction(wheelFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitution(0.0)
      .setMass(30)
      .setCollisionGroups((GROUP_FORKLIFT << 16) | GROUP_ENV);
    this.world.createCollider(wheelRR, this.forkliftBody);

    // 4. KINEMATIC RIGIDBODY UNTUK DUA BILAH GARPU (FORK TINES)
    const forkBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 0.04, 2.235)
      .setCcdEnabled(true);
    this.forkBody = this.world.createRigidBody(forkBodyDesc);

    const forkGroupMask = (GROUP_FORK << 16) | (GROUP_ENV | GROUP_PALLET);

    // Bilah Garpu Kiri & Kanan - Tebal 3.6cm, Lebar 10cm, Panjang 1.20m
    const tineHalfWidth = 0.05;
    const tineHalfHeight = 0.018;
    const tineHalfLength = 0.60;

    // Nilai gaya gesek (friction) ditingkatkan secara signifikan (2.8) dengan peraturan combine Max
    const leftTineCollider = RAPIER.ColliderDesc.cuboid(tineHalfWidth, tineHalfHeight, tineHalfLength)
      .setTranslation(-0.34, tineHalfHeight, 0)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(leftTineCollider, this.forkBody);

    const rightTineCollider = RAPIER.ColliderDesc.cuboid(tineHalfWidth, tineHalfHeight, tineHalfLength)
      .setTranslation(0.34, tineHalfHeight, 0)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(rightTineCollider, this.forkBody);

    // Bibir Penahan Hujung Garpu (Tip Stopper Lip) - di bahagian hadapan bilah garpu
    const tipLipDescL = RAPIER.ColliderDesc.cuboid(tineHalfWidth, 0.015, 0.025)
      .setTranslation(-0.34, tineHalfHeight * 2 + 0.015, -tineHalfLength + 0.025)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(tipLipDescL, this.forkBody);

    const tipLipDescR = RAPIER.ColliderDesc.cuboid(tineHalfWidth, 0.015, 0.025)
      .setTranslation(0.34, tineHalfHeight * 2 + 0.015, -tineHalfLength + 0.025)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(tipLipDescR, this.forkBody);

    // Lekukan Penahan Pangkal Garpu (Heel Stopper Lip / Ridge):
    // Ditambahkan di pangkal garpu (pangkal bertemu tiang mast) untuk menahan palet
    // agar tidak meluncur mundur saat forklift bergerak atau memecut maju
    const heelStopperDescL = RAPIER.ColliderDesc.cuboid(tineHalfWidth + 0.015, 0.022, 0.035)
      .setTranslation(-0.34, tineHalfHeight * 2 + 0.022, tineHalfLength - 0.035)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(heelStopperDescL, this.forkBody);

    const heelStopperDescR = RAPIER.ColliderDesc.cuboid(tineHalfWidth + 0.015, 0.022, 0.035)
      .setTranslation(0.34, tineHalfHeight * 2 + 0.022, tineHalfLength - 0.035)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(heelStopperDescR, this.forkBody);

    // Plat Belakang Garpu & LOAD BACKREST COLLIDER (Penebat Fizikal Kotak Tebal di Pangkal Garpu):
    // Memblokir palet kargo secara fizikal agar tidak dapat menembus atau tertinggal ke belakang garpu/mast
    // Dimensi: Lebar 1.30m (halfX = 0.65), Tinggi 1.50m (halfY = 0.75), Tebal 0.70m (halfZ = 0.35)
    const loadBackrestCollider = RAPIER.ColliderDesc.cuboid(0.65, 0.75, 0.35)
      .setTranslation(0, 0.75, tineHalfLength + 0.35)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(5000)
      .setCollisionGroups(forkGroupMask);
    this.world.createCollider(loadBackrestCollider, this.forkBody);

    // 5. PALET BARANG DINAMIK (DENGAN RUANG KOSONG DI BAWAH UNTUK GARPU)
    const palletBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.01, -2.5) // Terletak di hadapan forklift atas lantai gudang
      .setLinearDamping(0.8)
      .setAngularDamping(2.5)
      .setCcdEnabled(true);
    this.palletBody = this.world.createRigidBody(palletBodyDesc);

    const palletGroupMask = (GROUP_PALLET << 16) | 0xffff;

    // 3 Runner Kayu Bawah Palet (ketinggian dari y = 0.0m hingga 0.116m)
    // Gesekan ditingkatkan secara signifikan pada seluruh bahagian bawah palet
    const runnerHalfX = 0.055;
    const runnerHalfY = 0.058;
    const runnerHalfZ = 0.55;

    const leftRunnerCollider = RAPIER.ColliderDesc.cuboid(runnerHalfX, runnerHalfY, runnerHalfZ)
      .setTranslation(-0.52, runnerHalfY, 0)
      .setFriction(2.6)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(25)
      .setCollisionGroups(palletGroupMask);
    this.world.createCollider(leftRunnerCollider, this.palletBody);

    const midRunnerCollider = RAPIER.ColliderDesc.cuboid(runnerHalfX, runnerHalfY, runnerHalfZ)
      .setTranslation(0, runnerHalfY, 0)
      .setFriction(2.6)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(25)
      .setCollisionGroups(palletGroupMask);
    this.world.createCollider(midRunnerCollider, this.palletBody);

    const rightRunnerCollider = RAPIER.ColliderDesc.cuboid(runnerHalfX, runnerHalfY, runnerHalfZ)
      .setTranslation(0.52, runnerHalfY, 0)
      .setFriction(2.6)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(25)
      .setCollisionGroups(palletGroupMask);
    this.world.createCollider(rightRunnerCollider, this.palletBody);

    // Papan Atas Palet (Top Deckboard): Menampung sentuhan terus dari atas bilah garpu
    const deckHalfY = 0.018;
    const deckboardCollider = RAPIER.ColliderDesc.cuboid(0.60, deckHalfY, 0.55)
      .setTranslation(0, runnerHalfY * 2 + deckHalfY, 0)
      .setFriction(2.8)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(30)
      .setCollisionGroups(palletGroupMask);
    this.world.createCollider(deckboardCollider, this.palletBody);

    // Kotak Kargo di atas Palet (Cargo Box): Dari y = 0.152m ke atas (~0.85m)
    const boxHalfY = 0.35;
    const boxCollider = RAPIER.ColliderDesc.cuboid(0.50, boxHalfY, 0.45)
      .setTranslation(0, runnerHalfY * 2 + deckHalfY * 2 + boxHalfY, 0)
      .setFriction(0.7)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(35)
      .setCollisionGroups(palletGroupMask);
    this.world.createCollider(boxCollider, this.palletBody);

    // 6. Penghadang Dinding Perimeter & Tiang Gudang
    this.createStaticObstacle(0, 5, 29.5, 50, 10, 1);
    this.createStaticObstacle(0, 5, -29.5, 50, 10, 1);
    this.createStaticObstacle(-24.5, 5, 0, 1, 10, 60);
    this.createStaticObstacle(24.5, 5, 0, 1, 10, 60);

    const pillars = [
      [-12, -10],
      [-12, 10],
      [12, -10],
      [12, 10],
    ];
    pillars.forEach(([px, pz]) => {
      this.createStaticObstacle(px, 5, pz, 1.4, 10, 1.4);
    });

    // 7. RAK GUDANG 2 TINGKAT (Level 2 Pallet Rack - Solid Static Physics Colliders)
    // A. Solid Static Shelf Collider untuk Tingkat Atas (menampung palet pada ketinggian y = 1.36m)
    // Ketebalan para rak 0.12m, berpusat pada y = 1.30m, paras atas y = 1.36m
    const shelfColliderDesc = RAPIER.ColliderDesc.cuboid(
      this.rackConfig.width / 2,
      0.06,
      this.rackConfig.depth / 2
    )
      .setTranslation(this.rackConfig.x, this.rackConfig.shelfElevation, this.rackConfig.z)
      .setFriction(2.5)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.0)
      .setCollisionGroups(palletGroupMask);
    this.world.createCollider(shelfColliderDesc);

    // B. Tiang Penyangga Kiri, Kanan, & Belakang Rak (Menghalang forklift / palet tembus keluar)
    // Tiang sisi kiri (x = rackX - 1.32)
    this.createStaticObstacle(this.rackConfig.x - 1.32, 1.5, this.rackConfig.z, 0.12, 3.0, this.rackConfig.depth);
    // Tiang sisi kanan (x = rackX + 1.32)
    this.createStaticObstacle(this.rackConfig.x + 1.32, 1.5, this.rackConfig.z, 0.12, 3.0, this.rackConfig.depth);
    // Palang belakang rak (z = rackZ - 0.68)
    this.createStaticObstacle(this.rackConfig.x, 1.5, this.rackConfig.z - 0.68, this.rackConfig.width, 3.0, 0.12);

    const attachVelocityAliases = (body: RAPIER.RigidBody) => {
      (body as any).setLinearVelocity = (
        arg1: number | { x?: number; y?: number; z?: number },
        vy: number = 0,
        vz: number = 0
      ) => {
        const vx = typeof arg1 === 'object' ? (arg1.x ?? 0) : arg1;
        const y = typeof arg1 === 'object' ? (arg1.y ?? 0) : vy;
        const z = typeof arg1 === 'object' ? (arg1.z ?? 0) : vz;
        body.setLinvel({ x: vx, y, z }, true);
        body.wakeUp();
      };
      (body as any).setAngularVelocity = (
        arg1: number | { x?: number; y?: number; z?: number },
        vy: number = 0,
        vz: number = 0
      ) => {
        const vx = typeof arg1 === 'object' ? (arg1.x ?? 0) : arg1;
        const y = typeof arg1 === 'object' ? (arg1.y ?? 0) : vy;
        const z = typeof arg1 === 'object' ? (arg1.z ?? 0) : vz;
        body.setAngvel({ x: vx, y, z }, true);
        body.wakeUp();
      };
    };

    attachVelocityAliases(this.forkliftBody);
    attachVelocityAliases(this.palletBody);

    this.setLevel(1);
    this.isReady = true;
  }

  private createStaticObstacle(x: number, y: number, z: number, w: number, h: number, d: number): RAPIER.Collider {
    const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(x, y, z)
      .setFriction(0.5)
      .setRestitution(0.0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
    return this.world.createCollider(colDesc);
  }

  /**
   * Menetapkan tahap permainan dan memasang/membuang collider tahap berkenaan.
   * Ini membuang sama sekali pepijat 'Tembok Gaib' (Invisible Wall) di Level 4,
   * di mana collider lorong L Level 3 dahulunya kekal aktif memblokir jalan.
   */
  public setLevel(level: 1 | 2 | 3 | 4 | 5) {
    this.currentLevel = level;

    // 1. Buang collider tahap sebelumnya
    for (const c of this.level3Colliders) {
      this.world.removeCollider(c, false);
    }
    this.level3Colliders = [];

    for (const c of this.level4Colliders) {
      this.world.removeCollider(c, false);
    }
    this.level4Colliders = [];

    for (const c of this.level5Colliders) {
      this.world.removeCollider(c, false);
    }
    this.level5Colliders = [];

    // 2. Pasang collider khusus mengikut tahap
    if (level === 3) {
      // Collider Lorong L Level 3:
      this.level3Colliders.push(
        this.createStaticObstacle(3.5, 2.5, 12.9, 1.4, 5.0, 6.2),
        this.createStaticObstacle(8.5, 2.5, 13.4, 1.4, 5.0, 16.2),
        this.createStaticObstacle(2.35, 2.5, 5.3, 13.7, 5.0, 1.4),
        this.createStaticObstacle(-0.15, 2.5, 10.5, 8.7, 5.0, 1.4),
        this.createStaticObstacle(3.5, 0.6, 16.0, 0.35, 1.2, 0.35),
        this.createStaticObstacle(8.5, 0.6, 21.5, 0.35, 1.2, 0.35),
        this.createStaticObstacle(4.2, 0.6, 9.8, 0.35, 1.2, 0.35),
        this.createStaticObstacle(8.5, 0.6, 5.3, 0.35, 1.2, 0.35),
        this.createStaticObstacle(-4.5, 0.6, 5.3, 0.35, 1.2, 0.35),
        this.createStaticObstacle(-4.5, 0.6, 10.5, 0.35, 1.2, 0.35)
      );
    } else if (level === 4) {
      // Collider Level 4: Dimensi SAMA PERSIS dengan visual 3D (tidak boleh melebar / tiada tembok gaib)
      // A. Tong Drum Keluli 200L: Radius tepat 0.35m, Tinggi tepat 0.95m (separuh tinggi 0.475m)
      const drumCoords = [
        [-1.8, -11.0], [-0.6, -11.0], [0.4, -11.0],
        [-0.4, -3.5], [0.6, -3.5], [1.8, -3.5],
        [-1.8, 4.0], [-0.6, 4.0], [0.4, 4.0],
        [-0.4, 11.5], [0.6, 11.5], [1.8, 11.5],
      ];
      drumCoords.forEach(([dx, dz]) => {
        const drumDesc = RAPIER.ColliderDesc.cylinder(0.95 / 2, 0.35)
          .setTranslation(dx, 0.95 / 2, dz)
          .setFriction(0.6)
          .setRestitution(0.0)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
        this.level4Colliders.push(this.world.createCollider(drumDesc));
      });

      // B. Kerucut Keselamatan: Radius tepat 0.18m, Tinggi tepat 0.72m
      const coneCoords = [
        [1.1, -11.0], [1.1, -10.2],
        [-1.1, -3.5], [-1.1, -2.7],
        [1.1, 4.0], [1.1, 4.8],
        [-1.1, 11.5], [-1.1, 12.3],
        // Sempadan luar selekoh lorong:
        [5.8, -7.5], [-5.8, 0.0], [5.8, 7.5], [-5.8, 15.0],
      ];
      coneCoords.forEach(([cx, cz]) => {
        const coneDesc = RAPIER.ColliderDesc.cylinder(0.72 / 2, 0.18)
          .setTranslation(cx, 0.72 / 2, cz)
          .setFriction(0.6)
          .setRestitution(0.0)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
        this.level4Colliders.push(this.world.createCollider(coneDesc));
      });

      // C. Kotak Kargo Kayu: Dimensi tepat sama visual
      const crateDefs = [
        { x: -4.8, z: -11.0, w: 1.4, h: 1.2, d: 1.2 },
        { x: -3.2, z: -11.0, w: 1.2, h: 1.0, d: 1.2 },
        { x: 3.2, z: -3.5, w: 1.2, h: 1.0, d: 1.2 },
        { x: 4.8, z: -3.5, w: 1.4, h: 1.2, d: 1.2 },
        { x: -4.8, z: 4.0, w: 1.4, h: 1.2, d: 1.2 },
        { x: -3.2, z: 4.0, w: 1.2, h: 1.0, d: 1.2 },
        { x: 3.2, z: 11.5, w: 1.2, h: 1.0, d: 1.2 },
        { x: 4.8, z: 11.5, w: 1.4, h: 1.2, d: 1.2 },
      ];
      crateDefs.forEach(({ x, z, w, h, d }) => {
        const crateDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
          .setTranslation(x, h / 2, z)
          .setFriction(0.6)
          .setRestitution(0.0)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
        this.level4Colliders.push(this.world.createCollider(crateDesc));
      });
    } else if (level === 5) {
      // SOLUSI FISIKA 2: FLUSH RAMP BASE COLLIDER (DITANAM MENEMBUS KE BAWAH LANTAI Y < 0)
      // Pangkal awal tanjakan ditanam dari X = 8.5 (y = -0.12m) dan muncul mulus menembus lantai di X = 7.0 (y = 0.0m).
      // Ujung turunan ditanam dari X = -19.0 (y = 0.0m) hingga X = -20.5 (y = -0.12m).
      // Seluruh muka depan & belakang berada di bawah lantai (y <= -0.12m & skirt y = -0.40m),
      // sehingga TIDAK ADA SEDIKIT PUN STEP / BIBIR VERTIKAL yang terekspos di lantai.
      const numSteps = 70;
      const xStart = 8.5;
      const xEnd = -20.5;
      const vertices: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const x = xStart + (xEnd - xStart) * t;
        const info = getLevel5RampSurfaceHeight(x);
        const y = info.y;
        const curbH = info.curbH;

        // 6 Titik Penampang Z per irisan X:
        // 0: Dasar Skirt Utara (y = -0.40m, tertanam di bawah lantai)
        // 1: Puncak Bendul/Curb Utara (y + curbH)
        // 2: Tepi Dek Utara (y)
        // 3: Tepi Dek Selatan (y)
        // 4: Puncak Bendul/Curb Selatan (y + curbH)
        // 5: Dasar Skirt Selatan (y = -0.40m, tertanam di bawah lantai)
        vertices.push(
          x, -0.40, -20.6,
          x, y + curbH, -20.6,
          x, y, -20.8,
          x, y, -26.2,
          x, y + curbH, -26.4,
          x, -0.40, -26.4
        );
      }

      // Sambungan Segitiga (Quads) di antara irisan
      for (let i = 0; i < numSteps; i++) {
        const row1 = i * 6;
        const row2 = (i + 1) * 6;
        for (let c = 0; c < 5; c++) {
          const a = row1 + c;
          const b = row1 + c + 1;
          const c1 = row2 + c;
          const d = row2 + c + 1;
          indices.push(a, b, c1);
          indices.push(b, d, c1);
        }
      }

      // Tutup Muka Depan (X = 8.5, tertanam di bawah lantai) & Belakang (X = -20.5, tertanam di bawah lantai)
      const frontRow = 0;
      indices.push(frontRow + 0, frontRow + 1, frontRow + 2);
      indices.push(frontRow + 0, frontRow + 2, frontRow + 3);
      indices.push(frontRow + 0, frontRow + 3, frontRow + 4);
      indices.push(frontRow + 0, frontRow + 4, frontRow + 5);

      const backRow = numSteps * 6;
      indices.push(backRow + 0, backRow + 2, backRow + 1);
      indices.push(backRow + 0, backRow + 3, backRow + 2);
      indices.push(backRow + 0, backRow + 4, backRow + 3);
      indices.push(backRow + 0, backRow + 5, backRow + 4);

      const vArr = new Float32Array(vertices);
      const iArr = new Uint32Array(indices);

      const bridgeDesc = RAPIER.ColliderDesc.trimesh(vArr, iArr)
        .setFriction(2.5)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setRestitution(0.0)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
      this.level5Colliders.push(this.world.createCollider(bridgeDesc));

      // Platform Akhir Level 5 (Unloading Dock Platform Pad)
      // Membentang dari X = -19.1 hingga -24.5, Z = -20.8 hingga -26.2 pada ketinggian y = 0.06m
      const dockPadDesc = RAPIER.ColliderDesc.cuboid(5.4 / 2, 0.06 / 2, 5.4 / 2)
        .setTranslation(-21.8, 0.06 / 2, -23.5)
        .setFriction(1.2)
        .setRestitution(0.0);
      this.level5Colliders.push(this.world.createCollider(dockPadDesc));

      // Dinding & Pagar Pengaman Luar Lintasan
      // Mencegah forklift melompat keluar jembatan ke arah utara atau selatan
      this.level5Colliders.push(
        this.createStaticObstacle(-6.0, 1.8, -20.2, 28.0, 2.0, 0.4),
        this.createStaticObstacle(-6.0, 1.8, -26.8, 28.0, 2.0, 0.4),
        // Dinding pembatas di ujung barat gudang dekat Drop Zone
        this.createStaticObstacle(-24.6, 2.0, -23.5, 0.2, 2.5, 10.0)
      );
    }
  }

  /**
   * Menjatuhkan semula forklift dari ketinggian untuk simulasi graviti
   */
  public dropForklift(height: number = 3.8, x: number = 0, z: number = 4, heading?: number) {
    if (this.isCargoLocked) {
      this.unlockCargo();
    }
    if (heading !== undefined) {
      this.heading = heading;
      const halfAngle = heading / 2;
      this.forkliftBody.setRotation(
        {
          x: 0,
          y: Math.sin(halfAngle),
          z: 0,
          w: Math.cos(halfAngle),
        },
        true
      );
    }
    this.forkliftBody.setTranslation({ x, y: height, z }, true);
    this.forkliftBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.forkliftBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.currentSpeed = 0;
    this.angularVelocity = 0;
  }

  /**
   * Mengembalikan palet sasaran ke kedudukan asal di atas lantai gudang (clean reset)
   * Memastikan status fizikal palet 100% bebas dari garpu dan kembali ke rigid-body Dynamic
   */
  public resetPallet(x: number = 0, y: number = 0.01, z: number = -2.5, rotY: number = 0) {
    this.isCargoLocked = false;
    this.lockOffset = { x: 0, y: 0, z: 0 };
    this.lockRelativeYaw = 0;
    this.palletBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.palletBody.setTranslation({ x, y, z }, true);
    const halfAngle = rotY / 2;
    this.palletBody.setRotation(
      {
        x: 0,
        y: Math.sin(halfAngle),
        z: 0,
        w: Math.cos(halfAngle),
      },
      true
    );
    this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.palletBody.wakeUp();
  }

  /**
   * Reset status kendali: kelajuan inersia, sudut stereng, dan halaju fizikal forklift
   */
  public resetControls() {
    this.currentSpeed = 0;
    this.angularVelocity = 0;
    this.isCargoLocked = false;
    if (this.forkliftBody) {
      this.forkliftBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.forkliftBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.forkliftBody.wakeUp();
    }
    if (this.palletBody) {
      this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.palletBody.wakeUp();
    }
  }

  /**
   * Setel ulang kecepatan linear dan angular (setLinearVelocity dan setAngularVelocity)
   * dari rigid-body forklift dan palet menjadi tepat 0 agar tidak ada sisa momentum tabrakan (Langkah 1)
   */
  public resetAllVelocities() {
    this.currentSpeed = 0;
    this.angularVelocity = 0;
    this.isCargoLocked = false;
    this.setLinearVelocity('both', 0, 0, 0);
    this.setAngularVelocity('both', 0, 0, 0);
    if (this.forkliftBody) {
      this.forkliftBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.forkliftBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.forkliftBody.wakeUp();
    }
    if (this.palletBody) {
      this.palletBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.palletBody.wakeUp();
    }
  }

  public setLinearVelocity(
    target: 'forklift' | 'pallet' | 'both',
    xOrVec: number | { x?: number; y?: number; z?: number } = 0,
    y: number = 0,
    z: number = 0
  ) {
    const vx = typeof xOrVec === 'object' ? (xOrVec.x ?? 0) : xOrVec;
    const vy = typeof xOrVec === 'object' ? (xOrVec.y ?? 0) : y;
    const vz = typeof xOrVec === 'object' ? (xOrVec.z ?? 0) : z;

    if ((target === 'forklift' || target === 'both') && this.forkliftBody) {
      this.forkliftBody.setLinvel({ x: vx, y: vy, z: vz }, true);
      this.forkliftBody.wakeUp();
    }
    if ((target === 'pallet' || target === 'both') && this.palletBody) {
      this.palletBody.setLinvel({ x: vx, y: vy, z: vz }, true);
      this.palletBody.wakeUp();
    }
  }

  public setAngularVelocity(
    target: 'forklift' | 'pallet' | 'both',
    xOrVec: number | { x?: number; y?: number; z?: number } = 0,
    y: number = 0,
    z: number = 0
  ) {
    const vx = typeof xOrVec === 'object' ? (xOrVec.x ?? 0) : xOrVec;
    const vy = typeof xOrVec === 'object' ? (xOrVec.y ?? 0) : y;
    const vz = typeof xOrVec === 'object' ? (xOrVec.z ?? 0) : z;

    if ((target === 'forklift' || target === 'both') && this.forkliftBody) {
      this.forkliftBody.setAngvel({ x: vx, y: vy, z: vz }, true);
      this.forkliftBody.wakeUp();
    }
    if ((target === 'pallet' || target === 'both') && this.palletBody) {
      this.palletBody.setAngvel({ x: vx, y: vy, z: vz }, true);
      this.palletBody.wakeUp();
    }
  }

  /**
   * Jeda (pause) dan nyahjeda (unpause) simulasi enjin fizik Rapier (Langkah 2)
   */
  public pause() {
    this.isPaused = true;
  }

  public unpause() {
    this.isPaused = false;
    if (this.forkliftBody) {
      this.forkliftBody.wakeUp();
    }
    if (this.palletBody) {
      this.palletBody.wakeUp();
    }
  }

  /**
   * Semakan sama ada kedua-dua bilah garpu telah disorong tepat ke bawah bukaan palet
   */
  public isForkUnderPallet(forkHeight: number): boolean {
    const pos = this.forkliftBody.translation();
    const pPos = this.palletBody.translation();
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    const forkCenterX = pos.x + forwardX * 1.765;
    const forkCenterZ = pos.z + forwardZ * 1.765;
    const groundOffset = Math.max(0, pos.y - 0.45);
    const forkY = groundOffset + Math.max(0.04, forkHeight);

    const dx = pPos.x - forkCenterX;
    const dz = pPos.z - forkCenterZ;
    const localX = dx * rightX + dz * rightZ;
    const localZ = dx * forwardX + dz * forwardZ;
    const localY = pPos.y - forkY;

    // Palet berada di garpu: sisihan sisi < 52cm, sepanjang bilah < 75cm, ketinggian rapat
    return (
      Math.abs(localX) < 0.52 &&
      Math.abs(localZ) < 0.75 &&
      localY >= -0.75 &&
      localY <= 0.35 &&
      pPos.y <= Math.max(0.35, forkY + 0.35)
    );
  }

  /**
   * Kunci muatan secara Temporary Parenting (100% melekat kuat pada garpu)
   */
  public lockCargo(_localX: number = 0, localY: number = 0.02, localZ: number = 0) {
    this.isCargoLocked = true;
    this.lockOffset = {
      x: 0, // Palet dijajarkan kemas tepat di tengah-tengah antara bilah garpu
      y: Math.max(0.015, Math.min(0.05, localY)),
      z: Math.max(-0.25, Math.min(0.25, localZ)),
    };
    this.lockRelativeYaw = 0;

    // Tukar jenis rigid-body palet ke KinematicPositionBased semasa di-parent
    this.palletBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /**
   * Lepaskan kuncian/parenting dan pulangkan palet menjadi rigid-body dinamik normal.
   * Bertumpu stabil di lantai jika di bawah, atau di atas collider para rak jika diletakkan di tingkat 2.
   */
  public unlockCargo() {
    if (!this.isCargoLocked) return;
    this.isCargoLocked = false;

    // Pulangkan semula palet ke jenis Dynamic normal
    this.palletBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const currentPos = this.palletBody.translation();

    // Semakan sama ada palet berada di atas kawasan para rak (Level 2 Pallet Rack)
    const isOverRackShelf =
      Math.abs(currentPos.x - this.rackConfig.x) <= this.rackConfig.width / 2 + 0.20 &&
      Math.abs(currentPos.z - this.rackConfig.z) <= this.rackConfig.depth / 2 + 0.20 &&
      currentPos.y >= 1.15;

    // Semakan sama ada palet berada di atas kawasan jembatan / platform / tanjakan Level 5
    const isOverBridgeTrack =
      this.currentLevel === 5 &&
      currentPos.x <= 7.0 && currentPos.x >= -19.0 &&
      currentPos.z <= -20.2 && currentPos.z >= -26.8;

    if (isOverRackShelf) {
      // Diletakkan di atas tingkat atas rak: bertumpu rapat pada aras collider rak (1.36m)
      this.palletBody.setTranslation(
        {
          x: currentPos.x,
          y: Math.max(this.rackConfig.shelfTopY, currentPos.y),
          z: currentPos.z,
        },
        true
      );
    } else if (isOverBridgeTrack) {
      // Diletakkan di atas lintasan jembatan berbukit Level 5
      const trackY = getLevel5TrackHeight(currentPos.x).y;
      this.palletBody.setTranslation(
        {
          x: currentPos.x,
          y: Math.max(trackY + 0.01, currentPos.y),
          z: currentPos.z,
        },
        true
      );
    } else if (
      this.currentLevel === 5 &&
      currentPos.x <= -19.0 && currentPos.x >= -24.7 &&
      currentPos.z <= -20.5 && currentPos.z >= -26.5
    ) {
      // Diletakkan di atas platform akhir Drop Zone Level 5 (y = 0.06m)
      this.palletBody.setTranslation(
        {
          x: currentPos.x,
          y: Math.max(0.065, currentPos.y),
          z: currentPos.z,
        },
        true
      );
    } else {
      // Di atas lantai gudang atau Drop Zone akhir: mendarat rapat ke atas lantai (y = 0.01m)
      this.palletBody.setTranslation({ x: currentPos.x, y: 0.01, z: currentPos.z }, true);
    }
    this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.palletBody.wakeUp();
  }

  public isLocked(): boolean {
    return this.isCargoLocked;
  }

  /**
   * Semakan sama ada palet bertumpu dengan stabil di atas tingkat atas rak (Level 2)
   * Hanya sah jika kargo TIDAK terkunci DAN garpu sudah diturunkan / dilepaskan
   */
  public isPalletOnRackShelf(): boolean {
    const pPos = this.palletBody.translation();
    const pos = this.forkliftBody.translation();
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const forkCenterX = pos.x + forwardX * 1.765;
    const forkCenterZ = pos.z + forwardZ * 1.765;
    const distToFork = Math.hypot(pPos.x - forkCenterX, pPos.z - forkCenterZ);

    const onShelfGeometry =
      Math.abs(pPos.x - this.rackConfig.x) <= this.rackConfig.width / 2 + 0.15 &&
      Math.abs(pPos.z - this.rackConfig.z) <= this.rackConfig.depth / 2 + 0.15 &&
      pPos.y >= 1.30 &&
      pPos.y <= 1.55;

    // Palet benar-benar diletakkan di rak jika tidak terkunci dan garpu sudah diturunkan (<= 1.32m) atau ditarik keluar
    const isForkDisengaged = this.currentForkHeight <= 1.32 || distToFork > 1.25;

    return onShelfGeometry && !this.isCargoLocked && isForkDisengaged;
  }

  /**
   * Menetapkan kedudukan fizikal bilah garpu & mengemaskini parenting palet
   */
  public updateForkKinematics(
    forkHeight: number,
    forkUp: boolean = false,
    forkDown: boolean = false
  ) {
    this.currentForkHeight = forkHeight;
    const pos = this.forkliftBody.translation();
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    // Titik tengah bilah garpu sepanjang 1.20m terletak 1.765m di hadapan casis kenderaan
    const forkCenterX = pos.x + forwardX * 1.765;
    const forkCenterZ = pos.z + forwardZ * 1.765;

    // Garpu ikut kedudukan vertikal casis sekiranya forklift terangkat atau dijatuhkan dari udara
    const groundOffset = Math.max(0, pos.y - 0.45);
    const forkY = groundOffset + Math.max(0.04, forkHeight);

    const halfAngle = this.heading / 2;
    this.forkBody.setNextKinematicTranslation({
      x: forkCenterX,
      y: forkY,
      z: forkCenterZ,
    });
    this.forkBody.setNextKinematicRotation({
      x: 0,
      y: Math.sin(halfAngle),
      z: 0,
      w: Math.cos(halfAngle),
    });

    // 1. LOGIK KUNCI OTOMATIK (TEMPORARY PARENTING):
    // Saat garpu disorong tepat ke bawah palet dan butang Naik Garpu ditekan (atau garpu mula dinaikkan)
    if (!this.isCargoLocked) {
      if ((forkUp || forkHeight > 0.08) && this.isForkUnderPallet(forkHeight)) {
        const pPos = this.palletBody.translation();
        const dx = pPos.x - forkCenterX;
        const dz = pPos.z - forkCenterZ;
        const localZ = dx * forwardX + dz * forwardZ;
        const localY = pPos.y - forkY;
        this.lockCargo(0, localY, localZ);
      }
    } else {
      // 2. LOGIK LEPAS KUNCIAN:
      // A. Saat tombol Turun Garpu ditekan hingga palet menyentuh lantai (atau paras lantai dicapai)
      const isTouchingFloor = forkHeight <= 0.085 || forkY <= 0.085;

      // B. Saat palet diletakkan di atas tingkat atas rak (Level 2 Pallet Rack)
      // dan tombol Turun Garpu ditekan (atau garpu mula turun melepaskan palet ke para rak)
      const pPos = this.palletBody.translation();
      const isOverRackShelf =
        Math.abs(pPos.x - this.rackConfig.x) <= this.rackConfig.width / 2 + 0.15 &&
        Math.abs(pPos.z - this.rackConfig.z) <= this.rackConfig.depth / 2 + 0.15 &&
        pPos.y >= 1.25 &&
        pPos.y <= 1.70;

      const isLoweringOnShelf = isOverRackShelf && (forkDown || forkY <= 1.38);

      // C. Saat palet diletakkan di atas lintasan jembatan atau di lantai gudang akhir (Level 5)
      const trackElevation = this.currentLevel === 5 ? getLevel5TrackHeight(pPos.x).y : 0;
      const isTouchingTrack = this.currentLevel === 5 && (forkY <= trackElevation + 0.085 || forkHeight <= 0.085);

      if ((forkDown && (isTouchingFloor || isTouchingTrack)) || isLoweringOnShelf) {
        this.unlockCargo();
      }
    }

    // 3. SINKRONISASI PARENTING: Palet 100% melekat kemas pada garpu
    if (this.isCargoLocked) {
      const targetX = forkCenterX + rightX * this.lockOffset.x + forwardX * this.lockOffset.z;
      const targetZ = forkCenterZ + rightZ * this.lockOffset.x + forwardZ * this.lockOffset.z;
      const targetY = forkY + this.lockOffset.y;
      const palletHeading = this.heading + this.lockRelativeYaw;
      const halfPalletAngle = palletHeading / 2;

      this.palletBody.setNextKinematicTranslation({ x: targetX, y: targetY, z: targetZ });
      this.palletBody.setNextKinematicRotation({
        x: 0,
        y: Math.sin(halfPalletAngle),
        z: 0,
        w: Math.cos(halfPalletAngle),
      });
      this.palletBody.setTranslation({ x: targetX, y: targetY, z: targetZ }, true);
      this.palletBody.setRotation(
        {
          x: 0,
          y: Math.sin(halfPalletAngle),
          z: 0,
          w: Math.cos(halfPalletAngle),
        },
        true
      );
      this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    } else {
      // Kejutkan palet (wake up) supaya sentuhan fizikal garpu sentiasa aktif
      this.palletBody.wakeUp();
    }
  }

  /**
   * Mengemaskini kawalan pergerakan kenderaan (Stereng putaran yaw & laju maju/mundur searah hadap)
   */
  public applyMovement(
    forward: boolean,
    backward: boolean,
    steerLeft: boolean,
    steerRight: boolean,
    brake: boolean,
    forkHeight: number,
    dt: number,
    forkUp: boolean = false,
    forkDown: boolean = false
  ) {
    const clampedDt = Math.min(dt, 0.05);
    const pos = this.forkliftBody.translation();

    // Tentukan paras permukaan tanah / lintasan jembatan berbukit Level 5
    let expectedGroundY = 0.0;
    let isOnRamp = false;
    let trackSlope = 0.0;

    if (this.currentLevel === 5) {
      if (pos.x <= 7.5 && pos.x >= -19.5 && pos.z >= -27.0 && pos.z <= -20.0) {
        const info = getLevel5TrackHeight(pos.x);
        expectedGroundY = info.y;
        trackSlope = info.slope;
        isOnRamp = info.segment === 'ramp_up' || info.segment === 'ramp_down';
      }
    }

    const isGrounded = pos.y <= expectedGroundY + 0.65;

    // 1. REALISME KEMUDI RODA BELAKANG (REAR-WHEEL STEERING) DENGAN LERP:
    // Forklift asli berbelok menggunakan gandar roda belakang (Rear-Wheel Steering), bukan roda depan.
    // Saat tombol A (kiri) ditekan, roda belakang membelok ke kanan (+MAX_REAR_STEER),
    // mengayunkan counterweight (bagian belakang) ke arah luar dan mengarahkan moncong ke kiri.
    let targetRearSteer = 0;
    if (steerLeft && !steerRight) {
      targetRearSteer = this.MAX_REAR_STEER; // Belok kiri -> roda belakang mengarah ke kanan (+ sudut)
    } else if (steerRight && !steerLeft) {
      targetRearSteer = -this.MAX_REAR_STEER; // Belok kanan -> roda belakang mengarah ke kiri (- sudut)
    } else {
      targetRearSteer = 0;
    }

    // Terapkan Lerp halus pada sudut steering roda belakang (Rear-Wheel Steering)
    const steerLerpSpeed = targetRearSteer !== 0 ? 26.0 : 30.0;
    const steerT = 1.0 - Math.exp(-steerLerpSpeed * clampedDt);
    this.rearSteerAngle = lerp(this.rearSteerAngle, targetRearSteer, steerT);
    if (Math.abs(this.rearSteerAngle) < 0.002) {
      this.rearSteerAngle = 0;
    }

    // Respons putaran yaw dihitung secara linear dari sudut kemudi roda belakang (Rear-Wheel Steering)
    this.angularVelocity = (this.rearSteerAngle / this.MAX_REAR_STEER) * this.MAX_TURN_SPEED;
    if (Math.abs(this.angularVelocity) < 0.005) {
      this.angularVelocity = 0;
    }

    this.heading += this.angularVelocity * clampedDt;
    this.heading = (this.heading + Math.PI * 2) % (Math.PI * 2);

    const halfAngle = this.heading / 2;
    this.forkliftBody.setRotation(
      {
        x: 0,
        y: Math.sin(halfAngle),
        z: 0,
        w: Math.cos(halfAngle),
      },
      true
    );
    // Terapkan halaju sudut fizikal paksi-Y pada badan forklift
    this.forkliftBody.setAngvel({ x: 0, y: this.angularVelocity, z: 0 }, true);

    // 2. VEKTOR ARAH HADAP (-sin(theta), 0, -cos(theta)) & ARAH KANAN (cos(theta), 0, -sin(theta))
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    // 3. PENGGERAK MOTOR: LERP TARGET VELOCITY GAS MAJU & MUNDUR
    // Terapkan fungsi matematika 'Lerp' pada aplikasi target velocity gas agar perubahannya bertahap dan smooth
    let targetSpeed = 0;
    if (brake) {
      targetSpeed = 0;
    } else if (forward && !backward) {
      targetSpeed = this.MAX_FORWARD_SPEED;
    } else if (backward && !forward) {
      // Tenaga dorong mundur (reverse torque) sama kuatnya dengan saat maju
      targetSpeed = -this.MAX_REVERSE_SPEED;
    } else {
      targetSpeed = 0;
    }

    const gasLerpSpeed = brake ? 14.0 : (targetSpeed === 0 ? 4.5 : (isOnRamp ? 5.5 : 4.5));
    const gasT = 1.0 - Math.exp(-gasLerpSpeed * clampedDt);
    this.currentSpeed = lerp(this.currentSpeed, targetSpeed, gasT);
    if (Math.abs(this.currentSpeed) < 0.005) {
      this.currentSpeed = 0;
    }

    // 4. KEMASKINI HALAJU FIZIK DENGAN AYUNAN COUNTERWEIGHT (TAIL SWING)
    const currentLinvel = this.forkliftBody.linvel();
    let vy = currentLinvel.y;

    let vx = 0;
    let vz = 0;

    if (isGrounded) {
      // Pusat putaran (pivot axis) berada pada gandar roda depan tetap berjarak L_f = 0.65m di depan CoM.
      // Sesuai kinematika Rear-Wheel Steering, CoM mendapatkan komponen kecepatan lateral:
      // v_lateral = right * (angularVelocity * L_f),
      // yang menyebabkan bagian belakang (counterweight) berayun keluar (tail swing) saat belokan tajam!
      const lateralSpeed = this.angularVelocity * this.FRONT_AXLE_OFFSET;

      vx = forwardX * this.currentSpeed + rightX * lateralSpeed;
      vz = forwardZ * this.currentSpeed + rightZ * lateralSpeed;

      if (isOnRamp) {
        // Mendaki atau menuruni lereng tanjakan kurva halus (smooth curve S-shape)
        // dx/dt = vx, dy/dt = (dy/dx) * (dx/dt) = trackSlope * vx
        const slopeVy = vx * trackSlope;
        if (slopeVy > 0) {
          // Mendaki tanjakan: pastikan daya angkat menegak menyokong pendakian
          vy = Math.max(currentLinvel.y, slopeVy);
        } else {
          // Menuruni cerun: pandu halaju menegak ke bawah mengikut kelengkungan lereng tanpa terapung
          vy = Math.min(currentLinvel.y, slopeVy);
        }
      } else {
        // Lantai datar: cegah lonjakan vertikal
        vy = Math.min(currentLinvel.y, 0.05);
      }

      // Suspensi aktif simetris kiri-kanan:
      // Memastikan forklift bertumpu stabil di atas lantai atau permukaan lintasan jembatan
      if (pos.y < expectedGroundY + 0.45) {
        const penetration = expectedGroundY + 0.45 - pos.y;
        vy = Math.max(vy, penetration * 14.0);
      }
    }

    this.forkliftBody.setLinvel({ x: vx, y: vy, z: vz }, true);

    // 5. KEMASKINI KINEMATIK BILAH GARPU & PENGAWASAN KUNCI MUATAN
    this.updateForkKinematics(forkHeight, forkUp, forkDown);
  }

  /**
   * Melangkah simulasi Rapier ke hadapan sebanyak dt saat
   * Mematuhi status jeda (isPaused) agar Rapier berhenti semasa crash dan aktif semula saat restart
   */
  public step(dt: number) {
    if (this.isPaused) return;
    this.world.timestep = Math.min(dt, 0.05);
    this.world.step();

    // Pastikan tiada tork geseran sisa pada yaw semasa bergerak lurus
    if (this.angularVelocity === 0 && this.forkliftBody) {
      this.forkliftBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // SINKRONISASI PRESISI PASCA-STEP (Hapuskan delay visual 1-frame antara forklift & palet)
    if (this.isCargoLocked) {
      this.syncLockedPalletImmediate();
    }
  }

  /**
   * Paksa sinkronisasi posisi & rotasi palet kargo tepat mengikuti garpu forklift
   * secara instan di setiap langkah simulasi agar tidak ada delay visual atau clipping.
   */
  public syncLockedPalletImmediate() {
    if (!this.isCargoLocked || !this.palletBody || !this.forkliftBody) return;
    const pos = this.forkliftBody.translation();
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    const forkCenterX = pos.x + forwardX * 1.765;
    const forkCenterZ = pos.z + forwardZ * 1.765;
    const groundOffset = Math.max(0, pos.y - 0.45);
    const forkY = groundOffset + Math.max(0.04, this.currentForkHeight);

    const targetX = forkCenterX + rightX * this.lockOffset.x + forwardX * this.lockOffset.z;
    const targetZ = forkCenterZ + rightZ * this.lockOffset.x + forwardZ * this.lockOffset.z;
    const targetY = forkY + this.lockOffset.y;
    const palletHeading = this.heading + this.lockRelativeYaw;
    const halfPalletAngle = palletHeading / 2;

    this.palletBody.setTranslation({ x: targetX, y: targetY, z: targetZ }, true);
    this.palletBody.setRotation(
      {
        x: 0,
        y: Math.sin(halfPalletAngle),
        z: 0,
        w: Math.cos(halfPalletAngle),
      },
      true
    );
    this.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.palletBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  public getSpeedKmh(): number {
    return Math.abs(this.currentSpeed * 3.6);
  }

  public getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  public getHeading(): number {
    return this.heading;
  }

  public getPalletTranslation(): { x: number; y: number; z: number } {
    if (this.isCargoLocked && this.forkliftBody) {
      const pos = this.forkliftBody.translation();
      const forwardX = -Math.sin(this.heading);
      const forwardZ = -Math.cos(this.heading);
      const rightX = Math.cos(this.heading);
      const rightZ = -Math.sin(this.heading);

      const forkCenterX = pos.x + forwardX * 1.765;
      const forkCenterZ = pos.z + forwardZ * 1.765;
      const groundOffset = Math.max(0, pos.y - 0.45);
      const forkY = groundOffset + Math.max(0.04, this.currentForkHeight);

      return {
        x: forkCenterX + rightX * this.lockOffset.x + forwardX * this.lockOffset.z,
        y: forkY + this.lockOffset.y,
        z: forkCenterZ + rightZ * this.lockOffset.x + forwardZ * this.lockOffset.z,
      };
    }
    return this.palletBody.translation();
  }

  public getPalletRotation(): { x: number; y: number; z: number; w: number } {
    if (this.isCargoLocked) {
      const palletHeading = this.heading + this.lockRelativeYaw;
      const halfPalletAngle = palletHeading / 2;
      return {
        x: 0,
        y: Math.sin(halfPalletAngle),
        z: 0,
        w: Math.cos(halfPalletAngle),
      };
    }
    return this.palletBody.rotation();
  }

  /**
   * Menyemak sama ada palet sedang bertumpu pada garpu secara fizik / terkunci
   */
  public isPalletRestingOnForks(): boolean {
    if (this.isCargoLocked) return true;

    // Jika palet berada stabil di atas tingkat atas rak (Level 2) dan garpu sudah lepas, ia bukan pada garpu
    if (this.isPalletOnRackShelf()) {
      return false;
    }

    const pPos = this.palletBody.translation();
    const fPos = this.forkliftBody.translation();
    const groundOffset = Math.max(0, fPos.y - 0.45);
    const forkY = groundOffset + Math.max(0.04, this.currentForkHeight);

    // Jika garpu berada tepat di bawah palet dan menyokong ketinggiannya
    if (this.isForkUnderPallet(this.currentForkHeight)) {
      if (Math.abs(forkY - pPos.y) < 0.20) {
        return true;
      }
    }

    // Palet terangkat dari lantai gudang (> 10cm) dan berada di kawasan garpu hadapan
    const isElevated = pPos.y > 0.10;
    const dist = Math.hypot(pPos.x - fPos.x, pPos.z - fPos.z);
    return isElevated && dist < 2.8;
  }
}
