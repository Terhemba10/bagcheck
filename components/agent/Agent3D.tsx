"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AGENT_LOOKS, heartbeat, type AgentState } from "./states";

/**
 * Bag in 3D, built for integrated graphics (target: Intel HD 520).
 *
 * Quality "high": glass transmission (core + particles refract through the
 *   shell), iridescent edge, bloom, 70 particles.
 * Quality "low":  same look without transmission and bloom, 30 particles.
 * Both: rendering capped (default 30 fps), paused off-screen / tab hidden,
 *   dpr ≤ 1.5, particles animated in the vertex shader (no CPU cost).
 */
export type Quality = "high" | "low";

export interface Agent3DProps {
  state: AgentState;
  active: boolean;
  /** Increments on each keystroke in the search box (listening). */
  react: number;
  /** True while Bag "speaks" a verdict: the core pulses in time with the text. */
  speaking?: boolean;
  quality: Quality;
  fpsCap?: number;
  /** Called once after the first frames have rendered (2D → 3D cross-fade). */
  onFirstFrame?: () => void;
  /** Average rendered fps over a 3 s window after warm-up (auto quality). */
  onPerf?: (fps: number) => void;
}

export default function Agent3D({ state, active, react, speaking = false, quality, fpsCap = 30, onFirstFrame, onPerf }: Agent3DProps) {
  const high = quality === "high";
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      // camera a little above, looking down slightly, so the floor shadow reads as a floor
      camera={{ position: [0, 0.32, 4.8], fov: 38 }}
      onCreated={({ camera }) => camera.lookAt(0, -0.05, 0)}
      gl={{ antialias: !high, alpha: true, powerPreference: "default", premultipliedAlpha: true }}
      style={{ background: "transparent" }}
      aria-hidden="true"
    >
      {/* High: bloom makes the canvas opaque anyway (edges are masked in CSS), so give the
          transmission pass the page's navy to refract instead of empty space (which looks frosted) */}
      {high && <color attach="background" args={["#070b18"]} />}
      <FrameLimiter active={active} fps={fpsCap} />
      <Watchers onFirstFrame={onFirstFrame} onPerf={onPerf} />
      <ambientLight intensity={0.3} />
      {/* soft "environment": key, cool fill, warm-ish top, strong back rim */}
      <directionalLight position={[2.5, 3, 4]} intensity={2.4} />
      <directionalLight position={[-3, -1, 2]} intensity={0.55} color="#7ab2ff" />
      <directionalLight position={[0, 4, 0]} intensity={0.3} color="#fff4e6" />
      <directionalLight position={[0, 0.4, -4]} intensity={1.0} color="#ffffff" />
      <Bag state={state} react={react} speaking={speaking} high={high} />
      {high && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.85} luminanceSmoothing={0.15} radius={0.5} resolutionScale={0.5} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

/** Ask for a new frame at most `fps` times a second, only while active. */
function FrameLimiter({ active, fps }: { active: boolean; fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate(); // always draw at least one frame (also after resizes)
    if (!active) return;
    let raf = 0;
    let last = 0;
    const interval = 1000 / fps;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last >= interval - 1) {
        last = t;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, fps, invalidate]);
  return null;
}

/** First-frame signal, frame counter (for measurements) and the auto-quality sample. */
function Watchers({ onFirstFrame, onPerf }: { onFirstFrame?: () => void; onPerf?: (fps: number) => void }) {
  const frames = useRef(0);
  const sample = useRef<{ start: number; count: number; done: boolean; last: number }>({ start: 0, count: 0, done: false, last: 0 });
  useFrame(() => {
    frames.current += 1;
    // a gap of > 0.5 s means rendering was paused (off-screen / hidden): restart the sample, it isn't slowness
    const t = performance.now();
    if (sample.current.last && t - sample.current.last > 500 && !sample.current.done) {
      sample.current.start = t;
      sample.current.count = 0;
    }
    sample.current.last = t;
    const w = window as Window & { __bagFrames?: number };
    w.__bagFrames = (w.__bagFrames ?? 0) + 1;
    if (frames.current === 2) onFirstFrame?.();
    // skip warm-up (the first 45 frames include shader compiles), then average over 3 s
    const now = performance.now();
    const s = sample.current;
    if (s.done || !onPerf) return;
    if (frames.current === 45) {
      s.start = now;
      s.count = 0;
    } else if (s.start > 0) {
      s.count += 1;
      if (now - s.start >= 3000) {
        s.done = true;
        onPerf((s.count * 1000) / (now - s.start));
      }
    }
  });
  return null;
}

const tmpColor = new THREE.Color();
const WHITE = new THREE.Color("#ffffff");
const ease = (d: number, k: number) => 1 - Math.exp(-d * k);

function Bag({ state, react, speaking, high }: { state: AgentState; react: number; speaking: boolean; high: boolean }) {
  const look = AGENT_LOOKS[state];
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const rimMat = useRef<THREE.ShaderMaterial>(null);
  const eyes = useRef<THREE.Group>(null);
  const scanRings = useRef<THREE.Group>(null);
  const ringMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const haloRing = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const shield = useRef<THREE.Mesh>(null);
  const shieldMat = useRef<THREE.MeshBasicMaterial>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null);
  const particleMat = useRef<THREE.ShaderMaterial>(null);

  const anim = useRef({ lastState: state, pulse: 0, lastReact: react, listen: 0, boost: 0, flow: 0, shield: 0, speak: 0 });

  const glowTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)"), []);
  const shadowTexture = useMemo(() => makeGlowTexture("rgba(0,0,0,0.75)", "rgba(0,0,0,0.35)"), []);
  const rimShader = useMemo(() => makeRimShader(look.color), []); // eslint-disable-line react-hooks/exhaustive-deps -- colour is eased per frame
  const particles = useMemo(() => makeParticles(high ? 70 : 30, look.color), [high]); // eslint-disable-line react-hooks/exhaustive-deps -- colour is eased per frame
  const target = useMemo(() => new THREE.Color(look.color), [look.color]);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const d = Math.min(dt, 0.1);
    const a = anim.current;

    // state change -> one soft pulse
    if (a.lastState !== state) {
      a.lastState = state;
      a.pulse = 0.9;
    }
    a.pulse = Math.max(0, a.pulse - d);
    const p = Math.sin((a.pulse / 0.9) * Math.PI) * 0.06;

    // listening: each keystroke brightens the core; Bag leans toward the search box while typing
    if (a.lastReact !== react) {
      a.lastReact = react;
      a.boost = Math.min(1, a.boost + 0.45);
      a.listen = 1.2; // seconds of "listening" after the last key
    }
    a.listen = Math.max(0, a.listen - d);
    a.boost = THREE.MathUtils.damp(a.boost, 0, 3, d);
    const listening = a.listen > 0 ? 1 : 0;

    // speaking: syllable-like pulses while the verdict text appears
    a.speak = THREE.MathUtils.damp(a.speak, speaking ? 1 : 0, 6, d);
    const syllables = a.speak * (0.5 + 0.5 * Math.abs(Math.sin(t * 9.0) * Math.sin(t * 3.7 + 1.3)));

    // smooth blends for state-driven effects
    a.flow = THREE.MathUtils.damp(a.flow, look.rings ? 1 : 0, 3, d);
    a.shield = THREE.MathUtils.damp(a.shield, look.shield ? 1 : 0, 2.5, d);

    // colours follow the state
    const k = ease(d, 4);
    // core colour: state colour, brighter with keystrokes / speech; on High (opaque) the beat drives brightness
    const beatNow = heartbeat(t, look.heartbeat) * look.pulseDepth;
    const coreBright = high ? 0.5 + beatNow * 0.5 + a.boost * 0.3 + syllables * 0.3 : 1;
    coreMat.current?.color.lerp(tmpColor.copy(target).lerp(WHITE, a.boost * 0.35 + syllables * 0.25).multiplyScalar(coreBright), k * 2);
    glowMat.current?.color.lerp(target, k);
    haloMat.current?.color.lerp(target, k);
    shieldMat.current?.color.lerp(target, k);
    for (const m of ringMats.current) m?.color.lerp(target, k);
    bodyMat.current?.emissive.lerp(tmpColor.copy(target).multiplyScalar(high ? 0.12 : 0.18), k);
    if (rimMat.current) (rimMat.current.uniforms.uColor!.value as THREE.Color).lerp(target, k);
    if (particleMat.current) {
      const u = particleMat.current.uniforms;
      u.uTime!.value = t;
      (u.uColor!.value as THREE.Color).lerp(target, k);
      u.uFlow!.value = a.flow;
    }

    // heartbeat core (deep and slow in danger), plus keystroke boost and speech
    const beat = heartbeat(t, look.heartbeat) * look.pulseDepth;
    // the glass magnifies what is inside it, so the High core is drawn smaller to look the same size
    const coreBase = high ? 0.34 : 0.58;
    if (core.current) core.current.scale.setScalar(coreBase + beat * 0.05 + a.boost * 0.04 + syllables * 0.04);
    if (coreMat.current && !high) coreMat.current.opacity = 0.3 + beat * 0.35 + a.boost * 0.3 + syllables * 0.3;
    if (glowMat.current) glowMat.current.opacity = 0.34 + beat * 0.18 + a.boost * 0.12 + syllables * 0.15;

    if (root.current) {
      const breathe = 1 + Math.sin((t * Math.PI * 2) / look.breathe) * 0.025 + p;
      root.current.scale.setScalar(breathe);
      root.current.position.y = Math.sin(t * 0.9) * 0.06;
      // listening: drift a little toward the search box (left on desktop)
      root.current.position.x = THREE.MathUtils.damp(root.current.position.x, listening * -0.12, 4, d);
    }
    if (shadow.current && root.current) {
      // the floor shadow tightens and darkens as Bag dips
      const h = root.current.position.y;
      shadow.current.scale.set(1.5 - h * 1.2, 0.3 - h * 0.25, 1);
      shadow.current.position.x = root.current.position.x * 0.8;
      if (shadowMat.current) shadowMat.current.opacity = 0.5 - h * 1.2;
    }
    if (tilt.current) {
      // look toward the pointer; lean for concern; lean toward the search box while listening
      const leanZ = THREE.MathUtils.degToRad(-look.lean) + listening * 0.12;
      tilt.current.rotation.z = THREE.MathUtils.damp(tilt.current.rotation.z, leanZ, 5, d);
      tilt.current.rotation.y = THREE.MathUtils.damp(tilt.current.rotation.y, s.pointer.x * 0.35 - listening * 0.28, 3, d);
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, -s.pointer.y * 0.2 + listening * 0.14, 3, d);
    }
    if (eyes.current) {
      // scanning: glance side to side; listening: look down-left at the search box; else follow the cursor a little
      const glanceX = look.rings ? Math.sin(t * 2.2) * 0.06 : listening ? -0.06 : s.pointer.x * 0.03;
      const glanceY = listening ? -0.045 : s.pointer.y * 0.02;
      eyes.current.position.x = THREE.MathUtils.damp(eyes.current.position.x, glanceX, 8, d);
      eyes.current.position.y = THREE.MathUtils.damp(eyes.current.position.y, glanceY, 8, d);
      const blink = t % 5.2 > 5.05 ? 0.15 : 1; // occasional blink
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 30, d);
    }
    if (haloRing.current) haloRing.current.rotation.z += d * 0.15;
    if (shield.current && shieldMat.current) {
      shield.current.visible = a.shield > 0.01;
      shield.current.rotation.z -= d * 0.12;
      shield.current.scale.setScalar(0.9 + a.shield * 0.1 + beat * 0.015);
      shieldMat.current.opacity = a.shield * (0.4 + beat * 0.25);
    }
    if (scanRings.current) {
      scanRings.current.visible = a.flow > 0.01;
      scanRings.current.scale.setScalar(0.85 + a.flow * 0.15);
      scanRings.current.children[0]!.rotation.z += d * 1.4;
      scanRings.current.children[1]!.rotation.z -= d * 1.0;
      for (const m of ringMats.current) if (m) m.opacity = 0.75 * a.flow;
    }
  });

  return (
    <group>
      {/* soft contact shadow on an implied floor */}
      <mesh ref={shadow} position={[0, -1.42, -0.2]} rotation={[-0.08, 0, 0]} renderOrder={-2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={shadowMat} map={shadowTexture} transparent depthWrite={false} opacity={0.5} />
      </mesh>

      <group ref={root}>
        {/* halo: stays inside the ~3.3-unit view so the canvas edge never shows */}
        <sprite scale={[3.1, 3.1, 1]} renderOrder={-1}>
          <spriteMaterial ref={glowMat} map={glowTexture} color={look.color} transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>

        {/* data particles: drift around Bag; while scanning they flow in from the edges */}
        <points geometry={particles.geometry}>
          <shaderMaterial ref={particleMat} args={[particles.shader]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>

        {/* faint orbit ring, always there */}
        <mesh ref={haloRing} rotation={[1.25, 0.15, 0]}>
          <torusGeometry args={[1.34, 0.006, 6, 128]} />
          <meshBasicMaterial ref={haloMat} color={look.color} transparent opacity={0.22} depthWrite={false} />
        </mesh>

        {/* protective shield ring (danger): a slow hexagon, no flashing */}
        <mesh ref={shield} visible={false}>
          <torusGeometry args={[1.22, 0.018, 4, 6]} />
          <meshBasicMaterial ref={shieldMat} color={look.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>

        <group ref={tilt}>
          {/* inner core of light, beating like a heart */}
          <mesh ref={core} scale={0.58}>
            <sphereGeometry args={[1, 32, 32]} />
            {high ? (
              // opaque on High: the glass shell refracts it (soft, real refraction)
              <meshBasicMaterial ref={coreMat} color={look.color} toneMapped={false} />
            ) : (
              <meshBasicMaterial ref={coreMat} color={look.color} transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            )}
          </mesh>
          {/* glass shell: real transmission on High, transparent glass on Low; iridescent edge on both */}
          <mesh>
            <sphereGeometry args={[1, high ? 64 : 48, high ? 64 : 48]} />
            {high ? (
              <meshPhysicalMaterial
                ref={bodyMat}
                color="#ffffff"
                transmission={1}
                thickness={0.45}
                ior={1.15}
                roughness={0.18}
                metalness={0}
                attenuationColor="#cfe0ff"
                attenuationDistance={6}
                clearcoat={1}
                clearcoatRoughness={0.04}
                iridescence={0.9}
                iridescenceIOR={1.28}
                iridescenceThicknessRange={[120, 420]}
                emissive={look.color}
                emissiveIntensity={0.03}
              />
            ) : (
              <meshPhysicalMaterial
                ref={bodyMat}
                color="#0e1f47"
                roughness={0.08}
                metalness={0.1}
                clearcoat={1}
                clearcoatRoughness={0.04}
                iridescence={0.7}
                iridescenceIOR={1.28}
                iridescenceThicknessRange={[120, 420]}
                transparent
                opacity={0.78}
                emissive={look.color}
                emissiveIntensity={0.22}
              />
            )}
          </mesh>
          {/* fresnel rim: the glass edge glow */}
          <mesh scale={1.005}>
            <sphereGeometry args={[1, 48, 48]} />
            <shaderMaterial ref={rimMat} args={[rimShader]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          {/* glass highlight: a soft specular glint upper-left + a small one lower-right */}
          <sprite position={[-0.42, 0.5, 0.78]} scale={[0.46, 0.26, 1]}>
            <spriteMaterial map={glowTexture} color="#ffffff" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} rotation={0.6} />
          </sprite>
          <sprite position={[0.5, -0.52, 0.7]} scale={[0.12, 0.12, 1]}>
            <spriteMaterial map={glowTexture} color="#ffffff" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          {/* face of light */}
          {/* on the surface (z ≥ 1): inside the shell, transmission would refract and blur it */}
          <group position={[0, 0.02, 1.0]}>
            <group ref={eyes}>
              {[-0.24, 0.24].map((x) => (
                <mesh key={x} position={[x, 0.08, 0]}>
                  <capsuleGeometry args={[0.065, 0.13, 6, 12]} />
                  <meshBasicMaterial color="#f4fffd" toneMapped={false} />
                </mesh>
              ))}
            </group>
            <Mouth kind={look.mouth} />
          </group>
        </group>

        {/* scanning rings */}
        <group ref={scanRings} rotation={[1.2, 0.2, 0]} visible={false}>
          {[1.26, 1.4].map((r, i) => (
            <mesh key={r} rotation={[i * 0.5, i * 0.7, 0]}>
              <torusGeometry args={[r, 0.012, 8, 96]} />
              <meshBasicMaterial
                ref={(m) => {
                  if (m) ringMats.current[i] = m;
                }}
                color={look.color}
                transparent
                opacity={0}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function Mouth({ kind }: { kind: "smile" | "flat" | "o" | "soft" }) {
  const mat = <meshBasicMaterial color="#f4fffd" toneMapped={false} />;
  if (kind === "flat")
    return (
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.034, 0.22, 4, 8]} />
        {mat}
      </mesh>
    );
  if (kind === "o")
    return (
      <mesh position={[0, -0.21, 0]}>
        <torusGeometry args={[0.055, 0.024, 8, 24]} />
        {mat}
      </mesh>
    );
  const arc = kind === "smile" ? Math.PI * 0.62 : Math.PI * 0.42;
  return (
    <mesh position={[0, -0.08, 0]} rotation={[0, 0, Math.PI + (Math.PI - arc) / 2]}>
      <torusGeometry args={[0.17, 0.028, 8, 32, arc]} />
      {mat}
    </mesh>
  );
}

/**
 * Particles on a loose shell around Bag. uFlow = 0: slow orbiting drift.
 * uFlow = 1 (scanning): particles stream in from the edges toward the core,
 * looping. All motion is in the vertex shader.
 */
function makeParticles(count: number, color: string) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  let s = 7; // deterministic so the layout is stable between renders
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const r = 1.18 + rnd() * 0.36;
    const theta = rnd() * Math.PI * 2;
    const y = (rnd() * 2 - 1) * 0.9;
    pos.set([Math.cos(theta) * r, y, Math.sin(theta) * r], i * 3);
    seed.set([0.15 + rnd() * 0.35, rnd() * Math.PI * 2, rnd()], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
  const shader = {
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uFlow: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlow;
      attribute vec3 aSeed;
      varying float vAlpha;
      void main() {
        // drift: slow orbit around the y axis
        float a = uTime * aSeed.x * 0.35 * (1.0 + uFlow * 1.5) + aSeed.y;
        float c = cos(a), s = sin(a);
        vec3 drift = vec3(position.x * c - position.z * s, position.y + sin(uTime * 0.6 + aSeed.y) * 0.08, position.x * s + position.z * c);
        // flow: from the canvas edge (r ~ 1.65) into the core (r ~ 0.4), looping
        float ph = fract(uTime * (0.25 + aSeed.x * 0.5) + aSeed.z);
        vec3 dir = normalize(drift);
        vec3 inflow = dir * mix(1.65, 0.4, ph);
        vec3 p = mix(drift, inflow, uFlow);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float flowFade = mix(1.0, smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.75, 1.0, ph)), uFlow);
        vAlpha = smoothstep(-1.2, 0.4, p.z) * (0.55 + 0.45 * sin(uTime * 1.3 + aSeed.y * 3.0)) * flowFade;
        gl_PointSize = (2.0 + aSeed.x * 6.0) * (4.8 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * a, a);
      }`,
  };
  return { geometry, shader };
}

function makeRimShader(color: string) {
  return {
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 2.6 }, uStrength: { value: 1.25 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), uPower);
        gl_FragColor = vec4(mix(uColor, vec3(1.0), f * 0.35) * f * uStrength, f);
      }`,
  };
}

function makeGlowTexture(inner: string, mid: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
