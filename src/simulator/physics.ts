import type { ForkliftKinematics, InputState, CargoItem, DropZone } from './types.ts';

export const SIM_CONSTANTS = {
  MAX_FORWARD_SPEED: 7.5,   // m/s (~27 km/h)
  MAX_REVERSE_SPEED: 4.5,   // m/s (~16 km/h)
  ACCELERATION: 8.0,        // m/s^2
  BRAKE_DECELERATION: 16.0, // m/s^2
  ROLLING_RESISTANCE: 3.5,  // m/s^2
  MAX_STEER_ANGLE: 0.65,    // radians (~37 degrees)
  STEER_SPEED: 2.8,         // radians/s
  WHEEL_BASE: 1.8,          // meters distance between axles
  MIN_FORK_HEIGHT: 0.08,    // meters (ground rest)
  MAX_FORK_HEIGHT: 2.8,     // meters (lifted high)
  FORK_SPEED: 1.1,          // m/s
  WHEEL_RADIUS: 0.35,       // meters
  FORKLIFT_LENGTH: 2.8,     // meters
  FORKLIFT_WIDTH: 1.4,      // meters
  WAREHOUSE_BOUND_X: 24,    // half-width in meters (-24 to +24)
  WAREHOUSE_BOUND_Z: 28,    // half-depth in meters (-28 to +28)
};

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Updates forklift kinematics given inputs and delta time
 */
export function updateForkliftKinematics(
  current: ForkliftKinematics,
  input: InputState,
  dt: number,
  obstacles: ObstacleBox[] = []
): ForkliftKinematics {
  const clampedDt = Math.min(dt, 0.05);
  let { speed, rotation, steerAngle, forkHeight, wheelRotation, x, z } = current;

  // 1. Steering computation (smooth interpolation)
  let targetSteer = 0;
  if (input.steerLeft) targetSteer += SIM_CONSTANTS.MAX_STEER_ANGLE;
  if (input.steerRight) targetSteer -= SIM_CONSTANTS.MAX_STEER_ANGLE;

  if (steerAngle < targetSteer) {
    steerAngle = Math.min(targetSteer, steerAngle + SIM_CONSTANTS.STEER_SPEED * clampedDt);
  } else if (steerAngle > targetSteer) {
    steerAngle = Math.max(targetSteer, steerAngle - SIM_CONSTANTS.STEER_SPEED * clampedDt);
  }

  // 2. Acceleration / Braking
  if (input.brake) {
    if (speed > 0) {
      speed = Math.max(0, speed - SIM_CONSTANTS.BRAKE_DECELERATION * clampedDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + SIM_CONSTANTS.BRAKE_DECELERATION * clampedDt);
    }
  } else if (input.forward) {
    speed = Math.min(SIM_CONSTANTS.MAX_FORWARD_SPEED, speed + SIM_CONSTANTS.ACCELERATION * clampedDt);
  } else if (input.backward) {
    speed = Math.max(-SIM_CONSTANTS.MAX_REVERSE_SPEED, speed - SIM_CONSTANTS.ACCELERATION * clampedDt);
  } else {
    // Rolling friction
    if (speed > 0) {
      speed = Math.max(0, speed - SIM_CONSTANTS.ROLLING_RESISTANCE * clampedDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + SIM_CONSTANTS.ROLLING_RESISTANCE * clampedDt);
    }
  }

  // 3. Forklift bicycle-model turning kinematics with rear steering
  // Forklifts pivot around front axle while rear wheels steer
  if (Math.abs(speed) > 0.001) {
    const angularVelocity = (speed / SIM_CONSTANTS.WHEEL_BASE) * Math.sin(steerAngle);
    rotation += angularVelocity * clampedDt;
  }

  // 4. Position update (0 rotation = facing -Z)
  const forwardX = Math.sin(rotation);
  const forwardZ = -Math.cos(rotation);

  let nextX = x + forwardX * speed * clampedDt;
  let nextZ = z + forwardZ * speed * clampedDt;

  // 5. Perimeter boundary collision
  const margin = 1.4;
  const boundX = SIM_CONSTANTS.WAREHOUSE_BOUND_X - margin;
  const boundZ = SIM_CONSTANTS.WAREHOUSE_BOUND_Z - margin;

  if (nextX > boundX) { nextX = boundX; speed *= 0.2; }
  if (nextX < -boundX) { nextX = -boundX; speed *= 0.2; }
  if (nextZ > boundZ) { nextZ = boundZ; speed *= 0.2; }
  if (nextZ < -boundZ) { nextZ = -boundZ; speed *= 0.2; }

  // 6. Obstacle collision (AABB)
  for (const obs of obstacles) {
    const safeRadius = 1.1;
    if (
      nextX >= obs.minX - safeRadius &&
      nextX <= obs.maxX + safeRadius &&
      nextZ >= obs.minZ - safeRadius &&
      nextZ <= obs.maxZ + safeRadius
    ) {
      // Revert position and stop speed
      nextX = x;
      nextZ = z;
      speed = 0;
      break;
    }
  }

  // 7. Fork height adjustment
  if (input.forkUp) {
    forkHeight = Math.min(SIM_CONSTANTS.MAX_FORK_HEIGHT, forkHeight + SIM_CONSTANTS.FORK_SPEED * clampedDt);
  } else if (input.forkDown) {
    forkHeight = Math.max(SIM_CONSTANTS.MIN_FORK_HEIGHT, forkHeight - SIM_CONSTANTS.FORK_SPEED * clampedDt);
  }

  // 8. Wheel rolling animation
  wheelRotation += (speed * clampedDt) / SIM_CONSTANTS.WHEEL_RADIUS;

  return {
    x: nextX,
    z: nextZ,
    rotation,
    speed,
    steerAngle,
    forkHeight,
    wheelRotation,
  };
}

/**
 * Calculates current fork tip/tines position in world space
 */
export function getForkWorldPosition(forklift: ForkliftKinematics): { x: number; y: number; z: number } {
  // Forks protrude in front of forklift (~1.7m forward from center)
  const forwardDist = 1.7;
  const forwardX = -Math.sin(forklift.rotation);
  const forwardZ = -Math.cos(forklift.rotation);

  return {
    x: forklift.x + forwardX * forwardDist,
    y: forklift.forkHeight,
    z: forklift.z + forwardZ * forwardDist,
  };
}

/**
 * Checks if forklift forks are positioned properly to pick up a cargo crate
 */
export function canPickupCargo(
  forklift: ForkliftKinematics,
  cargo: CargoItem
): boolean {
  if (cargo.isLoaded || cargo.isDelivered) return false;

  const forkPos = getForkWorldPosition(forklift);
  const dx = forkPos.x - cargo.x;
  const dz = forkPos.z - cargo.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // Fork must be close to the cargo (within 1.1m) and at lower level
  const heightDiff = Math.abs(forkPos.y - (cargo.y - cargo.height * 0.3));

  return horizontalDist < 1.15 && heightDiff < 0.45 && forklift.forkHeight < 0.4;
}

/**
 * Checks if a cargo is successfully delivered inside a designated drop zone
 */
export function isCargoInDropZone(cargo: CargoItem, dropZone: DropZone): boolean {
  const halfW = dropZone.width / 2;
  const halfD = dropZone.depth / 2;

  const insideX = cargo.x >= dropZone.x - halfW && cargo.x <= dropZone.x + halfW;
  const insideZ = cargo.z >= dropZone.z - halfD && cargo.z <= dropZone.z + halfD;

  return insideX && insideZ;
}
