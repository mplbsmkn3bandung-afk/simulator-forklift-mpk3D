import * as THREE from 'three';

/**
 * Creates a high-detail procedural warehouse concrete floor texture with grid and lane markings
 */
export function createWarehouseFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Concrete base tone
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Subtle concrete grain / speckle
  ctx.fillStyle = '#2a2d33';
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const radius = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Grid lines (large warehouse tiles 256x256)
  const tileSize = 128;
  ctx.strokeStyle = '#323741';
  ctx.lineWidth = 2;

  for (let x = 0; x <= 1024; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  for (let y = 0; y <= 1024; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // 4. Accent grid intersections
  ctx.fillStyle = '#424854';
  for (let x = 0; x <= 1024; x += tileSize) {
    for (let y = 0; y <= 1024; y += tileSize) {
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  // 5. Subtle industrial yellow lane line along one axis
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
  ctx.lineWidth = 6;
  ctx.setLineDash([24, 16]);
  ctx.beginPath();
  ctx.moveTo(512, 0);
  ctx.lineTo(512, 1024);
  ctx.stroke();
  ctx.setLineDash([]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 14);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates procedural black and yellow hazard safety stripes
 */
export function createHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308'; // Safety yellow
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#18181b'; // Dark black
  ctx.beginPath();
  const stripeW = 32;
  for (let x = -256; x < 512; x += stripeW * 2) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW + 256, 256);
    ctx.lineTo(x + 256, 256);
    ctx.closePath();
  }
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates cardboard box texture with industrial cargo stamps
 */
export function createCardboardTexture(label: string = 'FRAGILE'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Cardboard base color
  ctx.fillStyle = '#a2764b';
  ctx.fillRect(0, 0, 512, 512);

  // Noise / grain
  ctx.fillStyle = '#8f653b';
  for (let i = 0; i < 2000; i++) {
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 2);
  }

  // Tape on center
  ctx.fillStyle = '#b88c5d';
  ctx.fillRect(0, 240, 512, 32);

  // Border outline
  ctx.strokeStyle = '#75502c';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 500);

  // Stamp badge
  ctx.fillStyle = '#1e1b18';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, 256, 180);

  // Up arrows stamp
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('↑ ↑', 256, 360);

  // Barcode representation
  ctx.fillStyle = '#1e1b18';
  for (let x = 180; x < 332; x += 6) {
    if (Math.random() > 0.3) {
      ctx.fillRect(x, 400, 3, 30);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates high-visibility bright green floor texture for the Delivery Drop Zone
 */
export function createDropZoneFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Semi-translucent deep emerald base pad
  ctx.fillStyle = '#062d1c';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Subtle internal grid
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = step; i < 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // 3. Thick bright green boundary lines (garis hijau terang)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 32;
  ctx.strokeRect(16, 16, 992, 992);

  // Inner accent line
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 8;
  ctx.strokeRect(48, 48, 928, 928);

  // 4. Heavy L-shaped corner brackets (Bright Neon Lime)
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 20;
  ctx.lineCap = 'square';
  const bSize = 140;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(60, 60 + bSize);
  ctx.lineTo(60, 60);
  ctx.lineTo(60 + bSize, 60);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(964 - bSize, 60);
  ctx.lineTo(964, 60);
  ctx.lineTo(964, 60 + bSize);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(60, 964 - bSize);
  ctx.lineTo(60, 964);
  ctx.lineTo(60 + bSize, 964);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(964 - bSize, 964);
  ctx.lineTo(964, 964);
  ctx.lineTo(964, 964 - bSize);
  ctx.stroke();

  // 5. Pallet Target Footprint Box in Center
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 6;
  ctx.setLineDash([20, 14]);
  ctx.strokeRect(312, 312, 400, 400);
  ctx.setLineDash([]);

  // Center crosshair
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(512, 360);
  ctx.lineTo(512, 664);
  ctx.moveTo(360, 512);
  ctx.lineTo(664, 512);
  ctx.stroke();

  // 6. Large Text Stencils on Floor
  ctx.fillStyle = '#4ade80';
  ctx.font = '900 68px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AREA PENGIRIMAN', 512, 230);

  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('▼ DROP ZONE · LEVEL 1 ▼', 512, 285);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 42px monospace';
  ctx.fillText('LETAKKAN PALET DI SINI', 512, 755);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('▲ TURUNKAN GARPU HINGGA LANTAI ▲', 512, 805);

  // Directional inward chevrons on sides
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('►', 140, 512);
  ctx.fillText('◄', 884, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates high-visibility bright green texture for Level 2 upper shelf Drop Zone
 */
export function createShelfDropZoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Semi-translucent deep emerald base pad
  ctx.fillStyle = '#062d1c';
  ctx.fillRect(0, 0, 1024, 512);

  // 2. Subtle internal grid
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = step; i < 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }
  for (let j = step; j < 512; j += step) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(1024, j);
    ctx.stroke();
  }

  // 3. Thick bright green boundary lines (garis hijau terang)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 24;
  ctx.strokeRect(12, 12, 1000, 488);

  // Inner accent line
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 952, 440);

  // 4. L-shaped corner brackets (Bright Neon Lime)
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 16;
  ctx.lineCap = 'square';
  const bSize = 90;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(48, 48 + bSize);
  ctx.lineTo(48, 48);
  ctx.lineTo(48 + bSize, 48);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(976 - bSize, 48);
  ctx.lineTo(976, 48);
  ctx.lineTo(976, 48 + bSize);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(48, 464 - bSize);
  ctx.lineTo(48, 464);
  ctx.lineTo(48 + bSize, 464);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(976 - bSize, 464);
  ctx.lineTo(976, 464);
  ctx.lineTo(976, 464 - bSize);
  ctx.stroke();

  // 5. Pallet Target Footprint Box in Center (1.2m x 1.1m scaled)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 5;
  ctx.setLineDash([16, 10]);
  ctx.strokeRect(330, 110, 364, 292);
  ctx.setLineDash([]);

  // Center crosshair
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(512, 180);
  ctx.lineTo(512, 332);
  ctx.moveTo(420, 256);
  ctx.lineTo(604, 256);
  ctx.stroke();

  // 6. Text Stencils
  ctx.fillStyle = '#4ade80';
  ctx.font = '900 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AREA PENGIRIMAN · LEVEL 2', 512, 80);

  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('▼ DROP ZONE DI ATAS RAK (1.36m) ▼', 512, 230);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('LETAKKAN PALET DI ATAS RAK', 512, 420);

  // Directional inward chevrons on sides
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('►', 120, 256);
  ctx.fillText('◄', 904, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates high-visibility industrial floor warning tape texture for Level 4 route navigation
 * (Yellow warning tape with black diagonal hazard stripes, bold black borders, and forward chevrons)
 */
export function createIndustrialWarningTapeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // 1. Safety vibrant yellow background
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 512, 128);

  // 2. High-contrast hazard diagonal black stripes on top and bottom margins
  ctx.fillStyle = '#18181b';
  const stripeW = 32;
  for (let x = -128; x < 640; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW + 128, 128);
    ctx.lineTo(x + 128, 128);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Central safety band
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 32, 512, 64);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 32, 512, 64);

  // 4. Bold directional forward chevrons along the center: >>>
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let cx = 48; cx < 512; cx += 80) {
    ctx.beginPath();
    ctx.moveTo(cx - 16, 46);
    ctx.lineTo(cx + 10, 64);
    ctx.lineTo(cx - 16, 82);
    ctx.stroke();
  }

  // 5. Outer border solid trims
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 512, 6);
  ctx.fillRect(0, 122, 512, 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


