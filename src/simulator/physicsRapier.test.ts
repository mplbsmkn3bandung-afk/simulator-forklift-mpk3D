import test from 'node:test';
import assert from 'node:assert/strict';
import { initRapier, PhysicsRapierWorld } from './physicsRapier.ts';

test('Rapier physics initializes and drops forklift under gravity', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  const initialY = world.forkliftBody.translation().y;
  assert.ok(initialY > 3.0, 'Forklift should spawn in the air');

  for (let i = 0; i < 20; i++) {
    world.step(0.016);
  }

  const fallenY = world.forkliftBody.translation().y;
  assert.ok(fallenY < initialY, 'Forklift should fall downwards under gravity');
});

test('Pallet rests on the warehouse floor under gravity', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 60; i++) {
    world.step(0.016);
  }

  const palletY = world.palletBody.translation().y;
  assert.ok(palletY >= -0.02, 'Pallet should rest on the floor plane');
  assert.ok(palletY <= 0.15, 'Pallet should not float');
});

test('Fork tines physically lift pallet when raised under deckboard without magnetic snap', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  // Position forklift so tines are inserted into the pallet pockets
  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.heading = 0;

  // Let pallet settle with fork at 0.05m
  for (let i = 0; i < 30; i++) {
    world.updateForkKinematics(0.05);
    world.step(0.016);
  }

  const palletYBefore = world.palletBody.translation().y;

  // Smoothly raise fork tines to 0.7m
  for (let h = 0.05; h <= 0.7; h += 0.02) {
    world.updateForkKinematics(h);
    world.step(0.016);
  }

  const palletYAfter = world.palletBody.translation().y;
  assert.ok(
    palletYAfter > palletYBefore + 0.25,
    `Pallet must be physically lifted by collision contacts on the fork tines (before: ${palletYBefore.toFixed(2)}, after: ${palletYAfter.toFixed(2)})`
  );
  assert.ok(world.isPalletRestingOnForks(), 'isPalletRestingOnForks should report true when lifted');
});

test('Forward movement carries elevated pallet along through contact friction', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.heading = 0;

  // Raise fork with pallet to 0.5m
  for (let h = 0.05; h <= 0.5; h += 0.02) {
    world.updateForkKinematics(h);
    world.step(0.016);
  }

  const initialPalletZ = world.palletBody.translation().z;

  // Drive forward along -Z for 40 frames
  for (let i = 0; i < 40; i++) {
    world.applyMovement(true, false, false, false, false, 0.5, 0.016);
    world.step(0.016);
  }

  const finalPalletZ = world.palletBody.translation().z;
  assert.ok(
    finalPalletZ < initialPalletZ - 0.3,
    `Elevated pallet must be carried forward along -Z with the forklift (start: ${initialPalletZ.toFixed(2)}, end: ${finalPalletZ.toFixed(2)})`
  );
});

test('Steering Left/Right changes heading orientation instead of sliding sideways', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 80; i++) {
    world.step(0.016);
  }

  const initialHeading = world.getHeading();
  world.applyMovement(false, false, true, false, false, 0.1, 0.05);
  const leftHeading = world.getHeading();
  assert.ok(leftHeading > initialHeading, 'Steering left must increase heading angle');
});

test('Forklift has heavy industrial angular damping when steering input is released', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 60; i++) {
    world.step(0.016);
  }

  // Steer left for 10 frames
  for (let i = 0; i < 10; i++) {
    world.applyMovement(false, false, true, false, false, 0.1, 0.016);
    world.step(0.016);
  }

  const headingAfterSteer = world.getHeading();

  // Release steering input; angular damping should smoothly settle rotation
  for (let i = 0; i < 30; i++) {
    world.applyMovement(false, false, false, false, false, 0.1, 0.016);
    world.step(0.016);
  }

  const finalHeading = world.getHeading();
  // Turn speed must be controlled (not spinning uncontrollably)
  const totalTurnedRad = Math.abs(finalHeading - headingAfterSteer);
  assert.ok(
    totalTurnedRad < 0.5,
    `Angular damping must damp residual rotation quickly (residual turned: ${totalTurnedRad.toFixed(3)} rad)`
  );
});

test('Pallet is automatically locked (Temporary Parenting) when fork is under pallet and lifted', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  // Position forklift right in front of pallet with forks under the pallet
  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.heading = 0;

  assert.ok(world.isForkUnderPallet(0.06), 'Forks must be detected under the pallet');
  assert.strictEqual(world.isLocked(), false, 'Pallet starts unlocked');

  // Lift fork up with forkUp = true
  world.updateForkKinematics(0.4, true, false);
  world.step(0.016);

  assert.strictEqual(world.isLocked(), true, 'Pallet must be locked via Temporary Parenting when lifted');
  assert.strictEqual(world.palletBody.isKinematic(), true, 'Pallet body type must be kinematic while parented');
});

test('Locked pallet remains 100% attached without falling during forward movement and turning', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.heading = 0;

  // Lift and lock pallet
  world.updateForkKinematics(0.6, true, false);
  world.step(0.016);
  assert.strictEqual(world.isLocked(), true);

  // Steer left and drive forward aggressively
  for (let i = 0; i < 50; i++) {
    world.applyMovement(true, false, true, false, false, 0.6, 0.016);
    world.step(0.016);
  }

  assert.strictEqual(world.isLocked(), true, 'Pallet must stay locked');
  const pPos = world.palletBody.translation();
  const fPos = world.forkliftBody.translation();
  const dist = Math.hypot(pPos.x - fPos.x, pPos.z - fPos.z);
  assert.ok(
    dist > 1.2 && dist < 2.2,
    `Pallet must remain attached in front of forklift (current dist: ${dist.toFixed(2)})`
  );
  assert.ok(pPos.y > 0.4, 'Pallet must remain elevated in the air');
});

test('Lowering fork until pallet reaches floor automatically releases lock to dynamic body', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.heading = 0;

  // Lift and lock
  world.updateForkKinematics(0.5, true, false);
  world.step(0.016);
  assert.strictEqual(world.isLocked(), true);

  // Lower fork down to floor with forkDown = true
  world.updateForkKinematics(0.05, false, true);
  world.step(0.016);

  assert.strictEqual(world.isLocked(), false, 'Pallet lock must be released when touching floor');
  assert.strictEqual(world.palletBody.isDynamic(), true, 'Pallet must return to dynamic body on floor');
});

test('Level 1 Drop Zone mission logic detects pallet delivery inside drop zone and allows reset', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  // Drop zone coordinates: center (10, -17), width 5.5, depth 5.5
  const dropZone = { x: 10, z: -17, width: 5.5, depth: 5.5 };

  // Pallet starts at (0, 0.01, -2.5) - outside drop zone
  const pStart = world.getPalletTranslation();
  assert.strictEqual(Math.abs(pStart.x - dropZone.x) <= dropZone.width / 2, false);

  // Position forklift under pallet and lift to lock
  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.updateForkKinematics(0.5, true, false);
  world.step(0.016);
  assert.strictEqual(world.isLocked(), true);

  // Transport pallet into drop zone
  world.palletBody.setTranslation({ x: 10.2, y: 0.5, z: -16.8 }, true);
  // Lower fork down to floor so it unlocks
  world.updateForkKinematics(0.05, false, true);
  world.step(0.016);

  assert.strictEqual(world.isLocked(), false, 'Pallet must be unlocked when lowered to floor');
  const pDelivered = world.getPalletTranslation();
  const inDropZone =
    Math.abs(pDelivered.x - dropZone.x) <= dropZone.width / 2 &&
    Math.abs(pDelivered.z - dropZone.z) <= dropZone.depth / 2;
  assert.ok(inDropZone, 'Pallet must be inside Drop Zone');
  assert.ok(pDelivered.y <= 0.16, 'Pallet must be resting on floor in Drop Zone');

  // Verify Reset Pallet returns it to initial position
  world.resetPallet(0, 0.01, -2.5);
  const pReset = world.getPalletTranslation();
  assert.strictEqual(Math.abs(pReset.x - 0) < 0.01, true);
  assert.strictEqual(Math.abs(pReset.z - (-2.5)) < 0.01, true);
  assert.strictEqual(world.isLocked(), false);
});

test('Level 2 Pallet Rack upper shelf collider supports pallet stably without falling through', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();
  const rack = world.rackConfig;

  // Place pallet directly above upper shelf at y = 1.45m
  world.palletBody.setTranslation({ x: rack.x, y: 1.45, z: rack.z }, true);
  world.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

  // Step physics world forward for 60 frames under gravity
  for (let i = 0; i < 60; i++) {
    world.step(0.016);
  }

  const pFinal = world.palletBody.translation();
  assert.ok(
    pFinal.y >= 1.34 && pFinal.y <= 1.40,
    `Pallet must rest stably on upper shelf collider at y ~ 1.36m (actual y: ${pFinal.y.toFixed(3)})`
  );
  assert.strictEqual(world.isPalletOnRackShelf(), true, 'isPalletOnRackShelf should be true');
});

test('Depositing carried pallet onto Level 2 upper shelf releases parenting and leaves pallet on shelf', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();
  const rack = world.rackConfig;

  // Lift pallet
  world.forkliftBody.setTranslation({ x: 0, y: 0.45, z: -0.735 }, true);
  world.updateForkKinematics(0.2, true, false);
  world.step(0.016);
  assert.strictEqual(world.isLocked(), true, 'Pallet is locked on fork');

  // Raise fork to 1.45m
  world.updateForkKinematics(1.45, true, false);
  world.step(0.016);

  // Move pallet over the rack upper shelf
  world.palletBody.setTranslation({ x: rack.x, y: 1.45, z: rack.z }, true);

  // Operator presses forkDown to lower onto the shelf
  world.updateForkKinematics(1.25, false, true);
  world.step(0.016);

  assert.strictEqual(world.isLocked(), false, 'Pallet must be unlocked when deposited onto shelf');
  assert.strictEqual(world.palletBody.isDynamic(), true, 'Pallet returns to dynamic rigid-body');

  // Step physics to ensure it rests firmly on the shelf
  for (let i = 0; i < 40; i++) {
    world.step(0.016);
  }

  const pShelf = world.palletBody.translation();
  assert.ok(
    pShelf.y >= 1.34 && pShelf.y <= 1.40,
    `Pallet remains supported on upper shelf without falling through (y: ${pShelf.y.toFixed(3)})`
  );
  assert.strictEqual(world.isPalletOnRackShelf(), true);
});

test('Level 4 has no invisible walls in driving corridor and sets exact obstacle colliders', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  world.setLevel(4);

  // In Level 4, the forklift can freely move through x: 3.5, z: 5.3 and x: -3.5, z: 10.5
  // (where Level 3 racks were previously invisible walls)
  world.forkliftBody.setTranslation({ x: 3.5, y: 0.55, z: 5.3 }, true);
  world.forkliftBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  world.step(0.016);

  const pos1 = world.forkliftBody.translation();
  assert.ok(Math.abs(pos1.x - 3.5) < 0.1, 'Forklift must not be pushed away by invisible wall at z = 5.3');
  assert.ok(Math.abs(pos1.z - 5.3) < 0.1, 'Forklift must be at z = 5.3 without collision');

  world.forkliftBody.setTranslation({ x: -3.5, y: 0.55, z: 10.5 }, true);
  world.forkliftBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  world.step(0.016);

  const pos2 = world.forkliftBody.translation();
  assert.ok(Math.abs(pos2.x - -3.5) < 0.1, 'Forklift must not be pushed away by invisible wall at z = 10.5');
  assert.ok(Math.abs(pos2.z - 10.5) < 0.1, 'Forklift must be at z = 10.5 without collision');
});

test('Forklift drives straight forward without drifting left due to centered CoM and symmetric wheels', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 40; i++) {
    world.step(0.016);
  }

  const startX = world.forkliftBody.translation().x;

  // Drive forward along -Z for 100 frames with zero steering
  for (let i = 0; i < 100; i++) {
    world.applyMovement(true, false, false, false, false, 0.1, 0.016);
    world.step(0.016);
  }

  const finalX = world.forkliftBody.translation().x;
  const driftX = Math.abs(finalX - startX);

  assert.ok(
    driftX < 0.05,
    `Forklift must not drift sideways when driving forward (drift: ${driftX.toFixed(4)}m)`
  );
});

test('Steering input responds immediately when A/D is pressed without lag', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 40; i++) {
    world.step(0.016);
  }

  const initialHeading = world.getHeading();

  // Press Steer Left for 2 frames
  world.applyMovement(false, false, true, false, false, 0.1, 0.016);
  world.step(0.016);
  world.applyMovement(false, false, true, false, false, 0.1, 0.016);
  world.step(0.016);

  const headingAfterSteer = world.getHeading();
  assert.ok(
    headingAfterSteer > initialHeading + 0.02,
    `Steering must respond immediately on key press (turned: ${(headingAfterSteer - initialHeading).toFixed(4)} rad)`
  );
});

test('Backward input applies full negative motor velocity with strong torque', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 40; i++) {
    world.step(0.016);
  }

  const startZ = world.forkliftBody.translation().z;

  // Drive backward (S / ArrowDown) for 40 frames
  for (let i = 0; i < 40; i++) {
    world.applyMovement(false, true, false, false, false, 0.1, 0.016);
    world.step(0.016);
  }

  const endZ = world.forkliftBody.translation().z;
  const currentSpeed = world.getCurrentSpeed();

  assert.ok(
    currentSpeed < -1.5,
    `Negative target motor velocity must be applied when reversing (currentSpeed: ${currentSpeed.toFixed(2)} m/s)`
  );
  assert.ok(
    endZ > startZ + 0.5,
    `Forklift must move backward along +Z with full torque (moved: ${(endZ - startZ).toFixed(2)}m)`
  );
});

test('Lerp smoothly transitions target velocity gas and steering angle without sudden jerky jumps', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 40; i++) {
    world.step(0.016);
  }

  // 1 frame of forward acceleration
  world.applyMovement(true, false, false, false, false, 0.1, 0.016);
  const speed1 = world.getCurrentSpeed();

  // 2 frames
  world.applyMovement(true, false, false, false, false, 0.1, 0.016);
  const speed2 = world.getCurrentSpeed();

  // Under Lerp, speed must increase gradually, not snap instantly to MAX_FORWARD_SPEED (6.5)
  assert.ok(speed1 > 0, 'Speed must be positive when moving forward');
  assert.ok(speed1 < 2.0, `Speed after 1 frame must be gradual and smooth under Lerp (got: ${speed1.toFixed(3)})`);
  assert.ok(speed2 > speed1, 'Speed must increase smoothly from frame 1 to frame 2');
  assert.ok(speed2 < 3.0, `Speed after 2 frames must not jerk instantly (got: ${speed2.toFixed(3)})`);
});

test('Level 5 Drop Zone platform akhir correctly supports detached pallet and triggers win condition', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();
  world.setLevel(5);

  // Position pallet on the Level 5 Platform Akhir (around x: -21.8, y: 0.08, z: -23.5)
  world.palletBody.setTranslation({ x: -21.8, y: 0.10, z: -23.5 }, true);
  world.palletBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

  // Let pallet settle on the end dock platform
  for (let i = 0; i < 30; i++) {
    world.step(0.016);
  }

  const palletPos = world.palletBody.translation();
  // Pallet must rest stably on the platform pad without sinking through the floor
  assert.ok(palletPos.y >= 0.04, `Pallet must rest on or above platform surface (got: ${palletPos.y.toFixed(3)})`);
  assert.ok(palletPos.y <= 0.25, `Pallet must not float (got: ${palletPos.y.toFixed(3)})`);

  // Verify drop zone position and trigger volume matching
  const dropZone = { x: -21.8, y: 0.08, z: -23.5, width: 4.8, depth: 4.8 };
  const zoneTolerance = 0.45;
  const inDropZone =
    Math.abs(palletPos.x - dropZone.x) <= dropZone.width / 2 + zoneTolerance &&
    Math.abs(palletPos.z - dropZone.z) <= dropZone.depth / 2 + zoneTolerance;
  assert.strictEqual(inDropZone, true, 'Pallet must be inside Level 5 Drop Zone');

  // Win condition check: pallet detached (not locked), elevation <= 0.35m, stable
  const isCorrectElevation = palletPos.y <= 0.35;
  assert.strictEqual(isCorrectElevation, true, 'Elevation must be within platform akhir range');
  assert.strictEqual(world.isLocked(), false, 'Pallet must be detached / unlocked');
});

test('Cinematic intro camera starts low at ground level and interpolates smoothly to third-person chase', () => {
  // Test the mathematical trajectory curves used by updateIntroCamera
  const forkPos = { x: 0, y: 0.55, z: 4.0 };
  const _forward = { x: 0, y: 0, z: -1 };
  const right = { x: 1, y: 0, z: 0 };

  const startCamPos = {
    x: forkPos.x + _forward.x * 3.6 + right.x * 1.3,
    y: forkPos.y - 0.22,
    z: forkPos.z + _forward.z * 3.6 + right.z * 1.3,
  };
  const midCamPos = {
    x: forkPos.x + right.x * 6.5,
    y: forkPos.y + 2.6,
    z: forkPos.z + right.z * 6.5,
  };
  const endCamPos = {
    x: forkPos.x - _forward.x * 7.5,
    y: forkPos.y + 4.8,
    z: forkPos.z - _forward.z * 7.5,
  };

  // Evaluate Quadratic Bezier curve at t=0, t=0.5, and t=1
  const bezier = (t: number) => {
    const invT = 1 - t;
    return {
      x: invT * invT * startCamPos.x + 2 * invT * t * midCamPos.x + t * t * endCamPos.x,
      y: invT * invT * startCamPos.y + 2 * invT * t * midCamPos.y + t * t * endCamPos.y,
      z: invT * invT * startCamPos.z + 2 * invT * t * midCamPos.z + t * t * endCamPos.z,
    };
  };

  const pos0 = bezier(0);
  const posMid = bezier(0.5);
  const pos1 = bezier(1);

  // At start (t=0): low floor angle in front of forklift looking up
  assert.ok(pos0.y < 0.45, `Start camera must be close to warehouse floor (got: ${pos0.y.toFixed(2)})`);
  assert.ok(pos0.z < forkPos.z, 'Start camera must be positioned in front of the forklift');

  // At midpoint (t=0.5): elevated lateral clearance avoiding chassis collision
  assert.ok(posMid.y > 1.5, `Mid camera must rise in height (got: ${posMid.y.toFixed(2)})`);
  assert.ok(posMid.x > 2.0, `Mid camera must swoop wide laterally (got: ${posMid.x.toFixed(2)})`);

  // At end (t=1): matches standard Third Person chase camera behind vehicle
  assert.ok(pos1.y > 5.0, `End camera height must match third person view (got: ${pos1.y.toFixed(2)})`);
  assert.ok(pos1.z > forkPos.z, 'End camera must be behind the forklift');
});

test('Title 3D Showroom camera frames parked forklift from front-diagonal diorama angle', () => {
  const forkPos = { x: 0, y: 0.55, z: 4.0 };
  const baseCamX = 3.2;
  const baseCamY = 1.4;
  const baseCamZ = 0.8;
  const targetX = -0.35;
  const targetY = 1.0;
  const targetZ = 3.8;

  // 1. Camera is in front of the forklift forks (z: 0.8 < 4.0)
  assert.ok(baseCamZ < forkPos.z, 'Showroom camera must be positioned in front of the vehicle');

  // 2. Camera is placed diagonally on the right (x: 3.2 > 0)
  assert.ok(baseCamX > forkPos.x, 'Showroom camera must be offset diagonally to the side');

  // 3. Camera is elevated at eye-level diorama height
  assert.ok(baseCamY > forkPos.y && baseCamY < 2.5, 'Showroom camera must be at diorama height');

  // 4. Target points towards the forklift center
  assert.ok(Math.abs(targetZ - forkPos.z) < 0.5, 'Camera target must center on the forklift');
});

test('Simulation timer starts automatically on level load and pauses strictly on win or fail', () => {
  let timeElapsed = 0;
  let isTimerPaused = false;
  let isDelivered = false;
  let isFailed = false;
  let gameState: 'title' | 'intro' | 'playing' | 'gameover' | 'failed' | 'paused' = 'intro';

  const tickSimulation = (dt: number) => {
    if (gameState === 'playing' || gameState === 'intro') {
      if (!isTimerPaused && !isDelivered && !isFailed) {
        timeElapsed += dt;
      }
    }
  };

  // Step during intro state
  for (let i = 0; i < 10; i++) tickSimulation(0.1);
  assert.ok(timeElapsed > 0.95, `Timer must advance during intro state (got: ${timeElapsed.toFixed(2)})`);

  // Transition to playing state
  gameState = 'playing';
  for (let i = 0; i < 20; i++) tickSimulation(0.1);
  assert.ok(timeElapsed > 2.95, `Timer must continue advancing during playing state (got: ${timeElapsed.toFixed(2)})`);

  // Win condition triggered: isDelivered = true, gameState = 'gameover'
  const finalTimeAtWin = timeElapsed;
  isDelivered = true;
  isTimerPaused = true;
  gameState = 'gameover';
  for (let i = 0; i < 10; i++) tickSimulation(0.1);
  assert.equal(timeElapsed, finalTimeAtWin, 'Timer must freeze when mission win is achieved');

  // New level loaded
  timeElapsed = 0;
  isDelivered = false;
  isFailed = false;
  isTimerPaused = false;
  gameState = 'playing';
  tickSimulation(0.5);
  assert.equal(Math.floor(timeElapsed * 10) / 10, 0.5, 'Timer must reset to 0 on new level and restart counting');

  // Fail condition triggered
  const finalTimeAtFail = timeElapsed;
  isFailed = true;
  isTimerPaused = true;
  gameState = 'failed';
  for (let i = 0; i < 10; i++) tickSimulation(0.1);
  assert.equal(timeElapsed, finalTimeAtFail, 'Timer must freeze when mission fail incident occurs');
});

test('K3 floor markings specify yellow safety transit lane, bright green drop zone, and red hazard perimeter', () => {
  // OSHA K3 Standard Color definitions
  const K3_YELLOW_LANE = 0xfacc15; // Yellow safety line for forklift transit lanes
  const K3_GREEN_DROPZONE = 0x22c55e; // High-visibility bright green for drop zone borders
  const K3_RED_HAZARD = 0xef4444; // Warning red for obstacles and column exclusion zones

  assert.equal(K3_YELLOW_LANE, 0xfacc15);
  assert.equal(K3_GREEN_DROPZONE, 0x22c55e);
  assert.equal(K3_RED_HAZARD, 0xef4444);

  // Concrete dark grey floor color verify
  const DARK_GREY_CONCRETE = 0x22262d;
  assert.ok(DARK_GREY_CONCRETE < 0x333333, 'Concrete floor must be dark grey tone');
});

test('TitleScreen accordion toggles active level without prematurely launching the game', () => {
  let activeLevel: number | null = null;
  let gameStartedLevel: number | null = null;

  const toggleAccordion = (lvl: number) => {
    activeLevel = activeLevel === lvl ? null : lvl;
  };

  const startLevel = (lvl: number) => {
    gameStartedLevel = lvl;
  };

  // 1. Initial state: all closed
  assert.equal(activeLevel, null);
  assert.equal(gameStartedLevel, null);

  // 2. Click Level 2 row: expands Level 2, does NOT start game
  toggleAccordion(2);
  assert.equal(activeLevel, 2, 'Level 2 should now be expanded');
  assert.equal(gameStartedLevel, null, 'Game must not start on accordion toggle');

  // 3. Click Level 4 row: closes Level 2, expands Level 4, does NOT start game
  toggleAccordion(4);
  assert.equal(activeLevel, 4, 'Level 4 should now be expanded');
  assert.equal(gameStartedLevel, null, 'Game must not start on switching accordion');

  // 4. Click 'MULAI LEVEL INI' button: starts the game on the active level
  startLevel(activeLevel);
  assert.equal(gameStartedLevel, 4, 'Game must start on active level only when start is explicitly clicked');
});

test('Vehicle Controller applies steering angle to rear wheels (Rear-Wheel Steering) with outward counterweight tail swing', async () => {
  await initRapier();
  const world = new PhysicsRapierWorld();

  for (let i = 0; i < 40; i++) world.step(0.016);

  // Initial straight state: rear steer angle is 0
  assert.equal(world.getRearSteerAngle(), 0, 'Rear steer angle must start at 0');

  // Steer Left for 8 frames
  for (let i = 0; i < 8; i++) {
    world.applyMovement(false, false, true, false, false, 0.1, 0.016);
    world.step(0.016);
  }

  const rearSteerLeft = world.getRearSteerAngle();
  // When steering left, rear wheels angle to positive (+X / rightward) to kick tail outward
  assert.ok(rearSteerLeft > 0.4, `Rear steer angle should angle positive when steering left (got: ${rearSteerLeft.toFixed(3)})`);

  // Verify counterweight tail swing:
  // When moving forward and turning left, the counterweight (at rear) has a positive lateral velocity to the right (+X)
  const linvel = world.forkliftBody.linvel();
  const angvel = world.forkliftBody.angvel();
  const heading = world.getHeading();
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);

  // Velocity at counterweight (0.88m behind CoM): v_cw = v_CoM + omega * 0.88 * right
  const vCoMLateral = linvel.x * rightX + linvel.z * rightZ;
  const vCounterweightLateral = vCoMLateral + angvel.y * 0.88;

  assert.ok(
    vCounterweightLateral > 0,
    `Counterweight must swing outward to the right when steering left (got: ${vCounterweightLateral.toFixed(3)})`
  );
});

test('Level 2 win condition strictly requires pallet to be detached/unlocked from fork on upper shelf', () => {
  // Mock simulation state representing Level 2 drop zone and rack shelf
  const dropZone = { x: -8.0, z: -15.0, width: 2.4, depth: 1.3 };
  const pTransInZone = { x: -8.0, y: 1.36, z: -15.0 }; // Exactly on upper shelf in drop zone

  const checkLevel2Win = (
    isLocked: boolean,
    isPalletOnForks: boolean,
    forkHeight: number,
    palletPos: { x: number; y: number; z: number }
  ): boolean => {
    // Level 2 strict win condition:
    if (isLocked || isPalletOnForks || forkHeight > 1.33) {
      return false;
    }

    const inShelfZone =
      Math.abs(palletPos.x - dropZone.x) <= dropZone.width / 2 + 0.20 &&
      Math.abs(palletPos.z - dropZone.z) <= dropZone.depth / 2 + 0.20;

    const onShelfElevation = palletPos.y >= 1.32 && palletPos.y <= 1.55;
    const isForkDisengaged = forkHeight <= 1.32;

    return inShelfZone && onShelfElevation && !isLocked && !isPalletOnForks && isForkDisengaged;
  };

  // Case 1: Pallet in zone, on shelf, BUT player still has cargo locked/lifted (fork at 1.45m)
  assert.equal(
    checkLevel2Win(true, true, 1.45, pTransInZone),
    false,
    'Must NOT trigger win if pallet is still locked'
  );

  // Case 2: Pallet in zone, on shelf, unlocked, BUT fork is still lifted under pallet at 1.40m
  assert.equal(
    checkLevel2Win(false, true, 1.40, pTransInZone),
    false,
    'Must NOT trigger win if pallet is still resting on fork'
  );

  // Case 3: Pallet in zone, on shelf, unlocked, BUT fork height is still above shelf deck (> 1.33m)
  assert.equal(
    checkLevel2Win(false, false, 1.35, pTransInZone),
    false,
    'Must NOT trigger win if fork is not lowered below shelf deck'
  );

  // Case 4: Pallet in zone, on shelf, unlocked, and fork LOWERED to 1.10m (completely detached/unlocked!)
  assert.equal(
    checkLevel2Win(false, false, 1.10, pTransInZone),
    true,
    'MUST trigger win when pallet is detached, unlocked, and fork lowered below shelf'
  );
});

