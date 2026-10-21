import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsWorld } from './physicsEngine.ts';

test('PhysicsWorld initializes with gravity pointing down', () => {
  const pw = new PhysicsWorld();
  assert.equal(pw.world.gravity.y, -9.82);
  assert.ok(pw.forkliftBody.position.y > 3.0, 'Forklift should spawn in the air');
});

test('Forklift falls down under gravity when simulation steps forward', () => {
  const pw = new PhysicsWorld();
  const initialY = pw.forkliftBody.position.y;

  // Step 20 frames (approx 0.33s)
  for (let i = 0; i < 20; i++) {
    pw.step(0.016);
  }

  assert.ok(pw.forkliftBody.position.y < initialY, 'Forklift should fall downwards');
  assert.ok(pw.forkliftBody.velocity.y < 0, 'Forklift should have downward vertical velocity');
});

test('Forklift settles on the ground plane and does not fall through floor', () => {
  const pw = new PhysicsWorld();

  // Step 120 frames (approx 2s, enough time to hit ground and settle)
  for (let i = 0; i < 120; i++) {
    pw.step(0.016);
  }

  // With half-height 0.5m, resting Y position should be approximately 0.5m
  assert.ok(pw.forkliftBody.position.y >= 0.45, 'Forklift should rest on top of the ground');
  assert.ok(pw.forkliftBody.position.y <= 0.8, 'Forklift should not be high in the air');
  assert.ok(Math.abs(pw.forkliftBody.velocity.y) < 0.2, 'Vertical velocity should be near zero when settled');
});

test('Driving forward propels forklift when grounded', () => {
  const pw = new PhysicsWorld();

  // First let it settle on the floor
  for (let i = 0; i < 80; i++) {
    pw.step(0.016);
  }

  const initialZ = pw.forkliftBody.position.z;

  // Apply forward movement (heading 0 points toward -Z)
  pw.applyMovement(true, false, false, false, false, 0.05);
  pw.step(0.05);

  assert.ok(pw.forkliftBody.velocity.z < 0, 'Velocity in Z should be negative when driving forward (heading 0)');
  assert.ok(pw.forkliftBody.position.z < initialZ, 'Position should advance forward in -Z direction');
});

test('dropForklift resets height to the air', () => {
  const pw = new PhysicsWorld();
  // Settle
  for (let i = 0; i < 80; i++) {
    pw.step(0.016);
  }
  assert.ok(pw.forkliftBody.position.y < 1.0);

  // Drop again
  pw.dropForklift(4.5, 2, -3);
  assert.equal(pw.forkliftBody.position.y, 4.5);
  assert.equal(pw.forkliftBody.position.x, 2);
  assert.equal(pw.forkliftBody.position.z, -3);
  assert.equal(pw.forkliftBody.velocity.y, 0);
});
