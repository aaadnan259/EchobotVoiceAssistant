/**
 * EchoBot 3D engine: loads the EchoBot mascot (glTF), plays its animation
 * clips and layers live reactions on top (eyes follow the pointer, the mouth
 * follows the voice level, echo rings pulse and change colour with the chat
 * state). Framework-free so the React wrapper stays thin.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbState } from '../../types';

/** Which clip loops underneath each chat state, and the one-shot played on entering it. */
export const STATE_CLIPS: Record<OrbState, { base: string; loop: boolean; enter?: string }> = {
    [OrbState.IDLE]: { base: 'Idle', loop: true },
    [OrbState.TRACKING]: { base: 'Idle', loop: true },
    [OrbState.LISTENING]: { base: 'Idle', loop: true, enter: 'Surprised' },
    [OrbState.THINKING]: { base: 'LookAround', loop: true },
    [OrbState.RESPONDING]: { base: 'Talk', loop: true },
    [OrbState.ERROR]: { base: 'Cry', loop: false },
};

/** Glow colour for each state; matches the colours the old SVG orb used. */
export const STATE_COLORS: Record<OrbState, number> = {
    [OrbState.IDLE]: 0x8f5bff,
    [OrbState.TRACKING]: 0x8f5bff,
    [OrbState.LISTENING]: 0xc084fc,
    [OrbState.THINKING]: 0x60a5fa,
    [OrbState.RESPONDING]: 0xa855f7,
    [OrbState.ERROR]: 0xef4444,
};

const SLEEP_AFTER_MS = 90_000;            // nap after 90 quiet seconds
const MOUTH_SCALE = new THREE.Vector3(0.1, 0.075, 0.05);
const SCRUB_SPEED = 2.5;                  // px per ms: shaking the mouse this fast startles EchoBot

type EngineOptions = { onReady?: () => void; onError?: (e: unknown) => void };

export class EchoBotEngine {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
    private clock = new THREE.Clock();
    private disposed = false;

    private root: THREE.Object3D | null = null;
    private body: THREE.Mesh | null = null;
    private pivot: THREE.Object3D | null = null;
    private mouth: THREE.Object3D | null = null;
    private mouthMesh: THREE.Mesh | null = null;
    private eyes: THREE.Mesh[] = [];
    private rings: THREE.Mesh[] = [];
    private rimColor = new THREE.Color(STATE_COLORS[OrbState.IDLE]);
    private glowColor = new THREE.Color(STATE_COLORS[OrbState.IDLE]);

    private mixer: THREE.AnimationMixer | null = null;
    private actions: Record<string, THREE.AnimationAction> = {};
    private base: THREE.AnimationAction | null = null;
    private oneShot: THREE.AnimationAction | null = null;

    private state: OrbState = OrbState.IDLE;
    private audio = 0;
    private smoothAudio = 0;
    private look = new THREE.Vector2();
    private lookTarget = new THREE.Vector2();
    private lookOverride: { v: THREE.Vector2; until: number } | null = null;
    private hovered = false;
    private sleeping = false;
    private lastActivity = performance.now();
    private nextFidget = performance.now() + 20_000;
    private fx = { hop: -1, dance: -1, shake: -1 };
    private pokes: number[] = [];
    private lastPointer = { x: 0, y: 0, t: 0 };
    private lastScrub = 0;

    private ray = new THREE.Raycaster();
    private ndc = new THREE.Vector2();

    constructor(private canvas: HTMLCanvasElement, glbUrl: string, private opts: EngineOptions = {}) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.camera.position.set(0, 2.0, 9.4);
        this.camera.lookAt(0, 1.72, 0);
        this.setupLights();

        new GLTFLoader().load(
            glbUrl,
            (gltf) => {
                if (this.disposed) return;
                try {
                    this.setup(gltf);
                    this.renderer.setAnimationLoop(() => this.frame());
                    this.opts.onReady?.();
                } catch (e) {
                    this.opts.onError?.(e);
                }
            },
            undefined,
            (e) => { if (!this.disposed) this.opts.onError?.(e); },
        );
    }

    // ---------- public API ----------

    setState(next: OrbState) {
        if (next === this.state) return;
        const prev = this.state;
        this.state = next;
        this.wake(false);
        if (!this.mixer) return;
        const cfg = STATE_CLIPS[next];
        this.setBase(cfg.base, cfg.loop);
        if (cfg.enter) this.playOnce(cfg.enter);
        // finished answering: a little happy bounce
        if (prev === OrbState.RESPONDING && next === OrbState.IDLE) this.playOnce('Happy');
    }

    setAudioLevel(level: number) {
        this.audio = Math.max(0, Math.min(1, level || 0));
    }

    /** Pointer position anywhere on the page (client px). */
    pointerMove(clientX: number, clientY: number) {
        const r = this.canvas.getBoundingClientRect();
        const dx = clientX - (r.left + r.width / 2);
        const dy = clientY - (r.top + r.height * 0.45);
        this.lookTarget.set(clamp(dx / 450, -1, 1), clamp(-dy / 380, -1, 1));
        this.hovered = this.hitTest(clientX, clientY);

        const now = performance.now();
        const dt = now - this.lastPointer.t;
        if (dt > 0 && dt < 100) {
            const v = Math.hypot(clientX - this.lastPointer.x, clientY - this.lastPointer.y) / dt;
            if (v > SCRUB_SPEED && now - this.lastScrub > 4000 && this.isCalm()) {
                this.lastScrub = now;
                this.fx.shake = now / 1000;
                this.playOnce('Surprised');
            }
        }
        this.lastPointer = { x: clientX, y: clientY, t: now };
        this.wake(true);
    }

    /** Any other sign of life (typing, scrolling). Typing makes EchoBot glance down at the input. */
    activity(kind: 'key' | 'other' = 'other') {
        if (kind === 'key') this.lookOverride = { v: new THREE.Vector2(0, -0.9), until: performance.now() + 1500 };
        this.wake(true);
    }

    hitTest(clientX: number, clientY: number): boolean {
        if (!this.body) return false;
        const r = this.canvas.getBoundingClientRect();
        if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false;
        this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.ray.setFromCamera(this.ndc, this.camera);
        return this.ray.intersectObject(this.body, false).length > 0;
    }

    /** Clicked or tapped: hop and smile. Keep poking and it dances; poke too much and it gets grumpy. */
    poke() {
        const now = performance.now();
        this.pokes = this.pokes.filter((t) => now - t < 2500);
        this.pokes.push(now);
        const n = this.pokes.length;
        if (this.sleeping) { this.wake(true); return; }
        this.lastActivity = now;
        if (!this.isCalm()) { this.fx.hop = now / 1000; return; }   // busy talking: just a little hop
        if (n >= 6) { this.playOnce('Angry'); this.fx.shake = now / 1000; this.pokes = []; }
        else if (n === 3) { this.fx.dance = now / 1000; this.playOnce('Happy'); }
        else if (n < 3) { this.fx.hop = now / 1000; this.playOnce('Happy'); }
    }

    get glow() { return this.glowColor; }
    get isHovered() { return this.hovered; }

    resize(width: number, height: number) {
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    dispose() {
        this.disposed = true;
        this.renderer.setAnimationLoop(null);
        this.mixer?.stopAllAction();
        this.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
            mats.forEach((mat) => {
                Object.values(mat).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); });
                mat.dispose();
            });
        });
        this.scene.environment?.dispose();
        this.renderer.dispose();
    }

    // ---------- setup ----------

    private setupLights() {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const studio = new THREE.Scene();
        studio.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: { top: { value: new THREE.Color(0xffffff) }, bottom: { value: new THREE.Color(0x9c86e0) } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.7, 0.9, vP.y)), 1.0); }',
        })));
        const panel = (w: number, h: number, pos: [number, number, number], k: number) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) }));
            m.position.set(...pos); m.lookAt(0, 0, 0); studio.add(m);
        };
        panel(5, 3.5, [-5, 6, 5], 3.2); panel(3, 5, [6, 3, -4], 1.8);
        this.scene.environment = pmrem.fromScene(studio, 0.03).texture;
        this.scene.environmentIntensity = 0.75;
        studio.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
        pmrem.dispose();

        const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3.5, 5.5, 4);
        const rim = new THREE.DirectionalLight(0xc9b4ff, 1.6); rim.position.set(3, 3.5, -3.5);
        this.scene.add(key, rim, new THREE.HemisphereLight(0xf2ecff, 0x9a86d8, 0.9));
    }

    private setup(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
        const root = gltf.scene;
        this.root = root;
        this.scene.add(root);
        const rimUniform = { value: this.rimColor };

        root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            if (mesh.name === 'Body') {
                this.body = mesh;
                const old = mesh.material as THREE.Material;
                const mat = new THREE.MeshPhysicalMaterial({
                    vertexColors: true, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.08,
                    sheen: 0.25, sheenColor: new THREE.Color(0xd8c4ff),
                });
                // soft coloured rim light that follows the chat state
                mat.onBeforeCompile = (sh) => {
                    sh.uniforms.rimColor = rimUniform;
                    sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
                        `#include <emissivemap_fragment>
                         float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
                         totalEmissiveRadiance += rimColor * pow(1.0 - facing, 3.0) * 0.9;
                         totalEmissiveRadiance += rimColor * pow(facing, 3.0) * 0.18;`);
                };
                mesh.material = mat;
                old.dispose();
            }
            if (mesh.name.startsWith('EchoRing')) {
                const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
                mat.transparent = true; mat.depthWrite = false;
                mat.emissive = new THREE.Color(STATE_COLORS[OrbState.IDLE]); mat.emissiveIntensity = 2.2;
                mesh.material = mat;
                this.rings.push(mesh);
            }
            if (mesh.morphTargetDictionary && 'Blink' in mesh.morphTargetDictionary) this.eyes.push(mesh);
            if (mesh.morphTargetDictionary && 'Open' in mesh.morphTargetDictionary) this.mouthMesh = mesh;
        });
        this.rings.sort((a, b) => a.name.localeCompare(b.name));
        this.pivot = root.getObjectByName('EyesPivot') ?? null;
        this.mouth = root.getObjectByName('MouthRig') ?? root.getObjectByName('Mouth') ?? null;
        if (!this.body || !this.pivot) throw new Error('EchoBot model is missing parts');

        this.mixer = new THREE.AnimationMixer(root);
        for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
        this.mixer.addEventListener('finished', (e) => {
            if (e.action === this.oneShot) this.endOneShot();
        });
        const cfg = STATE_CLIPS[this.state];
        this.setBase(cfg.base, cfg.loop);
        this.playOnce('Happy');   // say hi
    }

    // ---------- clips ----------

    private start(a: THREE.AnimationAction, loop: boolean) {
        a.reset();
        a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        a.clampWhenFinished = !loop;
        a.setEffectiveWeight(1);
        a.play();
    }

    private setBase(name: string, loop: boolean) {
        const next = this.actions[name] ?? this.actions['Idle'];
        if (!next) return;
        if (next === this.base && loop) return;
        const prev = this.base;
        this.base = next;
        if (this.oneShot) return;           // the one-shot fades back into the new base when it ends
        this.start(next, loop);
        if (prev && prev !== next) prev.crossFadeTo(next, 0.3, false);
    }

    private playOnce(name: string) {
        const a = this.actions[name];
        if (!a || !this.mixer) return;
        const from = this.oneShot ?? this.base;
        if (a === from) return;
        this.start(a, false);
        if (from) from.crossFadeTo(a, 0.25, false);
        if (this.oneShot && this.oneShot !== a) this.oneShot.fadeOut(0.25);
        this.oneShot = a;
    }

    private endOneShot() {
        const a = this.oneShot;
        this.oneShot = null;
        if (!a || !this.base) return;
        const cfg = STATE_CLIPS[this.state];
        this.start(this.base, this.base === this.actions[cfg.base] ? cfg.loop : true);
        a.crossFadeTo(this.base, 0.3, false);
    }

    private isCalm() {
        return this.state === OrbState.IDLE || this.state === OrbState.TRACKING;
    }

    private wake(byUser: boolean) {
        this.lastActivity = performance.now();
        if (!this.sleeping) return;
        this.sleeping = false;
        if (!this.isCalm()) return;
        this.setBase('Idle', true);
        if (byUser) this.playOnce('Surprised');
    }

    // ---------- per frame ----------

    private frame() {
        if (!this.root || !this.mixer || !this.pivot) return;
        const dt = Math.min(this.clock.getDelta(), 0.1);
        const now = performance.now();
        const t = now / 1000;
        const calm = this.isCalm() && !this.oneShot;

        // fidget now and then, nap when nobody's around
        if (calm && !this.sleeping) {
            if (now - this.lastActivity > SLEEP_AFTER_MS) {
                this.sleeping = true;
                this.setBase('Sleep', true);
            } else if (now > this.nextFidget) {
                this.nextFidget = now + 25_000 + Math.random() * 25_000;
                this.playOnce(Math.random() < 0.6 ? 'LookAround' : 'Happy');
            }
        }

        this.mixer.update(dt);

        // remember what the clips set, layer live tweaks on top, put the clip values back after rendering
        // (the mixer only rewrites a value when it changes, so it has to find its own values again)
        const savedPivot = this.pivot.quaternion.clone();
        const savedMouth = this.mouth?.scale.clone();
        const openIdx = this.mouthMesh?.morphTargetDictionary?.Open ?? -1;
        const savedOpen = this.mouthMesh && openIdx >= 0 ? this.mouthMesh.morphTargetInfluences![openIdx] : 0;
        const savedEyes = this.eyes.map((e) => e.morphTargetInfluences!.slice());

        // audio: follow quickly on the way up, relax a bit slower
        const k = this.audio > this.smoothAudio ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 10);
        this.smoothAudio += (this.audio - this.smoothAudio) * k;
        const level = this.smoothAudio;

        // eyes: follow the pointer; glance down while you type; look up while thinking
        let target = this.lookTarget;
        if (this.lookOverride && now < this.lookOverride.until) target = this.lookOverride.v;
        if (this.sleeping) target = new THREE.Vector2();
        this.look.lerp(target, 1 - Math.pow(0.002, dt));
        const eu = new THREE.Euler(-this.look.y * 0.26, this.look.x * 0.34, 0);
        if (this.state !== OrbState.THINKING) this.pivot.quaternion.multiply(new THREE.Quaternion().setFromEuler(eu));

        // eye shapes: wide while listening, a pleased squint while you point at it
        const widen = this.state === OrbState.LISTENING ? 0.35 + level * 0.4 : 0;
        const pleased = this.hovered && this.isCalm() && !this.sleeping ? 0.35 : 0;
        for (const e of this.eyes) {
            const d = e.morphTargetDictionary!, inf = e.morphTargetInfluences!;
            if (widen && d.Surprised !== undefined) inf[d.Surprised] = Math.min(1, inf[d.Surprised] + widen);
            if (pleased && d.Happy !== undefined) inf[d.Happy] = Math.max(inf[d.Happy], pleased);
        }

        // mouth follows the voice while responding
        if (this.state === OrbState.RESPONDING && this.mouth && this.mouthMesh && openIdx >= 0) {
            const open = Math.min(1, level * 1.3);
            this.mouth.scale.copy(MOUTH_SCALE).multiplyScalar(Math.min(1, 0.45 + open * 2));
            this.mouthMesh.morphTargetInfluences![openIdx] = open;
        }

        // colour: ease the rings and rim light toward the state's colour
        this.glowColor.lerp(new THREE.Color(STATE_COLORS[this.state]), 1 - Math.exp(-dt * 4));
        this.rimColor.copy(this.glowColor).lerp(new THREE.Color(0xb995ff), 0.35);
        const busy = this.state === OrbState.LISTENING || this.state === OrbState.RESPONDING;
        const speed = this.state === OrbState.THINKING ? 0.9 : busy ? 0.75 : 0.5;
        this.rings.forEach((ring, i) => {
            const ph = (t * speed + i / 3) % 1;
            ring.scale.setScalar(0.78 + (0.36 + level * 0.25) * ph);
            const mat = ring.material as THREE.MeshStandardMaterial;
            mat.opacity = Math.min(1, Math.pow(Math.sin(Math.PI * ph), 1.5) * (this.sleeping ? 0.25 : 0.6 + level * 0.4));
            mat.emissive.copy(this.glowColor);
            mat.color.copy(this.glowColor);
            mat.emissiveIntensity = 2.2 + level * 2.5;
        });

        // whole-body moves: hop, dance, startled shake, a gentle pulse with your voice
        const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
        let ry = this.look.x * 0.2, py = 0, rz = 0;
        if (this.fx.hop >= 0) { const u = (t - this.fx.hop) / 0.6; py += Math.sin(Math.PI * Math.min(1, u)) * 0.2; if (u >= 1) this.fx.hop = -1; }
        if (this.fx.shake >= 0) { const u = t - this.fx.shake; rz += Math.sin(u * 40) * 0.08 * (1 - ease(u / 0.6)); if (u > 0.6) this.fx.shake = -1; }
        if (this.fx.dance >= 0) {
            const u = t - this.fx.dance;
            if (u < 3.2) { py += Math.abs(Math.sin(u * Math.PI * 2.5)) * 0.13; rz += Math.sin(u * Math.PI * 2.5) * 0.18; ry += Math.sin(u * Math.PI * 1.25) * 0.5; }
            else this.fx.dance = -1;
        }
        this.root.rotation.set(0, ry, rz);
        this.root.position.y = py;
        this.root.scale.setScalar(1 + (this.state === OrbState.LISTENING ? level * 0.05 : 0));

        this.renderer.render(this.scene, this.camera);

        this.pivot.quaternion.copy(savedPivot);
        if (this.mouth && savedMouth) this.mouth.scale.copy(savedMouth);
        if (this.mouthMesh && openIdx >= 0) this.mouthMesh.morphTargetInfluences![openIdx] = savedOpen;
        this.eyes.forEach((e, i) => { const inf = e.morphTargetInfluences!; savedEyes[i].forEach((v, j) => { inf[j] = v; }); });
    }
}

function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v));
}
