import * as THREE from 'three';

let scene, camera, renderer;
let player, track;
let obstacles = [], coins = [];
let velocityY = 0;
let currentLane = 1;
const lanePositions = [-2.5, 0, 2.5];
let score = 0, highScore = 0, gameOverFlag = false, started = false;

// === CHANGED: Start at a much slower, friendly speed ===
let gameSpeed = 0.45; 

// Swipe & Control variables
const keys = {};
let touchStartX = 0;
let touchStartY = 0;
let slideTimer = 0; 

// === WEB AUDIO API SETUP ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};
let bgMusic; 

async function loadSound(name, url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioBuffers[name] = audioBuffer;
  } catch (e) {
    console.error(`Failed to load sound: ${name}`, e);
  }
}

function playSound(name, volume = 1.0) {
  if (!audioBuffers[name]) return; 
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffers[name];
  
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = volume;
  
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(0); 
}

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x88aaff, 15, 120);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 9, 14);
  camera.lookAt(0, 2, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(10, 25, 15);
  scene.add(dirLight);

  // Track
  const trackGeo = new THREE.PlaneGeometry(14, 220);
  const trackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  track = new THREE.Mesh(trackGeo, trackMat);
  track.rotation.x = -Math.PI / 2;
  track.position.z = -90;
  scene.add(track);

  // Player 
  const playerGeo = new THREE.CapsuleGeometry(0.8, 2, 8, 16);
  const playerMat = new THREE.MeshPhongMaterial({ color: 0xff5500 });
  player = new THREE.Mesh(playerGeo, playerMat);
  player.position.set(lanePositions[1], 1.5, 0);
  scene.add(player);

  // Load Sounds
  loadSound('jump', '/assets/jump.mp3');
  loadSound('coin', '/assets/coin.mp3');
  loadSound('crash', '/assets/crash.mp3');

  bgMusic = new Audio('/assets/bg-music.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.3; 

  // --- EVENT LISTENERS ---
  window.addEventListener('keydown', e => keys[e.key] = true);
  window.addEventListener('keyup', e => keys[e.key] = false);
  
  window.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: false });

  window.addEventListener('touchend', e => {
    if (!started || gameOverFlag) {
      if (gameOverFlag) location.reload();
      startGame();
      return;
    }

    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
  }, { passive: false });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function startGame() {
  started = true;
  if (audioCtx.state === 'suspended') audioCtx.resume(); 
  bgMusic.play().catch(() => {});
}

function handleSwipe(startX, startY, endX, endY) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const minSwipeDistance = 30; 

  if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) return;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0 && currentLane < 2) { 
      currentLane++; player.position.x = lanePositions[currentLane]; 
    } else if (deltaX < 0 && currentLane > 0) { 
      currentLane--; player.position.x = lanePositions[currentLane]; 
    }
  } else {
    if (deltaY < 0 && player.position.y <= 1.8) {
      velocityY = 0.75; 
      playSound('jump', 1.0); 
    } else if (deltaY > 0) {
      slideTimer = 35; 
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (!started || gameOverFlag) {
    renderer.render(scene, camera);
    return;
  }

  // === CHANGED: Smoother, much more forgiving speed ramp-up ===
  // Starts at 0.45, takes 3000 points to ramp up, caps at a slightly friendlier 3.5
  gameSpeed = Math.min(0.45 + (score / 3000), 3.5);

  track.position.z += gameSpeed;
  if (track.position.z > 50) track.position.z = -90;

  // Lane switching
  if (keys['ArrowLeft'] && currentLane > 0) { currentLane--; player.position.x = lanePositions[currentLane]; keys['ArrowLeft'] = false; }
  if (keys['ArrowRight'] && currentLane < 2) { currentLane++; player.position.x = lanePositions[currentLane]; keys['ArrowRight'] = false; }

  // Keyboard Jump
  if ((keys[' '] || keys['ArrowUp']) && player.position.y <= 1.8) {
    velocityY = 0.75;                 
    playSound('jump', 1.0); 
    keys[' '] = keys['ArrowUp'] = false;
  }

  velocityY -= 0.035;                    
  player.position.y += velocityY;

  // Ground Control
  if (player.position.y < 1.5) {
    velocityY = 0; 
    
    if (keys['ArrowDown'] || slideTimer > 0) {
      player.scale.set(1, 0.5, 1);
      player.position.y = 0.8;
      if (slideTimer > 0) slideTimer--;
    } else {
      player.scale.set(1, 1, 1);
      player.position.y = 1.5 + Math.sin(Date.now() / 80) * 0.2;
    }
  } else {
    // Mid-Air Control
    if (keys['ArrowDown'] || slideTimer > 0) {
      player.scale.set(1, 0.5, 1);
      velocityY = -0.45; 
      if (slideTimer > 0) slideTimer--;
    } else {
      player.scale.set(1, 1, 1);
    }
  }

  // === CHANGED: Milder Spawn Logic ===
  // Spawns fewer boxes early on so the player has time to breathe
  const spawnRate = Math.min(0.012 + (score / 4000), 0.045); 
  
  if (Math.random() < spawnRate) {
    const lane = Math.floor(Math.random() * 3);
    
    // === CHANGED: Forgiving Hitboxes ===
    // Width reduced from 2.0 to 1.6, Height reduced from 1.2 to 1.0. 
    // This allows the player to barely scrape the sides without dying.
    const obs = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), new THREE.MeshPhongMaterial({ color: 0x00aa00 }));
    obs.position.set(lanePositions[lane], 0.5, -70);
    scene.add(obs);
    obstacles.push(obs);
  }

  if (Math.random() < 0.04) {
    const lane = Math.floor(Math.random() * 3);
    const coin = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.3, 16, 32), new THREE.MeshPhongMaterial({ color: 0xffdd00, emissive: 0xffaa00 }));
    coin.position.set(lanePositions[lane], 3, -70);
    coin.rotation.x = Math.PI / 2;
    scene.add(coin);
    coins.push(coin);
  }

  // Move objects
  obstacles.forEach((obs, i) => {
    obs.position.z += gameSpeed + 0.6;
    if (obs.position.z > 15) { scene.remove(obs); obstacles.splice(i, 1); }
  });
  coins.forEach((c, i) => {
    c.position.z += gameSpeed + 0.6;
    c.rotation.z += 0.1;
    if (c.position.z > 15) { scene.remove(c); coins.splice(i, 1); }
  });

  // Collisions
  const playerBox = new THREE.Box3().setFromObject(player);
  for (let obs of obstacles) {
    if (playerBox.intersectsBox(new THREE.Box3().setFromObject(obs))) {
      playSound('crash', 1.0);
      bgMusic.pause();
      endGame();
      return;
    }
  }
  
  for (let i = 0; i < coins.length; i++) {
    if (playerBox.intersectsBox(new THREE.Box3().setFromObject(coins[i]))) {
      score += 20;
      playSound('coin', 1.0);
      scene.remove(coins[i]);
      coins.splice(i, 1);
      i--;
    }
  }

  score += 1;

  // Score UI
  let scoreEl = document.getElementById('score');
  if (!scoreEl) {
    scoreEl = document.createElement('div');
    scoreEl.id = 'score';
    scoreEl.style.cssText = 'position:absolute;top:20px;left:20px;color:#fff;font-size:28px;font-family:Arial;z-index:100;text-shadow:2px 2px 4px #000;pointer-events:none;';
    document.body.appendChild(scoreEl);
  }
  scoreEl.innerHTML = `Score: ${Math.floor(score / 8)}<br>High: ${highScore}<br><span style="font-size:18px;color:#ff0">Speed: ${gameSpeed.toFixed(2)}</span>`;

  renderer.render(scene, camera);
}

function endGame() {
  gameOverFlag = true;
  if (score / 8 > highScore) highScore = Math.floor(score / 8);
  const go = document.createElement('div');
  go.id = 'gameover';
  go.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:#ff0000;font-size:40px;font-family:Arial;text-align:center;z-index:200;width:100%;pointer-events:none;';
  go.innerHTML = `GAME OVER<br>Score: ${Math.floor(score / 8)}<br>High: ${highScore}<br><br><span style="font-size:24px;color:#fff">Tap or Press R to Restart</span>`;
  document.body.appendChild(go);

  document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') location.reload(); });
}

// Initial start via Keyboard
document.addEventListener('keydown', e => {
  if (!started && (e.key === ' ' || e.key === 'Spacebar')) {
    startGame();
  }
});