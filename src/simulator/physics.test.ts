import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateForkliftKinematics,
  getForkWorldPosition,
  canPickupCargo,
  isCargoInDropZone,
  SIM_CONSTANTS,
} from './physics.ts';
import type { ForkliftKinematics, InputState, CargoItem, DropZone } from './types.ts';

test('forklift accelerates forward when forward input is true', () => {
  const initial: ForkliftKinematics = {
    x: 0,
    z: 0,
    rotation: 0,
    speed: 0,
    steerAngle: 0,
    forkHeight: 0.1,
    wheelRotation: 0,
  };

  const input: InputState = {
    forward: true,
    backward: false,
    steerLeft: false,
    steerRight: false,
    forkUp: false,
    forkDown: false,
    brake: false,
    horn: false,
  };

  const next = updateForkliftKinematics(initial, input, 0.05);
  assert.ok(next.speed > 0, 'Forklift speed should increase');
  assert.ok(next.z < initial.z, 'Forklift moving forward with rotation 0 should move toward -Z');
});

test('forklift brakes properly when brake input is active', () => {
  const initial: ForkliftKinematics = {
    x: 0,
    z: 0,
    rotation: 0,
    speed: 4.0,
    steerAngle: 0,
    forkHeight: 0.1,
    wheelRotation: 0,
  };

  const input: InputState = {
    forward: false,
    backward: false,
    steerLeft: false,
    steerRight: false,
    forkUp: false,
    forkDown: false,
    brake: true,
    horn: false,
  };

  const next = updateForkliftKinematics(initial, input, 0.05);
  assert.ok(next.speed < initial.speed, 'Forklift speed should decelerate rapidly under brake');
});

test('forklift fork raises and lowers within limits', () => {
  const initial: ForkliftKinematics = {
    x: 0,
    z: 0,
    rotation: 0,
    speed: 0,
    steerAngle: 0,
    forkHeight: 0.5,
    wheelRotation: 0,
  };

  const inputUp: InputState = {
    forward: false,
    backward: false,
    steerLeft: false,
    steerRight: false,
    forkUp: true,
    forkDown: false,
    brake: false,
    horn: false,
  };

  const nextUp = updateForkliftKinematics(initial, inputUp, 0.1);
  assert.ok(nextUp.forkHeight > initial.forkHeight, 'Fork height should increase');

  const atMax: ForkliftKinematics = {
    ...initial,
    forkHeight: SIM_CONSTANTS.MAX_FORK_HEIGHT,
  };
  const nextAtMax = updateForkliftKinematics(atMax, inputUp, 0.1);
  assert.equal(nextAtMax.forkHeight, SIM_CONSTANTS.MAX_FORK_HEIGHT, 'Fork height should clamp at max');
});

test('canPickupCargo correctly detects proximity', () => {
  const forklift: ForkliftKinematics = {
    x: 0,
    z: 0,
    rotation: 0, // facing -Z
    speed: 0,
    steerAngle: 0,
    forkHeight: 0.1,
    wheelRotation: 0,
  };

  const forkPos = getForkWorldPosition(forklift); // around (0, 0.1, -1.7)

  const cargoNear: CargoItem = {
    id: 'crate-1',
    name: 'Pallet 1',
    x: forkPos.x,
    y: 0.2,
    z: forkPos.z,
    width: 1.0,
    height: 0.8,
    depth: 1.0,
    isLoaded: false,
    isDelivered: false,
    color: '#eab308',
  };

  assert.equal(canPickupCargo(forklift, cargoNear), true, 'Should allow pickup when fork is right at cargo');

  const cargoFar: CargoItem = {
    ...cargoNear,
    x: 10,
    z: 10,
  };
  assert.equal(canPickupCargo(forklift, cargoFar), false, 'Should not allow pickup when cargo is far');
});

test('isCargoInDropZone detects inside and outside boundaries', () => {
  const dropZone: DropZone = {
    x: 5,
    z: 5,
    width: 4,
    depth: 4,
    name: 'Zone A',
  };

  const insideCargo: CargoItem = {
    id: 'c1',
    name: 'Box',
    x: 5.5,
    y: 0.2,
    z: 4.8,
    width: 1,
    height: 1,
    depth: 1,
    isLoaded: false,
    isDelivered: false,
    color: '#fff',
  };

  const outsideCargo: CargoItem = {
    ...insideCargo,
    x: 12,
  };

  assert.equal(isCargoInDropZone(insideCargo, dropZone), true);
  assert.equal(isCargoInDropZone(outsideCargo, dropZone), false);
});
