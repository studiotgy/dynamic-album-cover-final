let orbs = [];
let connectionDistance = 300; // Increased to allow more distant connections
let theta = 0;
let phi = Math.PI / 4;

let orbImages = [];
let shuffledImages = [];

// Global camera control variables.
let radius = 500; // Adjustable via the scroll wheel.
let camX, camY, camZ;

let speckles = []; // Array for our floating speckles.

// Flash image variables
let flashImg = null;
let flashTimer = 0;
const flashDuration = 30;

// Baseline drift amounts (always present).
let baseDriftTheta = 0.001;
let baseDriftPhi = 0.0005;
let driftTheta = baseDriftTheta;
let driftPhi = baseDriftPhi;

function preload() {
  // Load image files "01.jpg" to "50.jpg".
  for (let i = 1; i <= 50; i++) {
    let filename = nf(i, 2) + ".jpg";
    orbImages.push(loadImage(
      filename,
      () => console.log("loaded:", filename),
      () => console.error("failed to load:", filename)
    ));
  }
  // Shuffle images to randomize the order.
  shuffledImages = orbImages.slice();
  shuffle(shuffledImages);
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  textFont('monospace');
  
  // Initialize speckles in light grey.
  let numSpeckles = 600;
  for (let i = 0; i < numSpeckles; i++) {
    speckles.push({
      pos: createVector(random(-1000, 1000), random(-1000, 1000), random(-1000, 1000)),
      vel: createVector(random(-0.03, 0.03), random(-0.03, 0.03), random(-0.03, 0.03)),
      alpha: random(50, 200)
    });
  }
}

// Draw and update speckles.
function updateAndDrawSpeckles() {
  push();
  noStroke();
  for (let s of speckles) {
    s.pos.add(s.vel);
    // Wrap around bounds
    if (s.pos.x > 1000) s.pos.x = -1000;
    if (s.pos.x < -1000) s.pos.x = 1000;
    if (s.pos.y > 1000) s.pos.y = -1000;
    if (s.pos.y < -1000) s.pos.y = 1000;
    if (s.pos.z > 1000) s.pos.z = -1000;
    if (s.pos.z < -1000) s.pos.z = 1000;
    // Fluctuate alpha
    s.alpha += random(-0.3, 0.3);
    s.alpha = constrain(s.alpha, 50, 255);
    push();
    translate(s.pos.x, s.pos.y, s.pos.z);
    fill(200, s.alpha);
    ellipse(0, 0, 2, 2);
    pop();
  }
  pop();
}

function getMaxOrbDistance() {
  let maxD = 0;
  for (let orb of orbs) {
    maxD = max(maxD, orb.pos.mag());
  }
  return maxD;
}

function draw() {
  background(255);

  // Flash random orb image occasionally
  if (flashTimer === 0 && random(300) < 1) {
    flashImg = random(orbImages);
    flashTimer = flashDuration;
  }
  if (flashTimer > 0 && flashImg) {
    push();
    imageMode(CENTER);
    noLights();
    tint(255, map(flashTimer, flashDuration, 0, 255, 0));
    image(flashImg, 0, 0, width * 0.8, height * 0.8);
    pop();
    flashTimer--;
  }

  // Camera drift and friction
  theta += driftTheta;
  phi = constrain(phi + driftPhi, 0.2, PI - 0.2);
  driftTheta = driftTheta * 0.99 + baseDriftTheta * 0.01;
  driftPhi = driftPhi * 0.99 + baseDriftPhi * 0.01;
  camX = radius * sin(phi) * cos(theta);
  camY = radius * cos(phi);
  camZ = radius * sin(phi) * sin(theta);
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  updateAndDrawSpeckles();
  ambientLight(255);

  // Spawn orbs
  if (frameCount % 60 === 0) {
    let newOrbCount = floor(random(1, 3));
    for (let i = 0; i < newOrbCount; i++) {
      let img = shuffledImages.pop();
      if (!img) {
        shuffledImages = orbImages.slice(); shuffle(shuffledImages); img = shuffledImages.pop();
      }
      orbs.push({
        pos: createVector(random(-400, 400), random(-400, 400), random(-400, 400)),
        size: 0.05, alpha: 0, growing: true, shrinking: false, img: img
      });
      if (orbs.length > 300) {
        let c = orbs.find(o => !o.shrinking && !o.growing);
        if (c) c.shrinking = true;
      }
    }
  }  // Animate orbs: growth and potential shrinking.
  for (let orb of orbs) {
    if (orb.growing) {
      orb.size = lerp(orb.size, 3, 0.05);
      orb.alpha = lerp(orb.alpha, 255, 0.05);
      if (abs(orb.size - 3) < 0.01) {
        orb.size = 3;
        orb.alpha = 255;
        orb.growing = false;
      }
    }
    if (orb.shrinking) {
      orb.size *= 0.85;
      orb.alpha = max(orb.alpha - 10, 0);
    }
  }
  // Remove tiny orbs
  orbs = orbs.filter(orb => orb.size > 0.05);

  // Draw neon-green connection lines
  for (let i = 0; i < orbs.length; i++) {
    let A = orbs[i]; let nearby = [];
    for (let j = 0; j < orbs.length; j++) {
      if (i === j) continue;
      let d = p5.Vector.dist(A.pos, orbs[j].pos);
      if (d < connectionDistance) nearby.push({index:j, dist:d});
    }
    nearby.sort((a, b) => a.dist - b.dist);
    let connections = min(2, nearby.length);
    for (let k = 0; k < connections; k++) {
      let B = orbs[nearby[k].index];
      let alpha = min(A.alpha, B.alpha);
      stroke(57, 255, 20, alpha); strokeWeight(0.5);
      let vA = A.pos.copy(), vB = B.pos.copy();
      if (A.shrinking) vB.lerp(vA, 0.1);
      if (B.shrinking) vA.lerp(vB, 0.1);
      line(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
    }
  }

  // Draw orbs with neon-green outlines
  for (let orb of orbs) {
    if (!orb.img) continue;
    push(); translate(orb.pos.x, orb.pos.y, orb.pos.z);
    let dir = createVector(camX - orb.pos.x, camY - orb.pos.y, camZ - orb.pos.z);
    rotateY(atan2(dir.x, dir.z));
    rotateX(-atan2(dir.y, sqrt(dir.x*dir.x + dir.z*dir.z)));
    stroke(57, 255, 20); strokeWeight(0.5);
    texture(orb.img);
    ellipse(0, 0, orb.size * 4, orb.size * 4);
    pop();
  }
}

function mouseDragged() {
  driftTheta += (mouseX - pmouseX) * 0.001;
  driftPhi += (mouseY - pmouseY) * 0.001;
}

function mouseWheel(event) {
  radius = constrain(radius + event.delta * 0.5, 200, max(getMaxOrbDistance() + 100, 200));
  return false;
}




