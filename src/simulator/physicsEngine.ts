import * as CANNON from 'cannon-es';

export interface PhysicsEngineConfig {
  gravityY?: number;
}

export class PhysicsWorld {
  public world: CANNON.World;
  public groundBody: CANNON.Body;
  public forkliftBody: CANNON.Body;
  public cargoBodies: Map<string, CANNON.Body> = new Map();
  public currentForkliftHeading: number = 0; // Yaw angle in radians

  // Contact materials
  public defaultMaterial: CANNON.Material;
  public groundMaterial: CANNON.Material;
  public forkliftMaterial: CANNON.Material;
  public cargoMaterial: CANNON.Material;

  constructor(config?: PhysicsEngineConfig) {
    this.world = new CANNON.World();
    this.world.gravity.set(0, config?.gravityY ?? -9.82, 0);

    // Iterations and solver settings for stability
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;

    // Materials
    this.defaultMaterial = new CANNON.Material('default');
    this.groundMaterial = new CANNON.Material('ground');
    this.forkliftMaterial = new CANNON.Material('forklift');
    this.cargoMaterial = new CANNON.Material('cargo');

    // Contact material configurations (friction & bounciness/restitution)
    const forkliftGroundContact = new CANNON.ContactMaterial(
      this.forkliftMaterial,
      this.groundMaterial,
      {
        friction: 0.6,
        restitution: 0.12, // subtle bounce when landing
      }
    );
    this.world.addContactMaterial(forkliftGroundContact);

    const cargoGroundContact = new CANNON.ContactMaterial(
      this.cargoMaterial,
      this.groundMaterial,
      {
        friction: 0.5,
        restitution: 0.1,
      }
    );
    this.world.addContactMaterial(cargoGroundContact);

    // 1. Static Ground Floor (Flat plane at y = 0)
    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: this.groundMaterial,
    });
    this.groundBody.addShape(groundShape);
    // In Cannon, Plane normal points +Z by default; rotate around X by -PI/2 to face +Y
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);

    // 2. Dynamic Forklift Box Body
    // Forklift dimensions: width 1.4m (half 0.7), height 1.2m (half 0.6), length 2.4m (half 1.2)
    const forkliftShape = new CANNON.Box(new CANNON.Vec3(0.7, 0.5, 1.2));
    this.forkliftBody = new CANNON.Body({
      mass: 800, // 800 kg heavy forklift
      material: this.forkliftMaterial,
      position: new CANNON.Vec3(0, 3.8, 4), // SPAWNS IN THE AIR to fall down to the floor!
      angularDamping: 0.85,
      linearDamping: 0.35,
    });
    this.forkliftBody.addShape(forkliftShape);
    // Lock X and Z rotation slightly to prevent tipping over easily like a stable industrial vehicle
    this.forkliftBody.angularFactor.set(0.1, 1.0, 0.1);
    this.world.addBody(this.forkliftBody);

    // 3. Perimeter walls (Invisible boundary colliders)
    this.createStaticWall(0, 5, 29.5, 50, 10, 1);   // Back wall
    this.createStaticWall(0, 5, -29.5, 50, 10, 1);  // Front wall
    this.createStaticWall(-24.5, 5, 0, 1, 10, 60);  // Left wall
    this.createStaticWall(24.5, 5, 0, 1, 10, 60);   // Right wall

    // 4. Warehouse pillars
    const pillarPositions = [
      [-12, -10],
      [-12, 10],
      [12, -10],
      [12, 10],
    ];
    pillarPositions.forEach(([px, pz]) => {
      this.createStaticWall(px, 5, pz, 1.4, 10, 1.4);
    });
  }

  private createStaticWall(x: number, y: number, z: number, w: number, h: number, d: number) {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      position: new CANNON.Vec3(x, y, z),
      material: this.groundMaterial,
    });
    body.addShape(shape);
    this.world.addBody(body);
  }

  /**
   * Adds a dynamic cargo crate with physics that can drop or be pushed
   */
  public addCargoBody(id: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({
      mass: 80, // 80kg cargo crate
      position: new CANNON.Vec3(x, y, z),
      material: this.cargoMaterial,
      angularDamping: 0.6,
      linearDamping: 0.4,
    });
    body.addShape(shape);
    this.world.addBody(body);
    this.cargoBodies.set(id, body);
    return body;
  }

  /**
   * Drops the forklift from the air to demonstrate physics falling
   */
  public dropForklift(dropHeight: number = 3.8, x: number = 0, z: number = 4) {
    this.forkliftBody.position.set(x, dropHeight, z);
    this.forkliftBody.velocity.set(0, 0, 0);
    this.forkliftBody.angularVelocity.set(0, 0, 0);
    this.forkliftBody.quaternion.setFromEuler(0, this.currentForkliftHeading, 0);
  }

  /**
   * Drives the forklift body with input controls
   */
  public applyMovement(
    forward: boolean,
    backward: boolean,
    steerLeft: boolean,
    steerRight: boolean,
    brake: boolean,
    dt: number
  ) {
    // Only drive if near ground (has touched down)
    const isGrounded = this.forkliftBody.position.y <= 1.2;

    // Steering (yaw)
    const steerSpeed = 2.4;
    if (steerLeft) {
      this.currentForkliftHeading += steerSpeed * dt;
    }
    if (steerRight) {
      this.currentForkliftHeading -= steerSpeed * dt;
    }

    // Keep heading normalized
    this.currentForkliftHeading = (this.currentForkliftHeading + Math.PI * 2) % (Math.PI * 2);

    // Apply orientation around Y axis smoothly
    const currentRotY = this.currentForkliftHeading;
    this.forkliftBody.quaternion.setFromEuler(0, currentRotY, 0);

    if (!isGrounded) return; // In mid-air falling, wheels don't push ground

    const forwardDir = new CANNON.Vec3(
      Math.sin(currentRotY),
      0,
      -Math.cos(currentRotY)
    );

    const maxSpeed = 7.0; // m/s
    const accel = 25.0;

    if (brake) {
      // Rapid deceleration
      this.forkliftBody.velocity.x *= 0.88;
      this.forkliftBody.velocity.z *= 0.88;
    } else if (forward) {
      // Accelerate forward
      const targetVx = forwardDir.x * maxSpeed;
      const targetVz = forwardDir.z * maxSpeed;
      this.forkliftBody.velocity.x += (targetVx - this.forkliftBody.velocity.x) * Math.min(1, accel * dt);
      this.forkliftBody.velocity.z += (targetVz - this.forkliftBody.velocity.z) * Math.min(1, accel * dt);
    } else if (backward) {
      // Accelerate backward
      const targetVx = -forwardDir.x * (maxSpeed * 0.6);
      const targetVz = -forwardDir.z * (maxSpeed * 0.6);
      this.forkliftBody.velocity.x += (targetVx - this.forkliftBody.velocity.x) * Math.min(1, accel * dt);
      this.forkliftBody.velocity.z += (targetVz - this.forkliftBody.velocity.z) * Math.min(1, accel * dt);
    } else {
      // Rolling resistance
      this.forkliftBody.velocity.x *= 0.94;
      this.forkliftBody.velocity.z *= 0.94;
    }
  }

  /**
   * Advances the physics simulation by dt seconds
   */
  public step(dt: number) {
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;
    this.world.step(fixedTimeStep, Math.min(dt, 0.05), maxSubSteps);
  }
}
