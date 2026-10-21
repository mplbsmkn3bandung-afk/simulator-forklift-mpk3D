import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createWarehouseFloorTexture,
  createHazardTexture,
  createCardboardTexture,
  createDropZoneFloorTexture,
  createShelfDropZoneTexture,
  createIndustrialWarningTapeTexture,
} from './textures.ts';
import type { CargoItem, DropZone } from './types.ts';
import type { ObstacleBox } from './physics.ts';
import { getLevel5TrackHeight, getLevel5RampSurfaceHeight } from './physicsRapier.ts';

export interface WarehouseEnvironment {
  scene: THREE.Scene;
  obstacles: ObstacleBox[];
  cargoMeshes: Map<string, THREE.Group>;
  targetPalletMesh: THREE.Group;
  targetMarkerMesh?: THREE.Mesh;
  dropZoneMesh: THREE.Group;
  dropZoneShelfMesh?: THREE.Group;
  dropZoneBeacon?: THREE.Group;
  dropZoneShelfBeacon?: THREE.Group;
  dropZoneLight?: THREE.PointLight;
  dropZoneShelfLight?: THREE.PointLight;
  dropZone: DropZone;
  palletRackMesh?: THREE.Group;
  cargos: CargoItem[];
  setDropZoneLevel: (level: 1 | 2 | 3 | 4 | 5) => void;
  dispose: () => void;
}

export function createWarehouseScene(renderer: THREE.WebGLRenderer): WarehouseEnvironment {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x181a1f);
  scene.fog = new THREE.FogExp2(0x181a1f, 0.015);

  // 1. Studio PMREM Environment Map
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();
  } catch {
    // Fallback if headless WebGL fails PMREM
  }

  // 2. Lighting Rig
  // Cool hemisphere fill
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1f242d, 0.9);
  hemiLight.position.set(0, 30, 0);
  scene.add(hemiLight);

  // Warm key light
  const keyLight = new THREE.DirectionalLight(0xffedd5, 1.4);
  keyLight.position.set(15, 25, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -26;
  keyLight.shadow.camera.right = 26;
  keyLight.shadow.camera.top = 30;
  keyLight.shadow.camera.bottom = -30;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  // Soft warehouse ambient
  const ambient = new THREE.AmbientLight(0x272c36, 0.5);
  scene.add(ambient);

  // High bay industrial roof lights (point lights with visual lamp caps)
  const highBayPositions = [
    [-12, 11, -14],
    [12, 11, -14],
    [-12, 11, 14],
    [12, 11, 14],
    [0, 11, 0],
  ];

  const lampCapGeo = new THREE.ConeGeometry(0.6, 0.35, 12, 1, true);
  const lampCapMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  highBayPositions.forEach(([hx, hy, hz]) => {
    const lamp = new THREE.Mesh(lampCapGeo, lampCapMat);
    lamp.position.set(hx, hy, hz);
    scene.add(lamp);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), bulbMat);
    bulb.position.set(hx, hy - 0.1, hz);
    scene.add(bulb);

    const pLight = new THREE.PointLight(0xfef08a, 0.8, 22, 1.2);
    pLight.position.set(hx, hy - 0.25, hz);
    scene.add(pLight);
  });

  // 3. Flat Warehouse Floor with Grid Texture
  const floorGeo = new THREE.PlaneGeometry(50, 60);
  floorGeo.rotateX(-Math.PI / 2);

  const floorTexture = createWarehouseFloorTexture();
  floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0x22262d, // Dark grey concrete base tone
    roughness: 0.75,
    metalness: 0.12,
  });
  // Prevent coplanar z-fighting
  floorMat.polygonOffset = true;
  floorMat.polygonOffsetFactor = 1;
  floorMat.polygonOffsetUnits = 1;

  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // 4. Warehouse Walls (Industrial corrugated concrete/steel)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x272c36,
    roughness: 0.85,
    metalness: 0.1,
  });
  const wallHeight = 12;

  // Back Wall (+Z)
  const backWallGeo = new THREE.BoxGeometry(50, wallHeight, 0.6);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, wallHeight / 2, 30);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Front Wall (-Z)
  const frontWall = new THREE.Mesh(backWallGeo, wallMat);
  frontWall.position.set(0, wallHeight / 2, -30);
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  // Left Wall (-X)
  const sideWallGeo = new THREE.BoxGeometry(0.6, wallHeight, 60);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-25, wallHeight / 2, 0);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right Wall (+X)
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(25, wallHeight / 2, 0);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Wall base kickboards with hazard stripes
  const hazardTex = createHazardTexture();
  const kickboardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
  const kickboardZGeo = new THREE.BoxGeometry(50, 0.4, 0.1);
  const kickBack = new THREE.Mesh(kickboardZGeo, kickboardMat);
  kickBack.position.set(0, 0.2, 29.6);
  scene.add(kickBack);

  const kickFront = new THREE.Mesh(kickboardZGeo, kickboardMat);
  kickFront.position.set(0, 0.2, -29.6);
  scene.add(kickFront);

  // Warehouse Columns / Pillars
  const pillarGeo = new THREE.BoxGeometry(1.2, wallHeight, 1.2);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.5 });
  const pillarPositions = [
    [-12, -10],
    [-12, 10],
    [12, -10],
    [12, 10],
  ];

  const obstacles: ObstacleBox[] = [];

  pillarPositions.forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, wallHeight / 2, pz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);

    // Hazard stripes band on pillar base
    const bandGeo = new THREE.BoxGeometry(1.25, 0.8, 1.25);
    const band = new THREE.Mesh(bandGeo, kickboardMat);
    band.position.set(px, 0.4, pz);
    scene.add(band);

    obstacles.push({
      minX: px - 0.7,
      maxX: px + 0.7,
      minZ: pz - 0.7,
      maxZ: pz + 0.7,
    });
  });

  // =========================================================================
  // 4B. MARKA K3 LANTAI GUDANG (OCCUPATIONAL SAFETY & HEALTH FLOOR MARKINGS)
  // =========================================================================
  const k3MarkingsGroup = new THREE.Group();
  k3MarkingsGroup.name = 'MarkaK3LantaiGudang';

  // A. Bahan Garis Marka K3 Kuning (Jalur Lintasan Forklift Aman)
  const k3YellowLineMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Kuning keselamatan K3 (OSHA Safety Yellow)
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.15,
  });
  k3YellowLineMat.polygonOffset = true;
  k3YellowLineMat.polygonOffsetFactor = -1.5;
  k3YellowLineMat.polygonOffsetUnits = -1.5;

  // B. Bahan Garis Marka K3 Merah (Area Rintangan / Bahaya / Tiang Pilar)
  const k3RedHazardMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Merah bahaya K3 (OSHA Safety Red)
    emissive: 0xb91c1c,
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.15,
  });
  k3RedHazardMat.polygonOffset = true;
  k3RedHazardMat.polygonOffsetFactor = -1.8;
  k3RedHazardMat.polygonOffsetUnits = -1.8;

  const k3LineWidth = 0.14; // Lebar garis marka 14cm standar industri

  // 1. GARIS KUNING: Pembatas Jalur Lintasan Aman Utama (Main Transit Corridors)
  // Koridor Memanjang Sumbu Z (x = -3.4 dan x = 3.4 dari z = -25 hingga z = 25)
  [-3.4, 3.4].forEach((lx) => {
    const lineGeo = new THREE.PlaneGeometry(k3LineWidth, 50.0).rotateX(-Math.PI / 2);
    const lineMesh = new THREE.Mesh(lineGeo, k3YellowLineMat);
    lineMesh.position.set(lx, 0.015, 0);
    lineMesh.receiveShadow = true;
    k3MarkingsGroup.add(lineMesh);
  });

  // Koridor Melintang Sumbu X (Jalur Penghubung Antar Rak)
  [-12.0, 4.0, 18.0].forEach((lz) => {
    // Sisi kiri koridor
    const crossGeoL = new THREE.PlaneGeometry(18.0, k3LineWidth).rotateX(-Math.PI / 2);
    const crossMeshL = new THREE.Mesh(crossGeoL, k3YellowLineMat);
    crossMeshL.position.set(-13.0, 0.015, lz);
    crossMeshL.receiveShadow = true;
    k3MarkingsGroup.add(crossMeshL);

    // Sisi kanan koridor
    const crossGeoR = new THREE.PlaneGeometry(18.0, k3LineWidth).rotateX(-Math.PI / 2);
    const crossMeshR = new THREE.Mesh(crossGeoR, k3YellowLineMat);
    crossMeshR.position.set(13.0, 0.015, lz);
    crossMeshR.receiveShadow = true;
    k3MarkingsGroup.add(crossMeshR);
  });

  // Jalur Penyeberangan Zebra (Pedestrian Crossing Hatching) di zona aman
  for (let zx = -3.2; zx <= 3.2; zx += 0.55) {
    const zebraGeo = new THREE.PlaneGeometry(0.28, 1.6).rotateX(-Math.PI / 2);
    const zebraMesh = new THREE.Mesh(zebraGeo, k3YellowLineMat);
    zebraMesh.position.set(zx, 0.016, 0);
    zebraMesh.receiveShadow = true;
    k3MarkingsGroup.add(zebraMesh);
  }

  // 2. GARIS MERAH: Pembatas Area Rintangan & Bahaya di Sekitar Tiang Pilar
  pillarPositions.forEach(([px, pz]) => {
    const boxSize = 2.4; // Batas perimeter bahaya 2.4m x 2.4m mengelilingi tiang pilar
    const halfBox = boxSize / 2;

    // 4 Garis Sisi Merah Pembatas Kotak Bahaya
    const redHGeo = new THREE.PlaneGeometry(boxSize, k3LineWidth).rotateX(-Math.PI / 2);
    const redNorth = new THREE.Mesh(redHGeo, k3RedHazardMat);
    redNorth.position.set(px, 0.017, pz - halfBox);
    k3MarkingsGroup.add(redNorth);

    const redSouth = new THREE.Mesh(redHGeo, k3RedHazardMat);
    redSouth.position.set(px, 0.017, pz + halfBox);
    k3MarkingsGroup.add(redSouth);

    const redVGeo = new THREE.PlaneGeometry(k3LineWidth, boxSize).rotateX(-Math.PI / 2);
    const redWest = new THREE.Mesh(redVGeo, k3RedHazardMat);
    redWest.position.set(px - halfBox, 0.017, pz);
    k3MarkingsGroup.add(redWest);

    const redEast = new THREE.Mesh(redVGeo, k3RedHazardMat);
    redEast.position.set(px + halfBox, 0.017, pz);
    k3MarkingsGroup.add(redEast);

    // Garis Silang Diagonal Bahaya (Diagonal Hazard Hatching Merah)
    const diagGeo = new THREE.PlaneGeometry(k3LineWidth, boxSize * 1.35).rotateX(-Math.PI / 2);
    const diagMesh1 = new THREE.Mesh(diagGeo, k3RedHazardMat);
    diagMesh1.position.set(px, 0.0175, pz);
    diagMesh1.rotation.y = Math.PI / 4;
    k3MarkingsGroup.add(diagMesh1);

    const diagMesh2 = new THREE.Mesh(diagGeo, k3RedHazardMat);
    diagMesh2.position.set(px, 0.0175, pz);
    diagMesh2.rotation.y = -Math.PI / 4;
    k3MarkingsGroup.add(diagMesh2);
  });

  scene.add(k3MarkingsGroup);

  // Roof Industrial Steel Trusses
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
  for (let z = -24; z <= 24; z += 12) {
    const beamGeo = new THREE.BoxGeometry(50, 0.6, 0.4);
    const beam = new THREE.Mesh(beamGeo, trussMat);
    beam.position.set(0, 11.5, z);
    scene.add(beam);
  }

  // 5. Heavy Industrial Storage Pallet Racks (Pallet Racking System)
  const rackSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8, // Industrial safety blue uprights
    roughness: 0.35,
    metalness: 0.55,
  });
  const rackFootMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Dark steel base footplates firmly grounded on floor
    roughness: 0.7,
    metalness: 0.4,
  });
  const rackBeamMat = new THREE.MeshStandardMaterial({
    color: 0xf97316, // Safety orange load beams
    roughness: 0.35,
    metalness: 0.45,
  });
  const rackDeckMat = new THREE.MeshStandardMaterial({
    color: 0x475569, // Steel decking shelves
    roughness: 0.45,
    metalness: 0.6,
  });
  const rackBraceMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.4,
    metalness: 0.5,
  });

  const uprightGeo = new THREE.BoxGeometry(0.10, 5.2, 0.10);
  const footplateGeo = new THREE.BoxGeometry(0.22, 0.02, 0.22);

  function createIndustrialPalletRack(
    x: number,
    z: number,
    length: number,
    axis: 'Z' | 'X',
    depth: number = 1.4,
    height: number = 5.2,
    parentGroup?: THREE.Group
  ): THREE.Group {
    const rackGroup = new THREE.Group();
    rackGroup.position.set(x, 0, z);

    const halfD = depth / 2 - 0.05;
    const bayStep = 2.8;
    const numBays = Math.max(1, Math.round(length / bayStep));
    const actualStep = length / numBays;

    const tierHeights = [1.4, 3.0, 4.6];

    if (axis === 'Z') {
      // 1. Tiang Menegak (Uprights) dan Tapak Kaki (Footplates) di sepanjang paksi Z
      for (let i = 0; i <= numBays; i++) {
        const cz = -length / 2 + i * actualStep;

        [-halfD, halfD].forEach((cx) => {
          const col = new THREE.Mesh(uprightGeo, rackSteelMat);
          col.position.set(cx, height / 2, cz);
          col.castShadow = true;
          col.receiveShadow = true;
          rackGroup.add(col);

          const foot = new THREE.Mesh(footplateGeo, rackFootMat);
          foot.position.set(cx, 0.01, cz);
          foot.receiveShadow = true;
          rackGroup.add(foot);
        });

        // Pendakap palang sisi antara tiang
        [0.7, 2.2, 3.8, height - 0.1].forEach((by) => {
          const brace = new THREE.Mesh(new THREE.BoxGeometry(depth - 0.1, 0.04, 0.04), rackBraceMat);
          brace.position.set(0, by, cz);
          rackGroup.add(brace);
        });
      }

      // 2. Balok Oren Beban tepat selari paksi Z (Tiada herotan / garisan melayang!)
      const beamGeo = new THREE.BoxGeometry(0.08, 0.14, length);
      const shelfGeo = new THREE.BoxGeometry(depth - 0.14, 0.04, length);

      tierHeights.forEach((ty) => {
        const bF = new THREE.Mesh(beamGeo, rackBeamMat);
        bF.position.set(halfD, ty, 0);
        bF.castShadow = true;
        rackGroup.add(bF);

        const bR = new THREE.Mesh(beamGeo, rackBeamMat);
        bR.position.set(-halfD, ty, 0);
        bR.castShadow = true;
        rackGroup.add(bR);

        const deck = new THREE.Mesh(shelfGeo, rackDeckMat);
        deck.position.set(0, ty + 0.02, 0);
        deck.receiveShadow = true;
        rackGroup.add(deck);
      });

      obstacles.push({
        minX: x - depth / 2 - 0.2,
        maxX: x + depth / 2 + 0.2,
        minZ: z - length / 2 - 0.2,
        maxZ: z + length / 2 + 0.2,
      });
    } else {
      // 1. Tiang Menegak dan Tapak Kaki di sepanjang paksi X
      for (let i = 0; i <= numBays; i++) {
        const cx = -length / 2 + i * actualStep;

        [-halfD, halfD].forEach((cz) => {
          const col = new THREE.Mesh(uprightGeo, rackSteelMat);
          col.position.set(cx, height / 2, cz);
          col.castShadow = true;
          col.receiveShadow = true;
          rackGroup.add(col);

          const foot = new THREE.Mesh(footplateGeo, rackFootMat);
          foot.position.set(cx, 0.01, cz);
          foot.receiveShadow = true;
          rackGroup.add(foot);
        });

        [0.7, 2.2, 3.8, height - 0.1].forEach((by) => {
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, depth - 0.1), rackBraceMat);
          brace.position.set(cx, by, 0);
          rackGroup.add(brace);
        });
      }

      // 2. Balok Oren Beban tepat selari paksi X
      const beamGeo = new THREE.BoxGeometry(length, 0.14, 0.08);
      const shelfGeo = new THREE.BoxGeometry(length, 0.04, depth - 0.14);

      tierHeights.forEach((ty) => {
        const bF = new THREE.Mesh(beamGeo, rackBeamMat);
        bF.position.set(0, ty, halfD);
        bF.castShadow = true;
        rackGroup.add(bF);

        const bR = new THREE.Mesh(beamGeo, rackBeamMat);
        bR.position.set(0, ty, -halfD);
        bR.castShadow = true;
        rackGroup.add(bR);

        const deck = new THREE.Mesh(shelfGeo, rackDeckMat);
        deck.position.set(0, ty + 0.02, 0);
        deck.receiveShadow = true;
        rackGroup.add(deck);
      });

      obstacles.push({
        minX: x - length / 2 - 0.2,
        maxX: x + length / 2 + 0.2,
        minZ: z - depth / 2 - 0.2,
        maxZ: z + depth / 2 + 0.2,
      });
    }

    if (parentGroup) {
      parentGroup.add(rackGroup);
    } else {
      scene.add(rackGroup);
    }
    return rackGroup;
  }

  // Barisan Rak Latar Belakang Gudang (Perimeter Aisles)
  createIndustrialPalletRack(-18, -4, 16, 'Z');
  createIndustrialPalletRack(-18, 16, 12, 'Z');
  createIndustrialPalletRack(18, -4, 16, 'Z');
  createIndustrialPalletRack(18, 16, 12, 'Z');

  // 5C. LORONG SEMPIT BERBENTUK 'L' (Level 3 L-Shaped Narrow Aisle Racks)
  const level3RacksGroup = new THREE.Group();
  level3RacksGroup.name = 'Level3LShapedAisle';
  scene.add(level3RacksGroup);

  createIndustrialPalletRack(3.5, 12.9, 6.2, 'Z', 1.4, 5.2, level3RacksGroup);
  createIndustrialPalletRack(8.5, 13.4, 16.2, 'Z', 1.4, 5.2, level3RacksGroup);
  createIndustrialPalletRack(2.35, 5.3, 13.7, 'X', 1.4, 5.2, level3RacksGroup);
  createIndustrialPalletRack(-0.15, 10.5, 8.7, 'X', 1.4, 5.2, level3RacksGroup);

  createNarrowAisleDecorations(level3RacksGroup, kickboardMat);
  level3RacksGroup.visible = false;

  // 5D. RINTANGAN ZIG-ZAG STATIK LEVEL 4 (Tong Drum & Kotak Kargo)
  const level4ObstaclesGroup = new THREE.Group();
  level4ObstaclesGroup.name = 'Level4ZigZagObstacles';
  scene.add(level4ObstaclesGroup);

  // Helper membina tong drum industri (200L Steel Drum)
  function createIndustrialDrum(x: number, z: number, colorHex: number = 0xea580c): THREE.Group {
    const drum = new THREE.Group();
    drum.position.set(x, 0, z);

    const radius = 0.35;
    const height = 0.95;
    const drumMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.45,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.6,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 18), drumMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    drum.add(body);

    const ribGeo = new THREE.CylinderGeometry(radius + 0.015, radius + 0.015, 0.04, 18);
    [0.32, 0.63].forEach((ry) => {
      const rib = new THREE.Mesh(ribGeo, drumMat);
      rib.position.y = ry;
      drum.add(rib);
    });

    const rimGeo = new THREE.CylinderGeometry(radius + 0.012, radius + 0.012, 0.03, 18);
    const topRim = new THREE.Mesh(rimGeo, rimMat);
    topRim.position.y = height;
    drum.add(topRim);

    const botRim = new THREE.Mesh(rimGeo, rimMat);
    botRim.position.y = 0.015;
    drum.add(botRim);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.005, radius + 0.005, 0.20, 18), stripeMat);
    stripe.position.y = 0.48;
    drum.add(stripe);

    return drum;
  }

  // Helper membina kotak kargo kayu/keluli berat (Heavy Cargo Crate)
  function createCargoCrate(x: number, z: number, w: number, h: number, d: number): THREE.Group {
    const crate = new THREE.Group();
    crate.position.set(x, h / 2, z);

    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat);
    body.castShadow = true;
    body.receiveShadow = true;
    crate.add(body);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.5 });
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.02), frameMat);
    topCap.position.y = h / 2;
    crate.add(topCap);

    const botCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.02), frameMat);
    botCap.position.y = -h / 2 + 0.025;
    crate.add(botCap);

    return crate;
  }

  // Helper membina kerucut lalu lintas keselamatan (Safety Traffic Cone)
  function createTrafficCone(x: number, z: number): THREE.Group {
    const cone = new THREE.Group();
    cone.position.set(x, 0, z);

    // Tapak getah hitam
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.8,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), baseMat);
    base.position.y = 0.02;
    base.castShadow = true;
    base.receiveShadow = true;
    cone.add(base);

    // Kon oren terang keselamatan
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.35,
      metalness: 0.1,
    });
    const coneBody = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 16), coneMat);
    coneBody.position.y = 0.04 + 0.36;
    coneBody.castShadow = true;
    coneBody.receiveShadow = true;
    cone.add(coneBody);

    // Pita pemantul cahaya putih
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.09, 16), stripeMat);
    s1.position.y = 0.34;
    cone.add(s1);

    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 16), stripeMat);
    s2.position.y = 0.50;
    cone.add(s2);

    return cone;
  }

  // 4 Kelompok rintangan zig-zag menuju Drop Zone (z = 18.0):
  // Rintangan 1 (z = -11.0, sekat kiri x = -6.0 ke +0.5, laluan terbuka di KANAN x = 1.6 ke 5.5):
  level4ObstaclesGroup.add(createCargoCrate(-4.8, -11.0, 1.4, 1.2, 1.2));
  level4ObstaclesGroup.add(createCargoCrate(-3.2, -11.0, 1.2, 1.0, 1.2));
  level4ObstaclesGroup.add(createIndustrialDrum(-1.8, -11.0, 0xea580c));
  level4ObstaclesGroup.add(createIndustrialDrum(-0.6, -11.0, 0xd92626));
  level4ObstaclesGroup.add(createIndustrialDrum(0.4, -11.0, 0xea580c));
  level4ObstaclesGroup.add(createTrafficCone(1.1, -11.0));
  level4ObstaclesGroup.add(createTrafficCone(1.1, -10.2));

  // Rintangan 2 (z = -3.5, sekat kanan x = -0.5 ke +6.0, laluan terbuka di KIRI x = -5.5 ke -1.6):
  level4ObstaclesGroup.add(createTrafficCone(-1.1, -3.5));
  level4ObstaclesGroup.add(createTrafficCone(-1.1, -2.7));
  level4ObstaclesGroup.add(createIndustrialDrum(-0.4, -3.5, 0xd92626));
  level4ObstaclesGroup.add(createIndustrialDrum(0.6, -3.5, 0xea580c));
  level4ObstaclesGroup.add(createIndustrialDrum(1.8, -3.5, 0xd92626));
  level4ObstaclesGroup.add(createCargoCrate(3.2, -3.5, 1.2, 1.0, 1.2));
  level4ObstaclesGroup.add(createCargoCrate(4.8, -3.5, 1.4, 1.2, 1.2));

  // Rintangan 3 (z = 4.0, sekat kiri x = -6.0 ke +0.5, laluan terbuka di KANAN x = 1.6 ke 5.5):
  level4ObstaclesGroup.add(createCargoCrate(-4.8, 4.0, 1.4, 1.2, 1.2));
  level4ObstaclesGroup.add(createCargoCrate(-3.2, 4.0, 1.2, 1.0, 1.2));
  level4ObstaclesGroup.add(createIndustrialDrum(-1.8, 4.0, 0xea580c));
  level4ObstaclesGroup.add(createIndustrialDrum(-0.6, 4.0, 0xd92626));
  level4ObstaclesGroup.add(createIndustrialDrum(0.4, 4.0, 0xea580c));
  level4ObstaclesGroup.add(createTrafficCone(1.1, 4.0));
  level4ObstaclesGroup.add(createTrafficCone(1.1, 4.8));

  // Rintangan 4 (z = 11.5, sekat kanan x = -0.5 ke +6.0, laluan terbuka di KIRI x = -5.5 ke -1.6):
  level4ObstaclesGroup.add(createTrafficCone(-1.1, 11.5));
  level4ObstaclesGroup.add(createTrafficCone(-1.1, 12.3));
  level4ObstaclesGroup.add(createIndustrialDrum(-0.4, 11.5, 0xd92626));
  level4ObstaclesGroup.add(createIndustrialDrum(0.6, 11.5, 0xea580c));
  level4ObstaclesGroup.add(createIndustrialDrum(1.8, 11.5, 0xd92626));
  level4ObstaclesGroup.add(createCargoCrate(3.2, 11.5, 1.2, 1.0, 1.2));
  level4ObstaclesGroup.add(createCargoCrate(4.8, 11.5, 1.4, 1.2, 1.2));

  // Kon panduan sempadan selekoh laluan (Lane boundary cones)
  level4ObstaclesGroup.add(createTrafficCone(5.8, -7.5));
  level4ObstaclesGroup.add(createTrafficCone(-5.8, 0.0));
  level4ObstaclesGroup.add(createTrafficCone(5.8, 7.5));
  level4ObstaclesGroup.add(createTrafficCone(-5.8, 15.0));

  // 5E. PANDUAN LINTASAN ZIG-ZAG LANTAI LEVEL 4 (Lakban Kuning Industri / Warning Tape)
  const warningTapeTex = createIndustrialWarningTapeTexture();
  warningTapeTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const zigZagGuideGroup = createLevel4ZigZagFloorGuide(warningTapeTex);
  level4ObstaclesGroup.add(zigZagGuideGroup);

  level4ObstaclesGroup.visible = false;

  // 5F. PLATFORM LOADING DOCK & TANJAKAN (RAMP) LEVEL 5
  const level5DockGroup = createLevel5LoadingDockEnvironment(hazardTex, kickboardMat);
  scene.add(level5DockGroup);
  level5DockGroup.visible = false;

  // 5B. RAK GUDANG 2 TINGKAT (Level 2 Pallet Rack Object)
  // Memiliki 2 tingkat: permukaan lantai dasar dan satu tingkat di atasnya (para rak solid y = 1.30m - 1.36m).
  // Diletakkan di kawasan lapang (x: -8.0, z: -15.0) dengan bukaan depan menghadap +Z agar forklift leluasa bermanuver.
  const palletRackX = -8.0;
  const palletRackZ = -15.0;
  const palletRackMesh = createTwoTierPalletRackMesh(palletRackX, palletRackZ, kickboardMat);
  scene.add(palletRackMesh);

  // Daftarkan kotak rintangan sisi & belakang tiang rak ke sistem pengesanan halangan
  obstacles.push(
    // Tiang sisi kiri
    { minX: palletRackX - 1.45, maxX: palletRackX - 1.15, minZ: palletRackZ - 0.75, maxZ: palletRackZ + 0.75 },
    // Tiang sisi kanan
    { minX: palletRackX + 1.15, maxX: palletRackX + 1.45, minZ: palletRackZ - 0.75, maxZ: palletRackZ + 0.75 },
    // Palang belakang
    { minX: palletRackX - 1.35, maxX: palletRackX + 1.35, minZ: palletRackZ - 0.75, maxZ: palletRackZ - 0.55 }
  );

  // 6. Area Pengiriman (Drop Zone Level 1) - Kotak & Garis Berwarna Hijau Terang
  // Diletakkan agak jauh dari posisi awal palet kayu (0, 0, -2.5) -> (10, 0, -17)
  const dropZone: DropZone = {
    x: 10,
    z: -17,
    width: 5.5,
    depth: 5.5,
    name: 'AREA PENGIRIMAN LEVEL 1',
  };

  const dropZoneMesh = new THREE.Group();
  dropZoneMesh.position.set(dropZone.x, 0.02, dropZone.z);

  // A. Lantai Kotak Hijau Terang (Bright Green Floor Decal with stencils & markings)
  const dropZoneFloorTex = createDropZoneFloorTexture();
  dropZoneFloorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const dropPlateGeo = new THREE.PlaneGeometry(dropZone.width, dropZone.depth);
  dropPlateGeo.rotateX(-Math.PI / 2);
  const dropPlateMat = new THREE.MeshStandardMaterial({
    map: dropZoneFloorTex,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.95,
  });
  // Elakkan z-fighting dengan lantai gudang
  dropPlateMat.polygonOffset = true;
  dropPlateMat.polygonOffsetFactor = -2;
  dropPlateMat.polygonOffsetUnits = -2;

  const dropPlate = new THREE.Mesh(dropPlateGeo, dropPlateMat);
  dropPlate.receiveShadow = true;
  dropZoneMesh.add(dropPlate);

  // B. Garis Perimeter Berwarna Hijau Terang (High-Visibility Glowing Green Border Lines)
  const brightGreenLineMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.15,
  });

  const borderThick = 0.18;
  const borderHeight = 0.05;
  const borderGeoX = new THREE.BoxGeometry(dropZone.width + borderThick, borderHeight, borderThick);
  const borderGeoZ = new THREE.BoxGeometry(borderThick, borderHeight, dropZone.depth + borderThick);

  const borderN = new THREE.Mesh(borderGeoX, brightGreenLineMat);
  borderN.position.set(0, borderHeight / 2, -dropZone.depth / 2);
  borderN.receiveShadow = true;
  dropZoneMesh.add(borderN);

  const borderS = new THREE.Mesh(borderGeoX, brightGreenLineMat);
  borderS.position.set(0, borderHeight / 2, dropZone.depth / 2);
  borderS.receiveShadow = true;
  dropZoneMesh.add(borderS);

  const borderW = new THREE.Mesh(borderGeoZ, brightGreenLineMat);
  borderW.position.set(-dropZone.width / 2, borderHeight / 2, 0);
  borderW.receiveShadow = true;
  dropZoneMesh.add(borderW);

  const borderE = new THREE.Mesh(borderGeoZ, brightGreenLineMat);
  borderE.position.set(dropZone.width / 2, borderHeight / 2, 0);
  borderE.receiveShadow = true;
  dropZoneMesh.add(borderE);

  // C. Tiang Penanda Sudut Berpendar Hijau Neon (4 Corner Glowing Pylons)
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    emissive: 0x22c55e,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const capMat = new THREE.MeshBasicMaterial({ color: 0x86efac });
  const pylonGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10);
  const capGeo = new THREE.SphereGeometry(0.11, 8, 8);

  const halfW = dropZone.width / 2;
  const halfD = dropZone.depth / 2;
  [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ].forEach(([cx, cz]) => {
    const pylon = new THREE.Mesh(pylonGeo, pylonMat);
    pylon.position.set(cx, 0.25, cz);
    pylon.castShadow = true;
    dropZoneMesh.add(pylon);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(cx, 0.5, cz);
    dropZoneMesh.add(cap);
  });

  // D. Penunjuk Suar Terapung di Udara (Floating Holographic Drop Beacon)
  const dropZoneBeacon = new THREE.Group();
  dropZoneBeacon.position.set(0, 1.8, 0);

  const beaconGeo = new THREE.OctahedronGeometry(0.38, 0);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x22c55e,
    emissiveIntensity: 1.2,
    roughness: 0.1,
  });
  const beaconDiamond = new THREE.Mesh(beaconGeo, beaconMat);
  dropZoneBeacon.add(beaconDiamond);

  // Gegelung sasaran terapung (Target ring)
  const ringGeo = new THREE.RingGeometry(0.55, 0.68, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x86efac,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = -0.4;
  dropZoneBeacon.add(ring);

  dropZoneMesh.add(dropZoneBeacon);

  // E. Cahaya Penerang Kawasan Hijau Terang (Radiant Green Drop Zone Lighting)
  const dropMarkerLight = new THREE.PointLight(0x22c55e, 2.5, 14);
  dropMarkerLight.position.set(0, 2.0, 0);
  dropZoneMesh.add(dropMarkerLight);

  scene.add(dropZoneMesh);

  // 6B. Area Pengiriman (Drop Zone Level 2) - Di Atas Permukaan Rak Tingkat Atas
  // Diletakkan tepat di atas permukaan para rak pada x: -8.0, y: 1.365m, z: -15.0
  const dropZoneShelfMesh = new THREE.Group();
  dropZoneShelfMesh.position.set(-8.0, 1.365, -15.0);
  dropZoneShelfMesh.visible = false; // Mula tersembunyi semasa Level 1

  const dropZoneShelfTex = createShelfDropZoneTexture();
  dropZoneShelfTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // A. Pelat Tikar Pendaratan Hijau Terang di Atas Rak (2.30m x 1.20m)
  const shelfPlateGeo = new THREE.PlaneGeometry(2.30, 1.20);
  shelfPlateGeo.rotateX(-Math.PI / 2);
  const shelfPlateMat = new THREE.MeshStandardMaterial({
    map: dropZoneShelfTex,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.95,
  });
  shelfPlateMat.polygonOffset = true;
  shelfPlateMat.polygonOffsetFactor = -2;
  shelfPlateMat.polygonOffsetUnits = -2;

  const shelfPlate = new THREE.Mesh(shelfPlateGeo, shelfPlateMat);
  shelfPlate.receiveShadow = true;
  dropZoneShelfMesh.add(shelfPlate);

  // B. Garis Perimeter Berpendar Hijau Terang di Keliling Para Rak
  const shelfBorderMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 1.0,
    roughness: 0.2,
    metalness: 0.1,
  });

  const shelfBorderW = 2.30;
  const shelfBorderD = 1.20;
  const sBorderThick = 0.08;
  const sBorderH = 0.025;

  const sBorderX = new THREE.BoxGeometry(shelfBorderW + sBorderThick, sBorderH, sBorderThick);
  const sBorderZ = new THREE.BoxGeometry(sBorderThick, sBorderH, shelfBorderD + sBorderThick);

  const sBorderN = new THREE.Mesh(sBorderX, shelfBorderMat);
  sBorderN.position.set(0, sBorderH / 2, -shelfBorderD / 2);
  dropZoneShelfMesh.add(sBorderN);

  const sBorderS = new THREE.Mesh(sBorderX, shelfBorderMat);
  sBorderS.position.set(0, sBorderH / 2, shelfBorderD / 2);
  dropZoneShelfMesh.add(sBorderS);

  const sBorderW = new THREE.Mesh(sBorderZ, shelfBorderMat);
  sBorderW.position.set(-shelfBorderW / 2, sBorderH / 2, 0);
  dropZoneShelfMesh.add(sBorderW);

  const sBorderE = new THREE.Mesh(sBorderZ, shelfBorderMat);
  sBorderE.position.set(shelfBorderW / 2, sBorderH / 2, 0);
  dropZoneShelfMesh.add(sBorderE);

  // C. Penanda Sudut Neon Hijau
  const sCornerGeo = new THREE.BoxGeometry(0.12, 0.03, 0.12);
  const sCornerMat = new THREE.MeshBasicMaterial({ color: 0x86efac });
  [
    [-shelfBorderW / 2, -shelfBorderD / 2],
    [shelfBorderW / 2, -shelfBorderD / 2],
    [-shelfBorderW / 2, shelfBorderD / 2],
    [shelfBorderW / 2, shelfBorderD / 2],
  ].forEach(([cx, cz]) => {
    const corner = new THREE.Mesh(sCornerGeo, sCornerMat);
    corner.position.set(cx, 0.02, cz);
    dropZoneShelfMesh.add(corner);
  });

  // D. Suar Terapung Holografik di Atas Rak (Floating Beacon above Shelf)
  const dropZoneShelfBeacon = new THREE.Group();
  dropZoneShelfBeacon.position.set(0, 0.95, 0);

  const sBeaconDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x22c55e,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    })
  );
  dropZoneShelfBeacon.add(sBeaconDiamond);

  const sRingMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x86efac,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  sRingMesh.position.y = -0.3;
  dropZoneShelfBeacon.add(sRingMesh);
  dropZoneShelfMesh.add(dropZoneShelfBeacon);

  // E. Cahaya Hijau Menyinari Kawasan Para Rak
  const dropZoneShelfLight = new THREE.PointLight(0x22c55e, 2.8, 8);
  dropZoneShelfLight.position.set(0, 0.9, 0);
  dropZoneShelfMesh.add(dropZoneShelfLight);

  scene.add(dropZoneShelfMesh);

  // 7. Interactive Target Pallet (Hanya SATU palet sasaran utama dengan fizik sebenar)
  const cargos: CargoItem[] = [
    {
      id: 'cargo-1',
      name: 'Palet Sasaran #1',
      x: 0,
      y: 0,
      z: -2.5,
      width: 1.2,
      height: 0.7,
      depth: 1.1,
      isLoaded: false,
      isDelivered: false,
      color: '#eab308',
    },
  ];

  const cargoMeshes = new Map<string, THREE.Group>();

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xc29b68, // Wood pallet
    roughness: 0.85,
    metalness: 0.05,
  });

  const woodDarkMat = new THREE.MeshStandardMaterial({
    color: 0xa17c4b,
    roughness: 0.9,
    metalness: 0.02,
  });

  let targetPalletMesh: THREE.Group | null = null;
  let targetMarkerMesh: THREE.Mesh | undefined;

  cargos.forEach((cargo) => {
    const cargoGroup = new THREE.Group();
    cargoGroup.position.set(cargo.x, cargo.y, cargo.z);

    // 1. Tiga Runner Kayu di Bawah Palet (menghasilkan slot lubang untuk bilah garpu)
    // Runner berpusat pada y = 0.058m dengan ketinggian 0.116m
    const runnerGeo = new THREE.BoxGeometry(0.11, 0.116, cargo.depth);
    [-0.52, 0, 0.52].forEach((rx) => {
      const runner = new THREE.Mesh(runnerGeo, woodMat);
      runner.position.set(rx, 0.058, 0);
      runner.castShadow = true;
      runner.receiveShadow = true;
      cargoGroup.add(runner);
    });

    // 2. Papan Atas Palet (Top Deckboard): berpusat pada y = 0.136m (tinggi 0.036m, dari 0.116m ke 0.152m)
    const palletTopGeo = new THREE.BoxGeometry(cargo.width, 0.036, cargo.depth);
    const palletTop = new THREE.Mesh(palletTopGeo, woodMat);
    palletTop.position.set(0, 0.136, 0);
    palletTop.castShadow = true;
    palletTop.receiveShadow = true;
    cargoGroup.add(palletTop);

    // Bilah-bilah papan kayu individu di atas palet untuk perincian visual
    const plankGeo = new THREE.BoxGeometry(cargo.width - 0.04, 0.012, 0.14);
    [-0.45, -0.22, 0, 0.22, 0.45].forEach((pz) => {
      const plank = new THREE.Mesh(plankGeo, woodDarkMat);
      plank.position.set(0, 0.156, pz);
      plank.castShadow = true;
      cargoGroup.add(plank);
    });

    // 3. Kotak Kargo di Atas Palet: berpusat pada y = 0.506m
    const boxMat = new THREE.MeshStandardMaterial({
      map: createCardboardTexture(cargo.id === 'cargo-1' ? 'TARGET PALET #1' : cargo.id.toUpperCase()),
      roughness: 0.7,
      metalness: 0.1,
    });

    const boxGeo = new THREE.BoxGeometry(1.0, 0.7, 0.9);
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.set(0, 0.506, 0);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    cargoGroup.add(boxMesh);

    // Penunjuk Sasaran Terapung khusus untuk Palet Sasaran Utama (cargo-1)
    if (cargo.id === 'cargo-1') {
      targetPalletMesh = cargoGroup;

      const markerGeo = new THREE.OctahedronGeometry(0.22, 0);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        wireframe: false,
      });
      targetMarkerMesh = new THREE.Mesh(markerGeo, markerMat);
      targetMarkerMesh.position.set(0, 1.25, 0);
      cargoGroup.add(targetMarkerMesh);

      // Lampu penunjuk lembut di atas palet sasaran
      const targetPointLight = new THREE.PointLight(0xf59e0b, 1.2, 4);
      targetPointLight.position.set(0, 1.3, 0);
      cargoGroup.add(targetPointLight);
    }

    scene.add(cargoGroup);
    cargoMeshes.set(cargo.id, cargoGroup);
  });

  // Logik peralihan posisi Drop Zone antara Level 1, Level 2, Level 3, Level 4, dan Level 5
  const setDropZoneLevel = (level: 1 | 2 | 3 | 4 | 5) => {
    if (level === 1) {
      dropZone.x = 10;
      dropZone.y = 0.02;
      dropZone.z = -17;
      dropZone.width = 5.5;
      dropZone.depth = 5.5;
      dropZone.name = 'AREA PENGIRIMAN LEVEL 1 (LANTAI)';
      dropZoneMesh.position.set(dropZone.x, 0.02, dropZone.z);
      dropZoneMesh.scale.set(1.0, 1.0, 1.0);
      dropZoneMesh.visible = true;
      dropZoneShelfMesh.visible = false;
      level3RacksGroup.visible = false;
      level4ObstaclesGroup.visible = false;
      level5DockGroup.visible = false;
      palletRackMesh.visible = true;
    } else if (level === 2) {
      dropZone.x = -8.0;
      dropZone.y = 1.365;
      dropZone.z = -15.0;
      dropZone.width = 2.40;
      dropZone.depth = 1.25;
      dropZone.name = 'AREA PENGIRIMAN LEVEL 2 (ATAS RAK)';
      dropZoneMesh.visible = false;
      dropZoneShelfMesh.visible = true;
      level3RacksGroup.visible = false;
      level4ObstaclesGroup.visible = false;
      level5DockGroup.visible = false;
      palletRackMesh.visible = true;
    } else if (level === 3) {
      // Level 3: Drop Zone di lantai pada hujung laluan berselekoh 'L'
      dropZone.x = -8.0;
      dropZone.y = 0.02;
      dropZone.z = 8.0;
      dropZone.width = 4.5;
      dropZone.depth = 4.5;
      dropZone.name = 'AREA PENGIRIMAN LEVEL 3 (UJUNG LORONG L)';
      dropZoneMesh.position.set(dropZone.x, 0.02, dropZone.z);
      dropZoneMesh.scale.set(4.5 / 5.5, 1.0, 4.5 / 5.5);
      dropZoneMesh.visible = true;
      dropZoneShelfMesh.visible = false;
      level3RacksGroup.visible = true;
      level4ObstaclesGroup.visible = false;
      level5DockGroup.visible = false;
      palletRackMesh.visible = false;
    } else if (level === 4) {
      // Level 4: Drop Zone di lantai pada hujung rute rintangan zig-zag
      dropZone.x = 0.0;
      dropZone.y = 0.02;
      dropZone.z = 18.0;
      dropZone.width = 4.5;
      dropZone.depth = 4.5;
      dropZone.name = 'AREA PENGIRIMAN LEVEL 4 (ZIG-ZAG)';
      dropZoneMesh.position.set(dropZone.x, 0.02, dropZone.z);
      dropZoneMesh.scale.set(4.5 / 5.5, 1.0, 4.5 / 5.5);
      dropZoneMesh.visible = true;
      dropZoneShelfMesh.visible = false;
      level3RacksGroup.visible = false;
      level4ObstaclesGroup.visible = true;
      level5DockGroup.visible = false;
      palletRackMesh.visible = false;
    } else {
      // Level 5: Drop Zone tepat di atas Platform Akhir di ujung lintasan tanjakan/turunan
      // Diletakkan pada y = 0.08m (tepat di atas platform y = 0.06m) agar tidak tenggelam ke bawah platform
      dropZone.x = -21.8;
      dropZone.y = 0.08;
      dropZone.z = -23.5;
      dropZone.width = 4.8;
      dropZone.depth = 4.8;
      dropZone.name = 'AREA PENGIRIMAN LEVEL 5 (PLATFORM AKHIR)';
      dropZoneMesh.position.set(dropZone.x, dropZone.y, dropZone.z);
      dropZoneMesh.scale.set(dropZone.width / 5.5, 1.0, dropZone.depth / 5.5);
      dropZoneMesh.visible = true;
      dropZoneShelfMesh.visible = false;
      level3RacksGroup.visible = false;
      level4ObstaclesGroup.visible = false;
      level5DockGroup.visible = true;
      palletRackMesh.visible = false;
    }
  };

  return {
    scene,
    obstacles,
    cargoMeshes,
    targetPalletMesh: targetPalletMesh ?? cargoMeshes.values().next().value!,
    targetMarkerMesh,
    dropZoneMesh,
    dropZoneShelfMesh,
    dropZoneBeacon,
    dropZoneShelfBeacon,
    dropZoneLight: dropMarkerLight,
    dropZoneShelfLight,
    dropZone,
    palletRackMesh,
    cargos,
    setDropZoneLevel,
    dispose: () => {
      floorTexture.dispose();
      hazardTex.dispose();
      dropZoneFloorTex.dispose();
      dropZoneShelfTex.dispose();
      warningTapeTex.dispose();
    },
  };
}

/**
 * Cipta objek 3D Rak Gudang (Pallet Rack) 2 Tingkat:
 * - Tingkat 1: Permukaan lantai dasar (Ground Bay)
 * - Tingkat 2: Para rak atas (Solid Shelf pada y = 1.30m - 1.36m)
 * Bukaan depan (+Z) terbuka luas supaya forklift dapat memasukkan palet kargo dengan leluasa
 */
function createTwoTierPalletRackMesh(
  rackX: number,
  rackZ: number,
  kickboardMat: THREE.Material
): THREE.Group {
  const rackGroup = new THREE.Group();
  rackGroup.position.set(rackX, 0, rackZ);

  const rackWidth = 2.70;
  const rackDepth = 1.40;
  const rackHeight = 3.20;
  const shelfY = 1.30;
  const colW = 0.09;
  const colD = 0.09;

  // Material Tiang Keluli Biru Industri (Safety Blue Steel)
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    metalness: 0.55,
    roughness: 0.35,
  });

  // Material Balok Oren Keselamatan (Safety Orange Load Beams)
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    metalness: 0.45,
    roughness: 0.4,
  });

  // Material Para Rak Keluli (Solid Steel Decking)
  const shelfDeckMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.65,
    roughness: 0.35,
  });

  // Tapak Kaki Tiang (Base Footplates)
  const footMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const footGeo = new THREE.BoxGeometry(0.20, 0.02, 0.20);

  // 1. Empat Tiang Menegak Utama (4 Main Vertical Columns)
  const colGeo = new THREE.BoxGeometry(colW, rackHeight, colD);
  const halfW = rackWidth / 2 - colW / 2;
  const halfD = rackDepth / 2 - colD / 2;

  const columnCoords = [
    [-halfW, +halfD], // Kiri-Depan
    [+halfW, +halfD], // Kanan-Depan
    [-halfW, -halfD], // Kiri-Belakang
    [+halfW, -halfD], // Kanan-Belakang
  ];

  columnCoords.forEach(([cx, cz]) => {
    const col = new THREE.Mesh(colGeo, columnMat);
    col.position.set(cx, rackHeight / 2, cz);
    col.castShadow = true;
    col.receiveShadow = true;
    rackGroup.add(col);

    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(cx, 0.01, cz);
    foot.receiveShadow = true;
    rackGroup.add(foot);
  });

  // 2. Pendakap Pepenjuru Sisi (Left & Right Side Diagonal Bracing)
  const braceLength = Math.hypot(rackDepth, 1.1);
  const braceGeo = new THREE.CylinderGeometry(0.02, 0.02, braceLength, 6);
  const braceAngle = Math.atan2(1.1, rackDepth);

  [-halfW, +halfW].forEach((sideX) => {
    // Lower tier diagonal
    const brace1 = new THREE.Mesh(braceGeo, columnMat);
    brace1.position.set(sideX, 0.65, 0);
    brace1.rotation.x = braceAngle;
    rackGroup.add(brace1);

    // Upper tier diagonal
    const brace2 = new THREE.Mesh(braceGeo, columnMat);
    brace2.position.set(sideX, 1.95, 0);
    brace2.rotation.x = -braceAngle;
    rackGroup.add(brace2);

    // Top horizontal strut
    const topStrutGeo = new THREE.BoxGeometry(0.04, 0.04, rackDepth);
    const topStrut = new THREE.Mesh(topStrutGeo, columnMat);
    topStrut.position.set(sideX, rackHeight - 0.02, 0);
    rackGroup.add(topStrut);
  });

  // 3. Palang Penguat Belakang (Rear Frame Bracing)
  const rearBeamGeo = new THREE.BoxGeometry(rackWidth, 0.06, 0.04);
  const rearTopBeam = new THREE.Mesh(rearBeamGeo, columnMat);
  rearTopBeam.position.set(0, rackHeight - 0.03, -halfD);
  rackGroup.add(rearTopBeam);

  const rearMidBeam = new THREE.Mesh(rearBeamGeo, columnMat);
  rearMidBeam.position.set(0, 2.2, -halfD);
  rackGroup.add(rearMidBeam);

  // 4. Tingkat 1: Permukaan Lantai Dasar (Ground Bay)
  // Lantai terbuka untuk palet diletakkan terus di lantai dasar
  const groundBayPlateGeo = new THREE.PlaneGeometry(rackWidth - 0.2, rackDepth - 0.1);
  groundBayPlateGeo.rotateX(-Math.PI / 2);
  const groundBayMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    transparent: true,
    opacity: 0.6,
  });
  groundBayMat.polygonOffset = true;
  groundBayMat.polygonOffsetFactor = -1;
  const groundBayPlate = new THREE.Mesh(groundBayPlateGeo, groundBayMat);
  groundBayPlate.position.set(0, 0.015, 0);
  groundBayPlate.receiveShadow = true;
  rackGroup.add(groundBayPlate);

  // Marka keselamatan lantai dasar (hazard border kickboards)
  const kickL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, rackDepth - 0.1), kickboardMat);
  kickL.position.set(-halfW + 0.08, 0.03, 0);
  rackGroup.add(kickL);
  const kickR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, rackDepth - 0.1), kickboardMat);
  kickR.position.set(halfW - 0.08, 0.03, 0);
  rackGroup.add(kickR);

  // 5. Tingkat 2: Balok Para Atas (Level 2 Upper Shelf Tier)
  // Balok beban hadapan & belakang (Front & Rear Safety Orange Load Beams)
  const beamLength = rackWidth + 0.04;
  const beamHeight = 0.12;
  const beamThick = 0.08;
  const mainBeamGeo = new THREE.BoxGeometry(beamLength, beamHeight, beamThick);

  // Balok Hadapan (+halfD)
  const frontBeam = new THREE.Mesh(mainBeamGeo, beamMat);
  frontBeam.position.set(0, shelfY, halfD);
  frontBeam.castShadow = true;
  frontBeam.receiveShadow = true;
  rackGroup.add(frontBeam);

  // Balok Belakang (-halfD)
  const backBeam = new THREE.Mesh(mainBeamGeo, beamMat);
  backBeam.position.set(0, shelfY, -halfD);
  backBeam.castShadow = true;
  backBeam.receiveShadow = true;
  rackGroup.add(backBeam);

  // Tiga palang sokongan melintang bawah dek (3 Cross Tie Bars)
  const tieGeo = new THREE.BoxGeometry(0.05, 0.06, rackDepth - 0.08);
  [-0.75, 0, 0.75].forEach((tx) => {
    const tie = new THREE.Mesh(tieGeo, columnMat);
    tie.position.set(tx, shelfY - 0.03, 0);
    rackGroup.add(tie);
  });

  // 6. Solid Shelf Decking (Permukaan Para Rak Tingkat 2)
  // Paras atas permukaan tepat pada y = 1.36m (sepadan dengan Rapier shelf collider)
  const deckWidth = rackWidth - 0.08;
  const deckDepth = rackDepth - 0.06;
  const deckThickness = 0.06;
  const deckGeo = new THREE.BoxGeometry(deckWidth, deckThickness, deckDepth);
  const deckMesh = new THREE.Mesh(deckGeo, shelfDeckMat);
  deckMesh.position.set(0, 1.33, 0); // Atas permukaan pada 1.33 + 0.03 = 1.36m
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  rackGroup.add(deckMesh);

  // 7. Papan Tanda & Label Keselamatan (Industrial Signage)
  // Label amaran pada balok hadapan tingkat 2
  const signGeo = new THREE.BoxGeometry(1.6, 0.09, 0.01);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 64;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#0f172a';
  sCtx.fillRect(0, 0, 512, 64);
  sCtx.fillStyle = '#f59e0b';
  sCtx.font = 'bold 24px monospace';
  sCtx.textAlign = 'center';
  sCtx.textBaseline = 'middle';
  sCtx.fillText('★ RAK TINGKAT 2 · MAKS 1500 KG ★', 256, 32);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(0, shelfY, halfD + beamThick / 2 + 0.01);
  rackGroup.add(signMesh);

  // Papan Nama Utama di Puncak Tiang Hadapan (y = 3.05m)
  const topSignGeo = new THREE.BoxGeometry(2.0, 0.22, 0.02);
  const topSignCanvas = document.createElement('canvas');
  topSignCanvas.width = 512;
  topSignCanvas.height = 96;
  const tsCtx = topSignCanvas.getContext('2d')!;
  tsCtx.fillStyle = '#1e3a8a';
  tsCtx.fillRect(0, 0, 512, 96);
  tsCtx.strokeStyle = '#38bdf8';
  tsCtx.lineWidth = 6;
  tsCtx.strokeRect(4, 4, 504, 88);
  tsCtx.fillStyle = '#ffffff';
  tsCtx.font = 'bold 34px monospace';
  tsCtx.textAlign = 'center';
  tsCtx.textBaseline = 'middle';
  tsCtx.fillText('RAK GUDANG · LEVEL 2', 256, 48);
  const topSignTex = new THREE.CanvasTexture(topSignCanvas);
  topSignTex.colorSpace = THREE.SRGBColorSpace;
  const topSignMat = new THREE.MeshBasicMaterial({ map: topSignTex });
  const topSignMesh = new THREE.Mesh(topSignGeo, topSignMat);
  topSignMesh.position.set(0, rackHeight - 0.15, halfD + 0.01);
  rackGroup.add(topSignMesh);

  // Lampu penunjuk lembut di bawah tingkat atas untuk menerangi bay lantai dasar
  const underShelfLight = new THREE.PointLight(0xfef08a, 0.8, 5);
  underShelfLight.position.set(0, shelfY - 0.15, 0);
  rackGroup.add(underShelfLight);

  return rackGroup;
}

/**
 * Elemen Keselamatan & Panduan Laluan Lorong Sempit 'L' (Level 3):
 * Tiang bollard pengaman keluli kukuh bertapak di lantai pada setiap penjuru,
 * dan garis cat keselamatan kuning industri rata di atas lantai (tiada sebarang objek melayang di udara).
 */
function createNarrowAisleDecorations(scene: THREE.Scene | THREE.Group, kickboardMat: THREE.Material): void {
  const bollardGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.1, 16);
  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
    metalness: 0.35,
  });
  const bollardBaseGeo = new THREE.CylinderGeometry(0.20, 0.22, 0.06, 16);
  const bollardBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

  // 6 Tiang bollard keluli keselamatan di penjuru pintu masuk, selekoh 90 darjah, dan pintu keluar
  const bollardPositions = [
    [3.5, 16.0],   // Pintu masuk sisi kiri Leg 1
    [8.5, 21.5],   // Pintu masuk sisi kanan Leg 1
    [4.2, 9.8],    // Selekoh dalam (Inner corner elbow)
    [8.5, 5.3],    // Selekoh luar (Outer corner elbow)
    [-4.5, 5.3],   // Pintu keluar sisi utara Leg 2
    [-4.5, 10.5],  // Pintu keluar sisi selatan Leg 2
  ];

  bollardPositions.forEach(([bx, bz]) => {
    // Tapak besi tebal melekat kukuh di atas lantai (y = 0.03)
    const base = new THREE.Mesh(bollardBaseGeo, bollardBaseMat);
    base.position.set(bx, 0.03, bz);
    base.receiveShadow = true;
    scene.add(base);

    // Tiang menegak kuning keselamatan
    const bollard = new THREE.Mesh(bollardGeo, bollardMat);
    bollard.position.set(bx, 0.58, bz);
    bollard.castShadow = true;
    bollard.receiveShadow = true;
    scene.add(bollard);

    // Jalur hazard hitam-kuning keselamatan pada bahagian tengah tiang
    const bandGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.35, 16);
    const band = new THREE.Mesh(bandGeo, kickboardMat);
    band.position.set(bx, 0.58, bz);
    scene.add(band);
  });

  // Garisan Cat Keselamatan Kuning Cerah di Atas Lantai (Flat Floor Road Markings)
  // Dilukis kemas tepat di permukaan lantai gudang dengan polygonOffset untuk mengelakkan z-fighting
  const laneMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  laneMat.polygonOffset = true;
  laneMat.polygonOffsetFactor = -1;
  laneMat.polygonOffsetUnits = -1;

  // Garis sempadan Leg 1 (Along Z, dari z = 21.5 ke z = 5.3)
  // Sisi kanan lorong Leg 1 (x = 7.7)
  const lineLeg1R = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 16.0).rotateX(-Math.PI / 2), laneMat);
  lineLeg1R.position.set(7.7, 0.015, 13.5);
  lineLeg1R.receiveShadow = true;
  scene.add(lineLeg1R);

  // Sisi kiri lorong Leg 1 (x = 4.3, z dari 16.0 ke 9.8)
  const lineLeg1L = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6.2).rotateX(-Math.PI / 2), laneMat);
  lineLeg1L.position.set(4.3, 0.015, 12.9);
  lineLeg1L.receiveShadow = true;
  scene.add(lineLeg1L);

  // Garis sempadan Leg 2 (Along X, dari x = 8.5 ke x = -4.5)
  // Sisi utara lorong Leg 2 (z = 6.1)
  const lineLeg2N = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 0.12).rotateX(-Math.PI / 2), laneMat);
  lineLeg2N.position.set(2.0, 0.015, 6.1);
  lineLeg2N.receiveShadow = true;
  scene.add(lineLeg2N);

  // Sisi selatan lorong Leg 2 (z = 9.7, dari x = 4.2 ke x = -4.5)
  const lineLeg2S = new THREE.Mesh(new THREE.PlaneGeometry(8.7, 0.12).rotateX(-Math.PI / 2), laneMat);
  lineLeg2S.position.set(-0.15, 0.015, 9.7);
  lineLeg2S.receiveShadow = true;
  scene.add(lineLeg2S);
}

/**
 * Garis Panduan Lintasan Zig-Zag Lantai Level 4 (Lakban Kuning Industri / Floor Hazard Warning Tape)
 * Membentuk jalur pita bergaris hazard kuning hitam kontras tinggi yang secara visual memandu pemain
 * dari titik mula (0, -17.5), melewati palet (0, -14.0), zig-zag di antara 4 baris rintangan tong dan kerucut,
 * hingga tepat ke pusat Drop Zone hijau (0, 18.0).
 */
function createLevel4ZigZagFloorGuide(tapeTex: THREE.Texture): THREE.Group {
  const guideGroup = new THREE.Group();
  guideGroup.name = 'Level4ZigZagFloorGuide';

  // Titik koordinat laluan zig-zag di lantai (x, z):
  const waypoints: [number, number][] = [
    [0.0, -17.5],  // 0. Titik Mula Forklift
    [0.0, -14.0],  // 1. Lokasi Palet Kargo Mula-mula
    [0.0, -12.5],  // 2. Mula melencong ke arah kanan
    [3.5, -11.0],  // 3. Melintasi bukaan kanan Baris 1
    [3.5, -7.5],   // 4. Puncak selekoh kanan pertama
    [-3.5, -3.5],  // 5. Melintasi bukaan kiri Baris 2
    [-3.5, 0.0],   // 6. Puncak selekoh kiri kedua
    [3.5, 4.0],    // 7. Melintasi bukaan kanan Baris 3
    [3.5, 7.5],    // 8. Puncak selekoh kanan ketiga
    [-3.5, 11.5],  // 9. Melintasi bukaan kiri Baris 4
    [-3.5, 15.0],  // 10. Puncak selekoh kiri keempat
    [0.0, 18.0],   // 11. Tepat di pusat Drop Zone hijau
  ];

  const tapeWidth = 0.45; // Lebar pita lakban lantai 45cm

  // 1. Bina Jalur Pita Lakban Kuning Menghubungkan Setiap Titik
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];

    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const length = Math.hypot(dx, dz);
    const mx = (p1[0] + p2[0]) / 2;
    const mz = (p1[1] + p2[1]) / 2;
    const angle = Math.atan2(dx, dz);

    // Klon tekstur supaya corak panah chevron berulang sepadan dengan panjang segmen
    const segTex = tapeTex.clone();
    segTex.needsUpdate = true;
    segTex.wrapS = THREE.RepeatWrapping;
    segTex.wrapT = THREE.RepeatWrapping;
    segTex.repeat.set(1, Math.max(1, Math.round(length * 1.6)));

    const segMat = new THREE.MeshStandardMaterial({
      map: segTex,
      roughness: 0.35,
      metalness: 0.1,
      emissive: 0xca8a04,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.95,
    });
    segMat.polygonOffset = true;
    segMat.polygonOffsetFactor = -2;
    segMat.polygonOffsetUnits = -2;

    const segGeo = new THREE.PlaneGeometry(tapeWidth, length);
    segGeo.rotateX(-Math.PI / 2);

    const segMesh = new THREE.Mesh(segGeo, segMat);
    segMesh.position.set(mx, 0.018, mz);
    segMesh.rotation.y = angle;
    segMesh.receiveShadow = true;
    guideGroup.add(segMesh);
  }

  // 2. Plat Bulatan Persimpangan / Penanda Selekoh di Setiap Waypoint (Turn Junction Nodes)
  const nodeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xeab308,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.95,
  });
  nodeMat.polygonOffset = true;
  nodeMat.polygonOffsetFactor = -3;
  nodeMat.polygonOffsetUnits = -3;

  const nodeRingMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
  nodeRingMat.polygonOffset = true;
  nodeRingMat.polygonOffsetFactor = -3;
  nodeRingMat.polygonOffsetUnits = -3;

  waypoints.forEach(([wx, wz], idx) => {
    // Plat bulat asas
    const circleGeo = new THREE.CircleGeometry(0.32, 24);
    circleGeo.rotateX(-Math.PI / 2);
    const circleMesh = new THREE.Mesh(circleGeo, nodeMat);
    circleMesh.position.set(wx, 0.019, wz);
    circleMesh.receiveShadow = true;
    guideGroup.add(circleMesh);

    // Cincin sempadan hitam
    const ringGeo = new THREE.RingGeometry(0.32, 0.38, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, nodeRingMat);
    ringMesh.position.set(wx, 0.020, wz);
    guideGroup.add(ringMesh);

    // Titik puncak selekoh utama (apex): Tambahkan suar cahaya lantai lembut untuk panduan
    if (idx === 4 || idx === 6 || idx === 8 || idx === 10) {
      const turnLight = new THREE.PointLight(0xfacc15, 1.2, 5.0);
      turnLight.position.set(wx, 0.5, wz);
      guideGroup.add(turnLight);

      // Prisma terapung penunjuk selekoh
      const markerGeo = new THREE.OctahedronGeometry(0.14, 0);
      const markerMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.set(wx, 0.35, wz);
      guideGroup.add(markerMesh);
    }
  });

  // 3. Garis Panduan Sempadan Koridor Keselamatan Luar (Dashed Outer Boundary Lines)
  const boundaryLineMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.65,
  });
  boundaryLineMat.polygonOffset = true;
  boundaryLineMat.polygonOffsetFactor = -1;
  boundaryLineMat.polygonOffsetUnits = -1;

  // Garis sempadan kanan koridor (x = 5.6, dari z = -17.5 hingga 18.0)
  const lineRight = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 35.5).rotateX(-Math.PI / 2), boundaryLineMat);
  lineRight.position.set(5.6, 0.015, 0.25);
  lineRight.receiveShadow = true;
  guideGroup.add(lineRight);

  // Garis sempadan kiri koridor (x = -5.6, dari z = -17.5 hingga 18.0)
  const lineLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 35.5).rotateX(-Math.PI / 2), boundaryLineMat);
  lineLeft.position.set(-5.6, 0.015, 0.25);
  lineLeft.receiveShadow = true;
  guideGroup.add(lineLeft);

  return guideGroup;
}

/**
 * Cipta objek 3D Persekitaran Platform Loading Dock & Tanjakan (Ramp) Level 5:
 * - Platform konkrit tegap bersaiz 10.5m x 10.0m pada ketinggian y = 1.0m
 * - Tanjakan (ramp) bersudut landai (10% / 5.71 darjah) sepanjang 10.0m di sepanjang paksi X
 * - Pagar keselamatan industri kuning, bendul tepi tanjakan, pintu gudang roller shutter BAY 05, dan lampu limpah
 */
/**
 * Cipta objek 3D Persekitaran Jembatan Berbukit (Overpass Bridge & Hills Track) Level 5:
 * - Rute Berkesinambungan: Naik (X=7.0 ke -3.0) -> Platform Datar (X=-3.0 ke -9.0, elevasi 1.25m) -> Turun (X=-9.0 ke -19.0)
 * - Geometri kurva halus S-shape (C2 cosine easing) pada pangkal dan ujung tanjakan/turunan
 * - Tiang penopang jembatan konkrit & rangka keluli, bendul keselamatan, papan tanda gantri overhead, dan lampu limpah
 */
function createLevel5LoadingDockEnvironment(
  _hazardTex: THREE.Texture,
  kickboardMat: THREE.Material
): THREE.Group {
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'Level5BridgeEnvironmentGroup';

  // 1. Material Jembatan & Lintasan
  const concreteDockMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46, // Dark industrial concrete
    roughness: 0.6,
    metalness: 0.25,
  });

  const steelTreadMat = new THREE.MeshStandardMaterial({
    color: 0x27272a, // Steel diamond plate
    roughness: 0.55,
    metalness: 0.6,
  });

  const safetyYellowMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0xca8a04,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.2,
  });

  const dockBumperMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
    metalness: 0.05,
  });

  // A. GEOMETRI KURVA HALUS LINTASAN JEMBATAN FLUSH (FLUSH BURIED RAMP BASE)
  // Menghasilkan permukaan dek jembatan yang 100% selari dengan Rapier Trimesh Collider
  // Ditanam sedikit di bawah lantai utama (y < 0) pada x in [7.0, 8.5] dan x in [-19.0, -20.5]
  const numSteps = 70;
  const xStart = 8.5;
  const xEnd = -20.5;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const x = xStart + (xEnd - xStart) * t;
    const info = getLevel5RampSurfaceHeight(x);
    const y = info.y;
    const curbH = info.curbH;

    // 6 Titik Penampang Z per irisan X:
    // 0: Skirt Utara Bawah (y = -0.40m di bawah lantai)
    // 1: Puncak Bendul/Curb Utara (y + curbH)
    // 2: Tepi Dek Utara (y)
    // 3: Tepi Dek Selatan (y)
    // 4: Puncak Bendul/Curb Selatan (y + curbH)
    // 5: Skirt Selatan Bawah (y = -0.40m di bawah lantai)
    vertices.push(
      x, -0.40, -20.6,
      x, y + curbH, -20.6,
      x, y, -20.8,
      x, y, -26.2,
      x, y + curbH, -26.4,
      x, -0.40, -26.4
    );

    const uCoord = t * 12;
    uvs.push(
      uCoord, 0.0,
      uCoord, 0.2,
      uCoord, 0.3,
      uCoord, 0.7,
      uCoord, 0.8,
      uCoord, 1.0
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

  // Tutup Muka Depan (X = 8.5) & Belakang (X = -20.5) - tertanam di bawah lantai (y <= -0.12m)
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

  const bridgeGeo = new THREE.BufferGeometry();
  bridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  bridgeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bridgeGeo.setIndex(indices);
  bridgeGeo.computeVertexNormals();

  const bridgeMesh = new THREE.Mesh(bridgeGeo, steelTreadMat);
  bridgeMesh.receiveShadow = true;
  bridgeMesh.castShadow = true;
  bridgeGroup.add(bridgeMesh);

  // B. JALUR BENDUL HAZARD KUNING-HITAM DI SEPANJANG TEPI LINTASAN
  // Hanya dipasang di kawasan jembatan & tanjakan/turunan (x <= 7.0 dan x >= -19.0)
  for (let i = 0; i < numSteps; i += 2) {
    const t = (i + 1) / numSteps;
    const x = xStart + (xEnd - xStart) * t;
    if (x > 7.0 || x < -19.0) continue; // Jangan halangi laluan masuk/keluar di atas lantai datar

    const info = getLevel5RampSurfaceHeight(x);
    const y = info.y;
    const dx = ((xEnd - xStart) / numSteps) * 2;
    const segLen = Math.abs(dx) * 1.05;

    // Bendul Utara
    const rimN = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.12, 0.18), kickboardMat);
    rimN.position.set(x, y + 0.16, -20.7);
    bridgeGroup.add(rimN);

    // Bendul Selatan
    const rimS = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.12, 0.18), kickboardMat);
    rimS.position.set(x, y + 0.16, -26.3);
    bridgeGroup.add(rimS);
  }

  // C. TIANG PENOPANG JEMBATAN KONKRIT & RANGKA BAWAH (CONCRETE PIERS & STEEL TRUSSES)
  // Menopang platform jembatan datar (X = -3.0 hingga X = -9.0 pada ketinggian y = 1.25m)
  const pierPositionsX = [-4.0, -8.0];
  const pierGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.25, 16);
  const pierBaseGeo = new THREE.BoxGeometry(1.0, 0.15, 1.0);

  pierPositionsX.forEach((px) => {
    // Tiang Utara & Selatan
    [-21.5, -25.5].forEach((pz) => {
      const pier = new THREE.Mesh(pierGeo, concreteDockMat);
      pier.position.set(px, 1.25 / 2, pz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      bridgeGroup.add(pier);

      const base = new THREE.Mesh(pierBaseGeo, dockBumperMat);
      base.position.set(px, 0.075, pz);
      base.receiveShadow = true;
      bridgeGroup.add(base);
    });

    // Balok melintang (Crossbeam) di bawah jembatan
    const crossbeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.35, 5.0),
      concreteDockMat
    );
    crossbeam.position.set(px, 1.25 - 0.20, -23.5);
    crossbeam.castShadow = true;
    bridgeGroup.add(crossbeam);
  });

  // D. PAGAR KESELAMATAN KELULI KUNING (GUARDRAILS) DI SEPANJANG JEMBATAN
  function createGuardrail(startX: number, startZ: number, endX: number, endZ: number, baseY: number): THREE.Group {
    const railGroup = new THREE.Group();
    const length = Math.hypot(endX - startX, endZ - startZ);
    const angle = Math.atan2(endZ - startZ, endX - startX);
    const midX = (startX + endX) / 2;
    const midZ = (startZ + endZ) / 2;

    railGroup.position.set(midX, baseY, midZ);
    railGroup.rotation.y = -angle;

    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 10);
    const numPosts = Math.max(2, Math.round(length / 2.2) + 1);
    for (let p = 0; p < numPosts; p++) {
      const px = -length / 2 + (p / (numPosts - 1)) * length;
      const post = new THREE.Mesh(postGeo, safetyYellowMat);
      post.position.set(px, 0.50, 0);
      post.castShadow = true;
      railGroup.add(post);

      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), dockBumperMat);
      basePlate.position.set(px, 0.015, 0);
      railGroup.add(basePlate);
    }

    const railGeo = new THREE.CylinderGeometry(0.035, 0.035, length, 10).rotateZ(Math.PI / 2);
    const topRail = new THREE.Mesh(railGeo, safetyYellowMat);
    topRail.position.set(0, 0.95, 0);
    topRail.castShadow = true;
    railGroup.add(topRail);

    const midRail = new THREE.Mesh(railGeo, safetyYellowMat);
    midRail.position.set(0, 0.50, 0);
    midRail.castShadow = true;
    railGroup.add(midRail);

    return railGroup;
  }

  // Pagar keselamatan pada platform datar atas jembatan (elevasi y = 1.25m)
  bridgeGroup.add(createGuardrail(-3.0, -20.6, -9.0, -20.6, 1.25));
  bridgeGroup.add(createGuardrail(-3.0, -26.4, -9.0, -26.4, 1.25));

  // Pagar keselamatan di area tanjakan dan turunan
  bridgeGroup.add(createGuardrail(6.5, -20.6, -2.8, -20.6, 0.62));
  bridgeGroup.add(createGuardrail(6.5, -26.4, -2.8, -26.4, 0.62));
  bridgeGroup.add(createGuardrail(-9.2, -20.6, -18.5, -20.6, 0.62));
  bridgeGroup.add(createGuardrail(-9.2, -26.4, -18.5, -26.4, 0.62));

  // E. GANTRI OVERHEAD DENGAN PAPAN TANDA NEON & LAMPU LIMPAH
  // 1. Gantri Masuk Tanjakan (Entrance Arch di X = 6.5)
  const createGantryArch = (gx: number, gy: number, title: string, subtitle: string): THREE.Group => {
    const gantry = new THREE.Group();
    gantry.position.set(gx, gy, -23.5);

    const archPostGeo = new THREE.BoxGeometry(0.24, 3.8, 0.24);
    const postN = new THREE.Mesh(archPostGeo, concreteDockMat);
    postN.position.set(0, 1.9, 3.0);
    gantry.add(postN);

    const postS = new THREE.Mesh(archPostGeo, concreteDockMat);
    postS.position.set(0, 1.9, -3.0);
    gantry.add(postS);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.40, 6.3), concreteDockMat);
    topBeam.position.set(0, 3.8, 0);
    gantry.add(topBeam);

    // Papan tanda neon
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 500, 116);
      ctx.fillStyle = '#facc15';
      ctx.font = '900 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 256, 48);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '700 20px monospace';
      ctx.fillText(subtitle, 256, 92);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xca8a04,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 3.4), signMat);
    sign.position.set(0, 3.75, 0);
    gantry.add(sign);

    return gantry;
  };

  // Gantri 1 di awal tanjakan
  bridgeGroup.add(createGantryArch(6.5, 0, 'JEMBATAN GUDANG', '▲ TANJAKAN NAIK · ELEVASI 1.25M'));

  // Gantri 2 di tengah jembatan (X = -6.0, Y = 1.25)
  const midGantry = createGantryArch(-6.0, 1.25, 'OVERPASS FLYOVER', 'JEMBATAN LAYANG GUDANG · BAY 05');
  bridgeGroup.add(midGantry);

  // Lampu limpah menerangi platform jembatan
  const bridgeSpotlight = new THREE.PointLight(0xffedd5, 3.2, 18.0);
  bridgeSpotlight.position.set(-6.0, 4.8, -23.5);
  bridgeGroup.add(bridgeSpotlight);

  // Gantri 3 di awal turunan (X = -9.2, Y = 1.25)
  bridgeGroup.add(createGantryArch(-9.2, 1.25, 'AWAS TURUNAN', '▼ DESCENT RAMP · MENUJU DROP ZONE'));

  // F. PINTU ROLLER SHUTTER & PAPAN TANDA BAY 05 DI DINDING BARAT (X = -24.7)
  const bayDoorGroup = new THREE.Group();
  bayDoorGroup.position.set(-24.7, 0, -23.5);

  const shutterMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.45,
    metalness: 0.65,
  });
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 4.6), shutterMat);
  shutter.position.set(0, 2.2, 0);
  bayDoorGroup.add(shutter);

  const slatGeo = new THREE.BoxGeometry(0.14, 0.04, 4.5);
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
  for (let sy = 0.2; sy <= 4.2; sy += 0.28) {
    const slat = new THREE.Mesh(slatGeo, slatMat);
    slat.position.set(0, sy, 0);
    bayDoorGroup.add(slat);
  }

  const frameMat = kickboardMat;
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.25, 4.9), frameMat);
  frameTop.position.set(0, 4.45, 0);
  bayDoorGroup.add(frameTop);

  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.5, 0.2), frameMat);
  frameL.position.set(0, 2.25, 2.35);
  bayDoorGroup.add(frameL);

  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.5, 0.2), frameMat);
  frameR.position.set(0, 2.25, -2.35);
  bayDoorGroup.add(frameR);

  // Papan nama Bay 05
  const baySign = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.70, 3.2),
    new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.2,
      emissive: 0x22c55e,
      emissiveIntensity: 0.3,
    })
  );
  baySign.position.set(0.05, 5.0, 0);
  bayDoorGroup.add(baySign);

  bridgeGroup.add(bayDoorGroup);

  // G. PANDUAN LALUAN LANTAI MENUJU JEMBATAN (APPROACH FLOOR DECALS)
  const floorTapeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  floorTapeMat.polygonOffset = true;
  floorTapeMat.polygonOffsetFactor = -2;
  floorTapeMat.polygonOffsetUnits = -2;

  // Garis penuntun dari area spawn forklift (X = 17.0) melewati palet (X = 12.0) ke tanjakan (X = 7.0)
  const leadLineNorth = new THREE.Mesh(
    new THREE.PlaneGeometry(10.0, 0.16).rotateX(-Math.PI / 2),
    floorTapeMat
  );
  leadLineNorth.position.set(12.0, 0.015, -20.8);
  leadLineNorth.receiveShadow = true;
  bridgeGroup.add(leadLineNorth);

  const leadLineSouth = new THREE.Mesh(
    new THREE.PlaneGeometry(10.0, 0.16).rotateX(-Math.PI / 2),
    floorTapeMat
  );
  leadLineSouth.position.set(12.0, 0.015, -26.2);
  leadLineSouth.receiveShadow = true;
  bridgeGroup.add(leadLineSouth);

  // Panah penunjuk arah tanjakan di lantai (X = 9.5, Z = -23.5)
  const arrowGeo = new THREE.ConeGeometry(0.65, 1.2, 3);
  arrowGeo.rotateX(-Math.PI / 2);
  arrowGeo.rotateZ(Math.PI / 2); // Menghadap ke arah -X
  const arrowMesh = new THREE.Mesh(arrowGeo, safetyYellowMat);
  arrowMesh.position.set(9.5, 0.02, -23.5);
  arrowMesh.scale.set(1.0, 1.0, 0.05);
  arrowMesh.receiveShadow = true;
  bridgeGroup.add(arrowMesh);

  // Panah penunjuk arah kedua setelah turunan menuju Drop Zone (X = -20.0, Z = -23.5)
  const arrowExit = new THREE.Mesh(arrowGeo, safetyYellowMat);
  arrowExit.position.set(-20.0, 0.02, -23.5);
  arrowExit.scale.set(1.0, 1.0, 0.05);
  arrowExit.receiveShadow = true;
  bridgeGroup.add(arrowExit);

  // H. PLATFORM AKHIR (UNLOADING DOCK PLATFORM) LEVEL 5:
  // Platform konkrit tegap di ujung lintasan tanjakan/turunan (X = -19.1 ke -24.5, Z = -20.8 ke -26.2)
  // Ketinggian platform y = 0.06m dengan bibir landai chamfer pada X = -19.05 agar roda meluncur mulus
  const dockPadGroup = new THREE.Group();
  dockPadGroup.name = 'Level5EndDockPlatform';

  const dockPlatformMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Slate industrial concrete
    roughness: 0.65,
    metalness: 0.2,
  });

  // Dek platform utama (tebal 0.06m, permukaan atas pada y = 0.06m)
  const padWidth = 5.4;  // Sepanjang paksi X: -19.1 ke -24.5 (tengah di -21.8)
  const padDepth = 5.4;  // Sepanjang paksi Z: -20.8 ke -26.2 (tengah di -23.5)
  const padHeight = 0.06;
  const padMesh = new THREE.Mesh(
    new THREE.BoxGeometry(padWidth, padHeight, padDepth),
    dockPlatformMat
  );
  padMesh.position.set(-21.8, padHeight / 2, -23.5);
  padMesh.receiveShadow = true;
  padMesh.castShadow = true;
  dockPadGroup.add(padMesh);

  // Ramp bibir landai (chamfer) di sisi timur platform (X = -19.05)
  const chamferMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, padHeight, padDepth),
    dockPlatformMat
  );
  chamferMesh.position.set(-19.05, padHeight / 3, -23.5);
  chamferMesh.rotation.z = Math.PI / 16;
  chamferMesh.receiveShadow = true;
  dockPadGroup.add(chamferMesh);

  // Jalur bendul tepi keselamatan (Kickboards) Utara & Selatan
  const kickPadN = new THREE.Mesh(new THREE.BoxGeometry(padWidth, 0.12, 0.16), kickboardMat);
  kickPadN.position.set(-21.8, padHeight + 0.06, -20.8);
  dockPadGroup.add(kickPadN);

  const kickPadS = new THREE.Mesh(new THREE.BoxGeometry(padWidth, 0.12, 0.16), kickboardMat);
  kickPadS.position.set(-21.8, padHeight + 0.06, -26.2);
  dockPadGroup.add(kickPadS);

  // Bendul pembatas di sisi barat dekat pintu roller shutter (X = -24.4)
  const stopBumperMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });
  const wheelStop = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, padDepth - 0.4), stopBumperMat);
  wheelStop.position.set(-24.4, padHeight + 0.09, -23.5);
  wheelStop.castShadow = true;
  dockPadGroup.add(wheelStop);

  bridgeGroup.add(dockPadGroup);

  return bridgeGroup;
}

