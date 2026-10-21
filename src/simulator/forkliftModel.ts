import * as THREE from 'three';
import { createHazardTexture } from './textures.ts';

export interface ForkliftMeshComponents {
  group: THREE.Group;
  mastGroup: THREE.Group;
  forksCarriage: THREE.Group;
  leftRearWheel: THREE.Group;
  rightRearWheel: THREE.Group;
  leftFrontWheel: THREE.Mesh;
  rightFrontWheel: THREE.Mesh;
  beaconLight: THREE.PointLight;
  beaconMesh: THREE.Mesh;
  headlightL: THREE.SpotLight;
  headlightR: THREE.SpotLight;
  shadowDisc: THREE.Mesh;
}

/**
 * Builds a high-realism heavy industrial 3D Forklift model:
 * 1. Industrial Yellow powder-coat enamel body (MeshStandardMaterial with high metalness & tuned roughness)
 * 2. Heavy cast-iron counterweight at rear with towing hitch & radiator louvers
 * 3. Overhead guard (roll cage) crafted from black tubular steel cylinders with overhead cross-bar safety grid
 * 4. Dual-channel heavy steel mast with chrome hydraulic lift cylinders & lower tilt rams
 * 5. Dual forged chrome steel fork tines with heel stoppers & chisel tips
 * 6. Detailed operator cabin with ergonomic seat, steering spinner knob, dashboard dials & hydraulic levers
 * 7. Heavy industrial solid rubber tires with yellow steel wheel hubs and hexagonal lug nuts
 */
export function createForkliftModel(): ForkliftMeshComponents {
  const group = new THREE.Group();
  group.name = 'Forklift';

  // =========================================================================
  // 1. MATERIAL REALISME TINGGI (MeshStandardMaterial PBR)
  // =========================================================================

  // Bodi Utama: Kuning Industri Khas Alat Berat (High-grade powder-coat enamel)
  const industrialYellowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Warna kuning keselamatan industri (Caterpillar / Komatsu style)
    metalness: 0.38,
    roughness: 0.30,
  });

  // Counterweight Belakang: Besi Cor Berat (Heavy Cast Iron)
  const heavyCounterweightMat = new THREE.MeshStandardMaterial({
    color: 0x1f2228,
    metalness: 0.72,
    roughness: 0.58,
  });

  // Sangkar Pelindung Atas (Overhead Guard): Rangka Silinder Keluli Hitam (Tubular Black Steel)
  const tubularSteelMat = new THREE.MeshStandardMaterial({
    color: 0x15171c,
    metalness: 0.78,
    roughness: 0.35,
  });

  // Tiang Mast & Braket Rangka: Keluli Struktur Industri (Gunmetal Steel)
  const mastSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e232a,
    metalness: 0.82,
    roughness: 0.28,
  });

  // Silinder Hidrolik & Bilah Garpu: Keluli Tempa Berkilat (Polished Chrome / Forged Steel)
  const chromeSteelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.16,
  });

  // Bilah Garpu (Forged Steel Tines)
  const forkTinesMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.88,
    roughness: 0.22,
  });

  // Tayar Getah Industri (Solid Heavy-Duty Rubber Tires)
  const solidTireMat = new THREE.MeshStandardMaterial({
    color: 0x121316,
    roughness: 0.88,
    metalness: 0.08,
  });

  // Rim Roda Keluli Industri (Industrial Wheel Rims)
  const wheelHubMat = new THREE.MeshStandardMaterial({
    color: 0xd97706, // Rim kuning oren alat berat
    metalness: 0.45,
    roughness: 0.32,
  });

  const lugNutMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.90,
    roughness: 0.20,
  });

  // Bahan Tempat Duduk & Konsol
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.75,
    metalness: 0.15,
  });

  const hazardTex = createHazardTexture();
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.45,
    metalness: 0.20,
  });

  // =========================================================================
  // 2. BADAN UTAMA KENDERAAN (INDUSTRIAL YELLOW CHASSIS)
  // =========================================================================
  const mainChassisGroup = new THREE.Group();
  mainChassisGroup.name = 'BadanUtamaKuning';

  // Casis Utama (Lower Main Chassis Body)
  const chassisGeo = new THREE.BoxGeometry(1.42, 0.82, 2.35);
  const chassisMesh = new THREE.Mesh(chassisGeo, industrialYellowMat);
  chassisMesh.position.set(0, 0.68, 0.08);
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  mainChassisGroup.add(chassisMesh);

  // Spatbor Roda Depan (Front Wheel Fenders)
  const fenderGeo = new THREE.BoxGeometry(0.24, 0.42, 0.95);
  [-0.72, 0.72].forEach((fx) => {
    const fender = new THREE.Mesh(fenderGeo, industrialYellowMat);
    fender.position.set(fx, 0.65, -0.65);
    fender.castShadow = true;
    mainChassisGroup.add(fender);
  });

  // Panel Pijakan Kaki Operator Kiri & Kanan (Anti-Slip Operator Side Steps)
  const stepGeo = new THREE.BoxGeometry(0.18, 0.05, 0.65);
  [-0.72, 0.72].forEach((sx) => {
    const step = new THREE.Mesh(stepGeo, tubularSteelMat);
    step.position.set(sx, 0.38, 0.15);
    step.castShadow = true;
    mainChassisGroup.add(step);
  });

  // =========================================================================
  // 3. COUNTERWEIGHT BELAKANG (HEAVY CAST-IRON COUNTERWEIGHT)
  // =========================================================================
  const counterweightGroup = new THREE.Group();
  counterweightGroup.name = 'CounterweightBelakang';

  // Blok Utama Counterweight Besi Cor
  const counterweightGeo = new THREE.BoxGeometry(1.42, 0.84, 0.68);
  const counterweightMesh = new THREE.Mesh(counterweightGeo, heavyCounterweightMat);
  counterweightMesh.position.set(0, 0.72, 1.18);
  counterweightMesh.castShadow = true;
  counterweightGroup.add(counterweightMesh);

  // Lengkungan / Kemiringan Atas Counterweight (Chamfered Top Engine Hood Slope)
  const hoodSlopeGeo = new THREE.BoxGeometry(1.36, 0.22, 0.55);
  const hoodSlope = new THREE.Mesh(hoodSlopeGeo, industrialYellowMat);
  hoodSlope.position.set(0, 1.12, 0.95);
  hoodSlope.rotation.x = -Math.PI / 18;
  hoodSlope.castShadow = true;
  counterweightGroup.add(hoodSlope);

  // Kisi-Kisi Ventilasi Udara Enjin Belakang (Engine Cooling Louvers)
  for (let i = 0; i < 3; i++) {
    const ventLouverGeo = new THREE.BoxGeometry(0.92, 0.035, 0.04);
    const vent = new THREE.Mesh(ventLouverGeo, tubularSteelMat);
    vent.position.set(0, 0.88 - i * 0.10, 1.53);
    counterweightGroup.add(vent);
  }

  // Lubang Pin Tunda / Towing Hitch Pin di Tengah Bawah Counterweight
  const hitchSocketGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.16, 16);
  const hitchSocket = new THREE.Mesh(hitchSocketGeo, tubularSteelMat);
  hitchSocket.position.set(0, 0.42, 1.51);
  counterweightGroup.add(hitchSocket);

  // Bampar Belakang dengan Jalur Keselamatan Bahaya (Hazard Stripes Bumper)
  const bumperGeo = new THREE.BoxGeometry(1.44, 0.22, 0.08);
  const bumperMesh = new THREE.Mesh(bumperGeo, hazardMat);
  bumperMesh.position.set(0, 0.42, 1.54);
  counterweightGroup.add(bumperMesh);

  // Paip Ekzos Enjin Industri di Belakang Atas Kiri (Vertical Exhaust Stack)
  const exhaustGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.65, 12);
  const exhaustMesh = new THREE.Mesh(exhaustGeo, tubularSteelMat);
  exhaustMesh.position.set(-0.52, 1.52, 1.15);
  exhaustMesh.castShadow = true;
  counterweightGroup.add(exhaustMesh);

  mainChassisGroup.add(counterweightGroup);

  // =========================================================================
  // 4. SANGKAR PELINDUNG ATAS (OVERHEAD GUARD DARI RANGKA SILINDER HITAM)
  // =========================================================================
  const overheadGuardGroup = new THREE.Group();
  overheadGuardGroup.name = 'SangkarPelindungAtasRangkaSilinder';

  const tubeRadius = 0.042; // Diameter tiub rangka silinder hitam ~84mm

  // A. Tiang Depan Kiri & Kanan (A-Pillars dari silinder hitam bersudut)
  const frontPillarHeight = 1.48;
  const frontPillarGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, frontPillarHeight, 14);

  // Tiang Depan Kiri
  const frontLeftPillar = new THREE.Mesh(frontPillarGeo, tubularSteelMat);
  frontLeftPillar.position.set(-0.58, 1.72, -0.38);
  frontLeftPillar.rotation.x = Math.PI / 36; // Miring sedikit ke belakang
  frontLeftPillar.castShadow = true;
  overheadGuardGroup.add(frontLeftPillar);

  // Tiang Depan Kanan
  const frontRightPillar = new THREE.Mesh(frontPillarGeo, tubularSteelMat);
  frontRightPillar.position.set(0.58, 1.72, -0.38);
  frontRightPillar.rotation.x = Math.PI / 36;
  frontRightPillar.castShadow = true;
  overheadGuardGroup.add(frontRightPillar);

  // B. Tiang Belakang Kiri & Kanan (B-Pillars dari silinder hitam)
  const rearPillarHeight = 1.42;
  const rearPillarGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, rearPillarHeight, 14);

  // Tiang Belakang Kiri
  const rearLeftPillar = new THREE.Mesh(rearPillarGeo, tubularSteelMat);
  rearLeftPillar.position.set(-0.58, 1.75, 0.78);
  rearLeftPillar.castShadow = true;
  overheadGuardGroup.add(rearLeftPillar);

  // Tiang Belakang Kanan
  const rearRightPillar = new THREE.Mesh(rearPillarGeo, tubularSteelMat);
  rearRightPillar.position.set(0.58, 1.75, 0.78);
  rearRightPillar.castShadow = true;
  overheadGuardGroup.add(rearRightPillar);

  // C. Rangka Tiub Perimeter Bumbung Atas (Upper Canopy Perimeter Tubes)
  // Palang Depan Bumbung
  const frontCrossbarGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.16, 12);
  frontCrossbarGeo.rotateZ(Math.PI / 2);
  const frontCrossbar = new THREE.Mesh(frontCrossbarGeo, tubularSteelMat);
  frontCrossbar.position.set(0, 2.45, -0.35);
  overheadGuardGroup.add(frontCrossbar);

  // Palang Belakang Bumbung
  const rearCrossbar = new THREE.Mesh(frontCrossbarGeo, tubularSteelMat);
  rearCrossbar.position.set(0, 2.45, 0.78);
  overheadGuardGroup.add(rearCrossbar);

  // Palang Sisi Kiri Bumbung
  const sideBeamGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.15, 12);
  sideBeamGeo.rotateX(Math.PI / 2);
  const leftSideBeam = new THREE.Mesh(sideBeamGeo, tubularSteelMat);
  leftSideBeam.position.set(-0.58, 2.45, 0.21);
  overheadGuardGroup.add(leftSideBeam);

  // Palang Sisi Kanan Bumbung
  const rightSideBeam = new THREE.Mesh(sideBeamGeo, tubularSteelMat);
  rightSideBeam.position.set(0.58, 2.45, 0.21);
  overheadGuardGroup.add(rightSideBeam);

  // D. Kisi-Kisi Palang Keselamatan Bumbung (Overhead Safety Grille Bar Tubes)
  // 5 palang silinder membujur rapat untuk melindungi kepala operator dari runtuhan kargo
  const grilleTubeRadius = 0.024;
  const grilleTubeGeo = new THREE.CylinderGeometry(grilleTubeRadius, grilleTubeRadius, 1.12, 10);
  grilleTubeGeo.rotateX(Math.PI / 2);

  const grillePositionsX = [-0.42, -0.21, 0, 0.21, 0.42];
  grillePositionsX.forEach((gx) => {
    const grilleBar = new THREE.Mesh(grilleTubeGeo, tubularSteelMat);
    grilleBar.position.set(gx, 2.45, 0.21);
    grilleBar.castShadow = true;
    overheadGuardGroup.add(grilleBar);
  });

  // Plat Pelindung Bumbung Kuning Tipis di Bahagian Depan (Sun Visor)
  const visorGeo = new THREE.BoxGeometry(1.22, 0.04, 0.25);
  const visorMesh = new THREE.Mesh(visorGeo, industrialYellowMat);
  visorMesh.position.set(0, 2.48, -0.28);
  visorMesh.castShadow = true;
  overheadGuardGroup.add(visorMesh);

  mainChassisGroup.add(overheadGuardGroup);

  // =========================================================================
  // 5. KOKPIT OPERATOR (SEAT, STEERING WITH SPINNER KNOB, LEVERS)
  // =========================================================================
  // Tempat Duduk Ergonomik (High-back Bucket Seat)
  const seatBaseGeo = new THREE.BoxGeometry(0.58, 0.18, 0.52);
  const seatBase = new THREE.Mesh(seatBaseGeo, seatMat);
  seatBase.position.set(0, 1.16, 0.38);
  seatBase.castShadow = true;
  mainChassisGroup.add(seatBase);

  const seatBackGeo = new THREE.BoxGeometry(0.56, 0.48, 0.12);
  const seatBack = new THREE.Mesh(seatBackGeo, seatMat);
  seatBack.position.set(0, 1.45, 0.60);
  seatBack.rotation.x = -Math.PI / 24;
  seatBack.castShadow = true;
  mainChassisGroup.add(seatBack);

  // Konsol Papan Pemuka (Dashboard Instrument Binnacle)
  const dashGeo = new THREE.BoxGeometry(0.72, 0.38, 0.28);
  const dashMesh = new THREE.Mesh(dashGeo, tubularSteelMat);
  dashMesh.position.set(0, 1.28, -0.26);
  dashMesh.castShadow = true;
  mainChassisGroup.add(dashMesh);

  // Paparan Skrin Kluster Meter di Dashboard
  const screenGeo = new THREE.PlaneGeometry(0.24, 0.12);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, 1.44, -0.18);
  screenMesh.rotation.x = -Math.PI / 4;
  mainChassisGroup.add(screenMesh);

  // Batang Stereng (Steering Column)
  const columnGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.42, 12);
  columnGeo.rotateX(Math.PI / 4);
  const columnMesh = new THREE.Mesh(columnGeo, tubularSteelMat);
  columnMesh.position.set(0, 1.34, -0.16);
  mainChassisGroup.add(columnMesh);

  // Roda Stereng (Steering Wheel)
  const steeringWheelGeo = new THREE.TorusGeometry(0.18, 0.024, 10, 20);
  const steeringWheelMesh = new THREE.Mesh(steeringWheelGeo, tubularSteelMat);
  steeringWheelMesh.position.set(0, 1.48, -0.12);
  steeringWheelMesh.rotation.x = Math.PI / 4;
  mainChassisGroup.add(steeringWheelMesh);

  // Tombol Pusing Stereng Khas Forklift (Steering Wheel Spinner Knob / Suicide Knob)
  const spinnerGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const spinnerMesh = new THREE.Mesh(spinnerGeo, chromeSteelMat);
  spinnerMesh.position.set(-0.12, 1.58, -0.05);
  mainChassisGroup.add(spinnerMesh);

  // 3 Tuas Hidraulik Kawalan Garpu (Lift, Tilt, Side-Shift Levers)
  [-0.14, -0.06, 0.02].forEach((lx, idx) => {
    const leverRodGeo = new THREE.CylinderGeometry(0.010, 0.010, 0.18, 8);
    leverRodGeo.rotateX(-Math.PI / 12);
    const leverRod = new THREE.Mesh(leverRodGeo, chromeSteelMat);
    leverRod.position.set(0.22 + lx, 1.42, -0.20);

    const knobColor = idx === 0 ? 0xef4444 : 0x1f242d; // Knob merah untuk angkat
    const leverKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshStandardMaterial({ color: knobColor, roughness: 0.3 })
    );
    leverKnob.position.set(0.22 + lx, 1.50, -0.22);
    mainChassisGroup.add(leverRod);
    mainChassisGroup.add(leverKnob);
  });

  group.add(mainChassisGroup);

  // =========================================================================
  // 6. TIANG MAST DEPAN (CLEAR-VIEW DUAL I-BEAM WITH CHROME HYDRAULICS)
  // =========================================================================
  const mastGroup = new THREE.Group();
  mastGroup.name = 'TiangMastDepan';
  mastGroup.position.set(0, 0, -1.08); // Di depan badan kenderaan

  const mastHeight = 2.85;
  const mastRailWidth = 0.11;
  const mastRailDepth = 0.14;
  const mastRailGeo = new THREE.BoxGeometry(mastRailWidth, mastHeight, mastRailDepth);

  // Tiang Kiri Mast (Gunmetal Steel)
  const leftMastRail = new THREE.Mesh(mastRailGeo, mastSteelMat);
  leftMastRail.position.set(-0.52, mastHeight / 2 + 0.1, 0);
  leftMastRail.castShadow = true;
  leftMastRail.receiveShadow = true;
  mastGroup.add(leftMastRail);

  // Tiang Kanan Mast (Gunmetal Steel)
  const rightMastRail = new THREE.Mesh(mastRailGeo, mastSteelMat);
  rightMastRail.position.set(0.52, mastHeight / 2 + 0.1, 0);
  rightMastRail.castShadow = true;
  rightMastRail.receiveShadow = true;
  mastGroup.add(rightMastRail);

  // Dua Tiang Pelindung Dalam (Inner Guide Rails)
  const innerRailGeo = new THREE.BoxGeometry(0.045, mastHeight - 0.15, 0.08);
  [-0.45, 0.45].forEach((ix) => {
    const innerRail = new THREE.Mesh(innerRailGeo, mastSteelMat);
    innerRail.position.set(ix, mastHeight / 2 + 0.1, 0.02);
    mastGroup.add(innerRail);
  });

  // Palang Pengikat Tiang Atas dan Bawah
  const crossBraceGeo = new THREE.BoxGeometry(1.14, 0.09, 0.09);
  const topBrace = new THREE.Mesh(crossBraceGeo, mastSteelMat);
  topBrace.position.set(0, mastHeight + 0.05, 0);
  topBrace.castShadow = true;
  mastGroup.add(topBrace);

  const bottomBrace = new THREE.Mesh(crossBraceGeo, mastSteelMat);
  bottomBrace.position.set(0, 0.20, 0);
  bottomBrace.castShadow = true;
  mastGroup.add(bottomBrace);

  // 2 Silinder Angkat Hidrolik Berkilau Chrome di Sisi Belakang Tiang (Twin Lift Cylinders)
  const cylinderGeo = new THREE.CylinderGeometry(0.038, 0.038, 2.55, 14);
  [-0.40, 0.40].forEach((cx) => {
    const cylinder = new THREE.Mesh(cylinderGeo, chromeSteelMat);
    cylinder.position.set(cx, 1.40, 0.08);
    cylinder.castShadow = true;
    mastGroup.add(cylinder);
  });

  // 2 Silinder Condong di Pangkal Tiang (Tilt Cylinders)
  const tiltCylinderGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.42, 12);
  tiltCylinderGeo.rotateX(Math.PI / 4);
  [-0.46, 0.46].forEach((tx) => {
    const tiltRam = new THREE.Mesh(tiltCylinderGeo, mastSteelMat);
    tiltRam.position.set(tx, 0.38, 0.25);
    mastGroup.add(tiltRam);
  });

  group.add(mastGroup);

  // =========================================================================
  // 7. CARRIAGE FORK BERGERAK & DUA BILAH GARPU KELULI TEMPA
  // =========================================================================
  const forksCarriage = new THREE.Group();
  forksCarriage.name = 'CarriageGarpuBergerak';
  forksCarriage.position.set(0, 0.1, -1.14);

  // Palang Rel Mendatar Atas & Bawah
  const carriageRailGeo = new THREE.BoxGeometry(1.10, 0.09, 0.06);
  const carriageBottomRail = new THREE.Mesh(carriageRailGeo, mastSteelMat);
  carriageBottomRail.position.set(0, 0.10, 0);
  carriageBottomRail.castShadow = true;
  forksCarriage.add(carriageBottomRail);

  const carriageTopRail = new THREE.Mesh(carriageRailGeo, mastSteelMat);
  carriageTopRail.position.set(0, 0.45, 0);
  carriageTopRail.castShadow = true;
  forksCarriage.add(carriageTopRail);

  // Braket Sisi Kerangka Garpu
  const slideBracketGeo = new THREE.BoxGeometry(0.12, 0.46, 0.09);
  [-0.51, 0.51].forEach((bx) => {
    const bracket = new THREE.Mesh(slideBracketGeo, mastSteelMat);
    bracket.position.set(bx, 0.25, 0.05);
    forksCarriage.add(bracket);
  });

  // DUA BILAH GARPU (FORK TINES DARI KELULI TEMPA METALLIC)
  const forkSpacing = 0.35; // Jarak antara dua bilah garpu
  const forkLength = 1.25;  // Panjang garpu membujur ke hadapan

  // Helper membuat satu bilah garpu tempa
  function createForkBlade(isLeft: boolean): THREE.Group {
    const forkGroup = new THREE.Group();
    forkGroup.position.x = isLeft ? -forkSpacing : forkSpacing;

    // Tangkai Tegak (Vertical Shank)
    const shankGeo = new THREE.BoxGeometry(0.11, 0.68, 0.06);
    const shank = new THREE.Mesh(shankGeo, forkTinesMat);
    shank.position.set(0, 0.34, -0.04);
    shank.castShadow = true;
    forkGroup.add(shank);

    // Bilah Mendatar Utama (Horizontal Blade)
    const bladeGeo = new THREE.BoxGeometry(0.115, 0.048, forkLength);
    const blade = new THREE.Mesh(bladeGeo, forkTinesMat);
    blade.position.set(0, 0.024, -forkLength / 2);
    blade.castShadow = true;
    forkGroup.add(blade);

    // Lekukan Penahan Tumit Pangkal (Heel Stopper Ridge)
    const stopperGeo = new THREE.BoxGeometry(0.13, 0.042, 0.08);
    const stopper = new THREE.Mesh(stopperGeo, forkTinesMat);
    stopper.position.set(0, 0.048, -0.035);
    stopper.castShadow = true;
    forkGroup.add(stopper);

    // Hujung Runcing Bilah Depan (Chisel Taper Tip)
    const tipGeo = new THREE.ConeGeometry(0.058, 0.14, 4);
    tipGeo.rotateX(-Math.PI / 2);
    const tip = new THREE.Mesh(tipGeo, forkTinesMat);
    tip.position.set(0, 0.024, -forkLength - 0.06);
    tip.castShadow = true;
    forkGroup.add(tip);

    return forkGroup;
  }

  forksCarriage.add(createForkBlade(true));
  forksCarriage.add(createForkBlade(false));

  group.add(forksCarriage);

  // =========================================================================
  // 8. RODA INDUSTRI SOLID & VELG KUNING DENGAN BAUT LUG NUTS
  // =========================================================================
  // Helper membuat satu roda lengkap dengan ban karet + rim velg + 6 baut roda
  function createDetailedWheel(radius: number, width: number): THREE.Group {
    const wheelGroup = new THREE.Group();

    // 1. Ban Karet Solid Hitam
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, solidTireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // 2. Rim Velg Keluli Kuning Industri di Tengah
    const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.01, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, wheelHubMat);
    wheelGroup.add(rimMesh);

    // 3. Hub Tengah Hitam
    const hubCapGeo = new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width + 0.03, 16);
    hubCapGeo.rotateZ(Math.PI / 2);
    const hubCapMesh = new THREE.Mesh(hubCapGeo, tubularSteelMat);
    wheelGroup.add(hubCapMesh);

    // 4. 6 Baut Roda Logam (Hexagonal Lug Nuts)
    const lugNutGeo = new THREE.CylinderGeometry(0.016, 0.016, width + 0.04, 6);
    lugNutGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const lx = Math.cos(angle) * (radius * 0.44);
      const ly = Math.sin(angle) * (radius * 0.44);
      const nut = new THREE.Mesh(lugNutGeo, lugNutMat);
      nut.position.set(0, ly, lx);
      wheelGroup.add(nut);
    }

    return wheelGroup;
  }

  // Roda Depan Kiri & Kanan (Drive Wheels - radius 0.38m)
  const leftFrontWheelGroup = createDetailedWheel(0.38, 0.26);
  leftFrontWheelGroup.position.set(-0.73, 0.38, -0.65);
  // Simpan mesh utama untuk integrasi putaran roda visual
  const leftFrontWheelMesh = leftFrontWheelGroup.children[0] as THREE.Mesh;
  group.add(leftFrontWheelGroup);

  const rightFrontWheelGroup = createDetailedWheel(0.38, 0.26);
  rightFrontWheelGroup.position.set(0.73, 0.38, -0.65);
  const rightFrontWheelMesh = rightFrontWheelGroup.children[0] as THREE.Mesh;
  group.add(rightFrontWheelGroup);

  // Roda Belakang Kiri & Kanan (Steer Wheels - radius 0.32m boleh belok yaw)
  const leftRearWheel = createDetailedWheel(0.32, 0.22);
  leftRearWheel.position.set(-0.66, 0.32, 0.88);
  group.add(leftRearWheel);

  const rightRearWheel = createDetailedWheel(0.32, 0.22);
  rightRearWheel.position.set(0.66, 0.32, 0.88);
  group.add(rightRearWheel);

  // =========================================================================
  // 9. LAMPU KESELAMATAN: BEACON KUNING BERKELIP & HEADLIGHTS HALOGEN
  // =========================================================================
  // Lampu Beacon Putar di Atas Bumbung
  const beaconBaseGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14);
  const beaconBase = new THREE.Mesh(beaconBaseGeo, tubularSteelMat);
  beaconBase.position.set(0, 2.52, 0.22);
  group.add(beaconBase);

  const beaconDomeGeo = new THREE.SphereGeometry(0.095, 14, 12);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
    roughness: 0.15,
  });
  const beaconMesh = new THREE.Mesh(beaconDomeGeo, beaconMat);
  beaconMesh.position.set(0, 2.60, 0.22);
  group.add(beaconMesh);

  const beaconLight = new THREE.PointLight(0xf59e0b, 1.4, 6.0);
  beaconLight.position.set(0, 2.65, 0.22);
  group.add(beaconLight);

  // Lampu Hadapan Berkembar (Dual LED/Halogen Work Headlights)
  const lightHousingGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.09, 14);
  lightHousingGeo.rotateX(Math.PI / 2);
  const lightGlassMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  [-0.48, 0.48].forEach((lx) => {
    const lampHousing = new THREE.Mesh(lightHousingGeo, tubularSteelMat);
    lampHousing.position.set(lx, 1.42, -1.02);
    const lampGlass = new THREE.Mesh(new THREE.CircleGeometry(0.068, 14), lightGlassMat);
    lampGlass.position.set(lx, 1.42, -1.07);
    group.add(lampHousing);
    group.add(lampGlass);
  });

  const headlightL = new THREE.SpotLight(0xffedd5, 4.2, 24, Math.PI / 5.5, 0.35, 1.4);
  headlightL.position.set(-0.48, 1.42, -1.06);
  const targetL = new THREE.Object3D();
  targetL.position.set(-0.48, 0.2, -14);
  group.add(targetL);
  headlightL.target = targetL;
  group.add(headlightL);

  const headlightR = new THREE.SpotLight(0xffedd5, 4.2, 24, Math.PI / 5.5, 0.35, 1.4);
  headlightR.position.set(0.48, 1.42, -1.06);
  const targetR = new THREE.Object3D();
  targetR.position.set(0.48, 0.2, -14);
  group.add(targetR);
  headlightR.target = targetR;
  group.add(headlightR);

  // Bayang Lembut di Bawah Forklift (Contact Grounding Shadow Disc)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.72)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
  });
  const shadowGeo = new THREE.PlaneGeometry(2.6, 3.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  return {
    group,
    mastGroup,
    forksCarriage,
    leftRearWheel,
    rightRearWheel,
    leftFrontWheel: leftFrontWheelMesh,
    rightFrontWheel: rightFrontWheelMesh,
    beaconLight,
    beaconMesh,
    headlightL,
    headlightR,
    shadowDisc,
  };
}
