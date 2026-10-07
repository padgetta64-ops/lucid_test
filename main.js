import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ==========================================
// 1. DOM ELEMENTS
// ==========================================
const canvas = document.getElementById('game-canvas');
const chatBtn = document.getElementById('chat-btn');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const speechContainer = document.getElementById('speech-bubbles-container');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const jumpBtn = document.getElementById('jump-btn');
const menuBtn = document.getElementById('menu-btn');
const menuModal = document.getElementById('game-menu-modal');
const btnResume = document.getElementById('btn-resume');
const btnRespawn = document.getElementById('btn-respawn');
const btnLeave = document.getElementById('btn-leave');
const leaveScreen = document.getElementById('leave-screen');
const btnRejoin = document.getElementById('btn-rejoin');

// Ensure chat box starts completely empty
if (chatMessages) {
  chatMessages.innerHTML = '';
}

// ==========================================
// 2. PROFANITY & CHAT MODERATION FILTER
// ==========================================
const PROFANITY_PATTERN = /\b(fuck|fck|f\*ck|f-ck|f u|nigger|nigga|nigg\*r|nigg\*a|bitch|btch|b\*tch|b-tch|shit|sh\*t|sh-t|asshole|cunt|faggot|fag|whore|slut)\b/gi;

function sanitizeText(text) {
  return text.replace(PROFANITY_PATTERN, (match) => '#'.repeat(match.length));
}

// ==========================================
// 3. THREE.JS SCENE SETUP
// ==========================================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8cd3ff, 0.005);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x8cd3ff, 0x3d5c21, 0.6);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffaed, 1.3);
dirLight.position.set(40, 80, 40);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 150;
const d = 40;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0001;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x7ec8e3, 0.4);
fillLight.position.set(-30, 40, -30);
scene.add(fillLight);

// ==========================================
// 4. SKY DOME & BASEPLATE STUDS
// ==========================================
function createBaseplateStudsTexture() {
  const studsCanvas = document.createElement('canvas');
  studsCanvas.width = 128;
  studsCanvas.height = 128;
  const ctx = studsCanvas.getContext('2d');
  ctx.fillStyle = '#3a9d23';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#44a92d';
  ctx.beginPath();
  ctx.arc(32, 32, 16, 0, Math.PI * 2);
  ctx.arc(96, 32, 16, 0, Math.PI * 2);
  ctx.arc(32, 96, 16, 0, Math.PI * 2);
  ctx.arc(96, 96, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#55bb39';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(32, 32, 15, Math.PI * 0.75, Math.PI * 1.75);
  ctx.arc(96, 32, 15, Math.PI * 0.75, Math.PI * 1.75);
  ctx.arc(32, 96, 15, Math.PI * 0.75, Math.PI * 1.75);
  ctx.arc(96, 96, 15, Math.PI * 0.75, Math.PI * 1.75);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(studsCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  return texture;
}

const skyVertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = `
  varying vec3 vWorldPosition;
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  uniform vec3 sunPosition;
  uniform float time;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float h = normalize(vWorldPosition + offset).y;
    vec3 sky = mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
    
    vec3 sunDir = normalize(sunPosition);
    vec3 dir = normalize(vWorldPosition);
    float sunSq = max(0.0, dot(dir, sunDir));
    float sunDisc = pow(sunSq, 256.0) * 2.5;
    float sunGlow = pow(sunSq, 16.0) * 0.5;
    sky += vec3(1.0, 0.95, 0.8) * (sunDisc + sunGlow);

    if (h > 0.05) {
      vec2 cloudUV = vWorldPosition.xz * 0.0025 + vec2(time * 0.008);
      float n = noise(cloudUV * 2.0) * 0.5 + noise(cloudUV * 4.0) * 0.25;
      float cloudShape = smoothstep(0.42, 0.62, n);
      sky = mix(sky, vec3(1.0, 1.0, 1.0), cloudShape * 0.88 * min(1.0, h * 3.0));
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

const skyUniforms = {
  topColor: { value: new THREE.Color(0x187bcd) },
  bottomColor: { value: new THREE.Color(0x9be2f9) },
  offset: { value: 30 },
  exponent: { value: 0.6 },
  sunPosition: { value: dirLight.position },
  time: { value: 0 }
};

const skyGeo = new THREE.SphereGeometry(400, 32, 15);
const skyMat = new THREE.ShaderMaterial({
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  uniforms: skyUniforms,
  side: THREE.BackSide
});
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

const gridHelper = new THREE.GridHelper(200, 50, 0x114411, 0x226622);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(200, 200);
const studsTexture = createBaseplateStudsTexture();
const floorMat = new THREE.MeshStandardMaterial({
  map: studsTexture,
  roughness: 0.7,
  metalness: 0.1
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Decorative World Blocks
for (let i = 0; i < 25; i++) {
  const size = 2 + Math.random() * 2.5;
  const boxGeo = new THREE.BoxGeometry(size, size, size);
  const boxMat = new THREE.MeshStandardMaterial({ 
    color: Math.random() * 0xffffff,
    roughness: 0.6
  });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set((Math.random() - 0.5) * 100, size / 2, (Math.random() - 0.5) * 100);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
}

// ==========================================
// 5. MULTI-MODEL SWITCHING (IDLE, WALK1, WALK2 & JUMP)
// ==========================================
const playerGroup = new THREE.Group();
playerGroup.position.set(0, 0, 0);
scene.add(playerGroup);

function createFallbackAvatar(strideOffset = 0) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xaa8a0b }));
  head.position.y = 1.8;
  head.castShadow = true;
  g.add(head);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x1d5a82 }));
  torso.position.y = 0.9;
  torso.castShadow = true;
  g.add(torso);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.5), new THREE.MeshStandardMaterial({ color: 0x1b7a43 }));
  leftLeg.position.set(-0.25, 0.25, strideOffset);
  leftLeg.castShadow = true;
  g.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.set(0.25, 0.25, -strideOffset);
  g.add(rightLeg);
  return g;
}

const fallbackDefaultMesh = createFallbackAvatar(0);
const fallbackWalk1Mesh = createFallbackAvatar(0.25);
const fallbackWalk2Mesh = createFallbackAvatar(-0.25);
const fallbackJumpMesh = createFallbackAvatar(0);
fallbackJumpMesh.rotation.x = -0.2;

let defaultModel = null;
let walk1Model = null;
let walk2Model = null;
let jumpModel = null;

let currentModel = fallbackDefaultMesh;
let currentModelType = 'default';

let defaultMixer = null;
let walk1Mixer = null;
let walk2Mixer = null;
let jumpMixer = null;
let activeMixer = null;

playerGroup.add(currentModel);

const clock = new THREE.Clock();
const loader = new GLTFLoader();

function setupLoadedGLTF(gltf) {
  const loadedModel = gltf.scene;
  const bbox = new THREE.Box3().setFromObject(loadedModel);
  const size = bbox.getSize(new THREE.Vector3());
  const targetHeight = 2.0;
  const scaleFactor = size.y > 0 ? (targetHeight / size.y) : 1;

  loadedModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
  const updatedBbox = new THREE.Box3().setFromObject(loadedModel);
  loadedModel.position.y = -updatedBbox.min.y;

  loadedModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.side = THREE.DoubleSide;
      }
    }
  });

  return loadedModel;
}

loader.load('assets/player.gltf', (gltf) => {
  defaultModel = setupLoadedGLTF(gltf);
  if (gltf.animations && gltf.animations.length > 0) {
    defaultMixer = new THREE.AnimationMixer(defaultModel);
    defaultMixer.clipAction(gltf.animations[0]).play();
  }
  if (currentModelType === 'default') switchPlayerModel('default', true);
});

loader.load('assets/walk1.gltf', (gltf) => {
  walk1Model = setupLoadedGLTF(gltf);
  if (gltf.animations && gltf.animations.length > 0) {
    walk1Mixer = new THREE.AnimationMixer(walk1Model);
    walk1Mixer.clipAction(gltf.animations[0]).play();
  }
  if (currentModelType === 'walk1') switchPlayerModel('walk1', true);
});

loader.load('assets/walk2.gltf', (gltf) => {
  walk2Model = setupLoadedGLTF(gltf);
  if (gltf.animations && gltf.animations.length > 0) {
    walk2Mixer = new THREE.AnimationMixer(walk2Model);
    walk2Mixer.clipAction(gltf.animations[0]).play();
  }
  if (currentModelType === 'walk2') switchPlayerModel('walk2', true);
});

loader.load('assets/jump.gltf', (gltf) => {
  jumpModel = setupLoadedGLTF(gltf);
  if (gltf.animations && gltf.animations.length > 0) {
    jumpMixer = new THREE.AnimationMixer(jumpModel);
    jumpMixer.clipAction(gltf.animations[0]).play();
  }
  if (currentModelType === 'jump') switchPlayerModel('jump', true);
});

function switchPlayerModel(type, force = false) {
  if (currentModelType === type && !force) return;
  currentModelType = type;

  if (currentModel) {
    playerGroup.remove(currentModel);
  }

  switch (type) {
    case 'walk1':
      currentModel = walk1Model || fallbackWalk1Mesh;
      activeMixer = walk1Mixer;
      break;
    case 'walk2':
      currentModel = walk2Model || fallbackWalk2Mesh;
      activeMixer = walk2Mixer;
      break;
    case 'jump':
      currentModel = jumpModel || fallbackJumpMesh;
      activeMixer = jumpMixer;
      break;
    case 'default':
    default:
      currentModel = defaultModel || fallbackDefaultMesh;
      activeMixer = defaultMixer;
      break;
  }

  playerGroup.add(currentModel);
}

// ==========================================
// 6. CONTROLS & PHYSICS MECHANICS
// ==========================================
const playerState = {
  velocityY: 0,
  isGrounded: true,
  moveSpeed: 11,
  jumpStrength: 14,
  gravity: 34,
  walkTimer: 0
};

const keys = { W: false, A: false, S: false, D: false };

window.addEventListener('keydown', (e) => {
  if (document.activeElement === chatInput) return;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.W = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.A = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.S = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.D = true;
  if (e.code === 'Space') triggerJump();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.W = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.A = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.S = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.D = false;
});

const input = { moveX: 0, moveY: 0 };
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
const maxRadius = 45;

function handleJoystickStart(e) {
  if (!joystickBase) return;
  for (let touch of e.changedTouches) {
    if (joystickTouchId === null) {
      joystickTouchId = touch.identifier;
      const rect = joystickBase.getBoundingClientRect();
      joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      updateJoystick(touch);
    }
  }
}

function handleJoystickMove(e) {
  for (let touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      updateJoystick(touch);
    }
  }
}

function handleJoystickEnd(e) {
  for (let touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      joystickTouchId = null;
      input.moveX = 0;
      input.moveY = 0;
      if (joystickKnob) joystickKnob.style.transform = `translate(0px, 0px)`;
    }
  }
}

function updateJoystick(touch) {
  if (!joystickKnob) return;
  let dx = touch.clientX - joystickCenter.x;
  let dy = touch.clientY - joystickCenter.y;
  let dist = Math.hypot(dx, dy);

  if (dist > maxRadius) {
    dx = (dx / dist) * maxRadius;
    dy = (dy / dist) * maxRadius;
  }

  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.moveX = dx / maxRadius;
  input.moveY = dy / maxRadius;
}

if (joystickBase) {
  joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false });
}
window.addEventListener('touchmove', handleJoystickMove, { passive: false });
window.addEventListener('touchend', handleJoystickEnd, { passive: false });

let isMouseDownJoystick = false;
if (joystickBase) {
  joystickBase.addEventListener('mousedown', (e) => {
    isMouseDownJoystick = true;
    const rect = joystickBase.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystick(e);
  });
}

window.addEventListener('mousemove', (e) => {
  if (isMouseDownJoystick) updateJoystick(e);
});
window.addEventListener('mouseup', () => {
  if (isMouseDownJoystick) {
    isMouseDownJoystick = false;
    input.moveX = 0;
    input.moveY = 0;
    if (joystickKnob) joystickKnob.style.transform = `translate(0px, 0px)`;
  }
});

if (jumpBtn) {
  jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    triggerJump();
  });
  jumpBtn.addEventListener('click', triggerJump);
}

function triggerJump() {
  if (playerState.isGrounded) {
    playerState.velocityY = playerState.jumpStrength;
    playerState.isGrounded = false;
    switchPlayerModel('jump');
  }
}

// Camera Controls
let cameraDistance = 12;
const minZoom = 3;
const maxZoom = 28;

let cameraAngles = { yaw: 0, pitch: 0.3 };
let cameraTouchId = null;
let lastTouchPos = { x: 0, y: 0 };
let pinchStartDistance = null;

let isMouseDraggingCam = false;
window.addEventListener('mousedown', (e) => {
  const target = e.target;
  if (
    target.closest('#joystick-zone') ||
    target.closest('#jump-btn') ||
    target.closest('#top-left-bar') ||
    target.closest('#game-menu-modal')
  ) return;

  isMouseDraggingCam = true;
  lastTouchPos = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mousemove', (e) => {
  if (isMouseDraggingCam) {
    const dx = e.clientX - lastTouchPos.x;
    const dy = e.clientY - lastTouchPos.y;
    cameraAngles.yaw -= dx * 0.005;
    cameraAngles.pitch += dy * 0.005;
    cameraAngles.pitch = Math.max(0.05, Math.min(Math.PI / 2.2, cameraAngles.pitch));
    lastTouchPos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mouseup', () => { isMouseDraggingCam = false; });

window.addEventListener('wheel', (e) => {
  cameraDistance += e.deltaY * 0.01;
  cameraDistance = Math.max(minZoom, Math.min(maxZoom, cameraDistance));
}, { passive: true });

window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    pinchStartDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    return;
  }

  for (let touch of e.changedTouches) {
    const target = touch.target;
    if (
      target.closest('#joystick-zone') ||
      target.closest('#jump-btn') ||
      target.closest('#top-left-bar') ||
      target.closest('#game-menu-modal')
    ) {
      continue;
    }

    if (cameraTouchId === null) {
      cameraTouchId = touch.identifier;
      lastTouchPos = { x: touch.clientX, y: touch.clientY };
    }
  }
});

window.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinchStartDistance !== null) {
    const currentDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const delta = pinchStartDistance - currentDist;

    cameraDistance += delta * 0.03;
    cameraDistance = Math.max(minZoom, Math.min(maxZoom, cameraDistance));
    pinchStartDistance = currentDist;
    return;
  }

  for (let touch of e.changedTouches) {
    if (touch.identifier === cameraTouchId) {
      const dx = touch.clientX - lastTouchPos.x;
      const dy = touch.clientY - lastTouchPos.y;

      cameraAngles.yaw -= dx * 0.005;
      cameraAngles.pitch += dy * 0.005;
      cameraAngles.pitch = Math.max(0.05, Math.min(Math.PI / 2.2, cameraAngles.pitch));

      lastTouchPos = { x: touch.clientX, y: touch.clientY };
    }
  }
});

window.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) pinchStartDistance = null;
  for (let touch of e.changedTouches) {
    if (touch.identifier === cameraTouchId) cameraTouchId = null;
  }
});

// ==========================================
// 7. CHAT & SPEECH BUBBLE SYSTEM WITH FILTERING
// ==========================================
const activeBubbles = [];

if (chatBtn && chatBox) {
  chatBtn.addEventListener('click', () => {
    chatBox.classList.toggle('hidden');
    if (!chatBox.classList.contains('hidden') && chatInput) chatInput.focus();
  });
}

function sendChatMessage() {
  if (!chatInput) return;
  const rawText = chatInput.value.trim();
  if (rawText) {
    chatInput.value = '';
    const cleanText = sanitizeText(rawText);

    if (chatMessages) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'msg';
      msgDiv.textContent = `[You]: ${cleanText}`;
      chatMessages.appendChild(msgDiv);

      while (chatMessages.children.length > 100) {
        chatMessages.removeChild(chatMessages.firstChild);
      }
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'speech-bubble';
    bubbleEl.textContent = cleanText;

    if (speechContainer) speechContainer.appendChild(bubbleEl);

    const bubbleObj = {
      element: bubbleEl,
      fullText: cleanText,
      timer: null
    };

    bubbleObj.timer = setTimeout(() => {
      removeSpeechBubble(bubbleObj);
    }, 4000);

    activeBubbles.push(bubbleObj);

    while (activeBubbles.length > 2) {
      removeSpeechBubble(activeBubbles[0]);
    }
  }
}

function removeSpeechBubble(bubbleObj) {
  if (bubbleObj.timer) clearTimeout(bubbleObj.timer);
  const index = activeBubbles.indexOf(bubbleObj);
  if (index !== -1) activeBubbles.splice(index, 1);

  bubbleObj.element.classList.add('fading');
  setTimeout(() => {
    if (bubbleObj.element.parentNode) {
      bubbleObj.element.remove();
    }
  }, 350);
}

if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

// ==========================================
// 8. GAME MENU & RESPAWN
// ==========================================
if (menuBtn && menuModal) menuBtn.addEventListener('click', () => menuModal.classList.remove('hidden'));
if (btnResume && menuModal) btnResume.addEventListener('click', () => menuModal.classList.add('hidden'));

if (btnRespawn && menuModal) {
  btnRespawn.addEventListener('click', () => {
    playerGroup.position.set(0, 0, 0);
    playerState.velocityY = 0;
    playerState.isGrounded = true;
    playerState.walkTimer = 0;
    switchPlayerModel('default');
    menuModal.classList.add('hidden');
  });
}

if (btnLeave && menuModal && leaveScreen) {
  btnLeave.addEventListener('click', () => {
    menuModal.classList.add('hidden');
    leaveScreen.classList.remove('hidden');
  });
}

if (btnRejoin && leaveScreen) {
  btnRejoin.addEventListener('click', () => {
    leaveScreen.classList.add('hidden');
    playerGroup.position.set(0, 0, 0);
    playerState.velocityY = 0;
    playerState.isGrounded = true;
    playerState.walkTimer = 0;
    switchPlayerModel('default');
  });
}

// ==========================================
// 9. GAME LOOP
// ==========================================
function updatePlayer(delta) {
  let keyboardX = (keys.D ? 1 : 0) - (keys.A ? 1 : 0);
  let keyboardY = (keys.S ? 1 : 0) - (keys.W ? 1 : 0);

  let moveX = input.moveX || keyboardX;
  let moveY = input.moveY || keyboardY;

  const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveY) > 0.05;

  if (isMoving) {
    const forward = new THREE.Vector3(
      -Math.sin(cameraAngles.yaw),
      0,
      -Math.cos(cameraAngles.yaw)
    ).normalize();

    const right = new THREE.Vector3(
      Math.cos(cameraAngles.yaw),
      0,
      -Math.sin(cameraAngles.yaw)
    ).normalize();

    const moveDirection = new THREE.Vector3()
      .addScaledVector(right, moveX)
      .addScaledVector(forward, -moveY)
      .normalize();

    playerGroup.position.x += moveDirection.x * playerState.moveSpeed * delta;
    playerGroup.position.z += moveDirection.z * playerState.moveSpeed * delta;

    const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
    
    let currentRot = playerGroup.rotation.y;
    let diff = targetAngle - currentRot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    playerGroup.rotation.y += diff * Math.min(1.0, delta * 15);
  }

  if (playerState.isGrounded) {
    if (isMoving) {
      playerState.walkTimer += delta * 8;
      const stepIndex = Math.floor(playerState.walkTimer) % 2;
      switchPlayerModel(stepIndex === 0 ? 'walk1' : 'walk2');
    } else {
      playerState.walkTimer = 0;
      switchPlayerModel('default');
    }
  }

  playerGroup.position.y += playerState.velocityY * delta;
  
  if (!playerState.isGrounded) {
    playerState.velocityY -= playerState.gravity * delta;
  }

  if (playerGroup.position.y <= 0) {
    playerGroup.position.y = 0;
    playerState.velocityY = 0;

    if (!playerState.isGrounded) {
      playerState.isGrounded = true;
      playerState.walkTimer = 0;
      switchPlayerModel('default');
    }
  }

  if (activeMixer) {
    activeMixer.update(delta);
  }
}

function updateCamera() {
  const targetX = playerGroup.position.x + cameraDistance * Math.sin(cameraAngles.yaw) * Math.cos(cameraAngles.pitch);
  const targetY = playerGroup.position.y + cameraDistance * Math.sin(cameraAngles.pitch) + 1.5;
  const targetZ = playerGroup.position.z + cameraDistance * Math.cos(cameraAngles.yaw) * Math.cos(cameraAngles.pitch);

  camera.position.set(targetX, targetY, targetZ);
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.5, playerGroup.position.z);
}

function updateSpeechBubblePosition() {
  if (!speechContainer || activeBubbles.length === 0) return;

  const headPos = playerGroup.position.clone();
  headPos.y += 2.5;

  headPos.project(camera);

  if (headPos.z > 1) {
    speechContainer.style.display = 'none';
    return;
  } else {
    speechContainer.style.display = 'flex';
  }

  const isZoomedOut = cameraDistance > 17;

  activeBubbles.forEach((b, index) => {
    if (isZoomedOut) {
      if (index === activeBubbles.length - 1) {
        b.element.textContent = '...';
        b.element.style.display = 'block';
      } else {
        b.element.style.display = 'none';
      }
    } else {
      b.element.textContent = b.fullText;
      b.element.style.display = 'block';
    }
  });

  const x = (headPos.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-(headPos.y * 0.5) + 0.5) * window.innerHeight;

  speechContainer.style.left = `${x}px`;
  speechContainer.style.top = `${y - 12}px`;
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  if (skyMat) {
    skyMat.uniforms.time.value += delta;
  }

  updatePlayer(delta);
  updateCamera();
  updateSpeechBubblePosition();

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

