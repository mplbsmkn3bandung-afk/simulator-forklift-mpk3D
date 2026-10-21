export type GameState = 'title' | 'intro' | 'playing' | 'paused' | 'gameover' | 'failed';

export type CameraMode = 'chase' | 'overhead' | 'driver';

export interface ForkliftKinematics {
  x: number;
  z: number;
  rotation: number; // yaw angle in radians
  speed: number;    // forward/backward speed
  steerAngle: number; // current steering angle of rear wheels (-max to +max)
  forkHeight: number; // 0 (ground level) to maxForkHeight
  wheelRotation: number; // for rolling wheel animation
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  forkUp: boolean;
  forkDown: boolean;
  brake: boolean;
  horn: boolean;
}

export interface CargoItem {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  isLoaded: boolean;
  isDelivered: boolean;
  color: string;
}

export interface DropZone {
  x: number;
  y?: number;
  z: number;
  width: number;
  depth: number;
  name: string;
}

export interface SimulatorStats {
  speedKmh: number;
  forkHeightM: number;
  deliveredCount: number;
  totalCount: number;
  score: number;
  timeElapsed: number;
  cargoLoaded: boolean;
  cargoLocked: boolean;
  level: number;
}
