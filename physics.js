class PhysicsObject {
    constructor(mass, position, velocity) {
        this.mass = mass;
        this.position = position;
        this.velocity = velocity;
        this.acceleration = 0;
    }

    update(dt) {
        this.velocity += this.acceleration * dt;
        this.position += this.velocity * dt;
    }
}
export { PhysicsObject };