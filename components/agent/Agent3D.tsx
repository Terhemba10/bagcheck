"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AGENT_LOOKS, type AgentState } from "./states";

/**
 * Bag in 3D. Built for integrated graphics (target: Intel HD 520):
 *  - rendering capped at 30 fps (FrameLimiter), stopped when off-screen / tab hidden
 *  - no transmission, env maps or post-processing; ~9 draw calls
 *  - particles animate in the vertex shader (no per-frame CPU work)
 *  - dpr capped at 1.5
 */
export const FPS_CAP = 30;

export default function Agent3D({
  state,
  active,
  react,
  onFirstFrame,
}: {
  state: AgentState;
  active: boolean;
  react: number;
  /** Called once, after the first frame has rendered (used for the 2D → 3D cross-fade). */
  onFirstFrame?: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      // view height at the orb ≈ 2·4.8·tan(19°) ≈ 3.3 units: room for the orb (r=1), ring and particles (r≤1.55)
      camera={{ position: [0, 0, 4.8], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "default" }}
      style={{ background: "transparent" }}
      aria-hidden="true"
    >
      <FrameLimiter active={active} fps={FPS_CAP} />
      <FirstFrame onFirstFrame={onFirstFrame} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[2.5, 3, 4]} intensity={2.4} />
      <directionalLight position={[-3, -1, 2]} intensity={0.5} color="#7ab2ff" />
      {/* back rim light */}
      <directionalLight position={[0, 2, -4]} intensity={1.6} color="#ffffff" />
      <Bag state={state} react={react} />
    </Canvas>
  );
}

/** Fires once after the second rendered frame (by then shaders are compiled and the orb is on screen). */
function FirstFrame({ onFirstFrame }: { onFirstFrame?: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 1) return;
    frames.current += 1;
    if (frames.current === 2) onFirstFrame?.();
  });
  return null;
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

const tmpColor = new THREE.Color();
const ease = (d: number, k: number) => 1 - Math.exp(-d * k);

function Bag({ state, react }: { state: AgentState; react: number }) {
  const look = AGENT_LOOKS[state];
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const rimMat = useRef<THREE.ShaderMaterial>(null);
  const eyes = useRef<THREE.Group>(null);
  const scanRings = useRef<THREE.Group>(null);
  const ringMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const haloRing = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const particleMat = useRef<THREE.ShaderMaterial>(null);
  const pulse = useRef({ last: state, t: 0 });
  const hop = useRef({ last: react, t: 0 });

  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const rimShader = useMemo(() => makeRimShader(look.color), []); // eslint-disable-line react-hooks/exhaustive-deps -- colour is eased per frame
  const particles = useMemo(() => makeParticles(70, look.color), []); // eslint-disable-line react-hooks/exhaustive-deps -- colour is eased per frame
  const target = useMemo(() => new THREE.Color(look.color), [look.color]);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const d = Math.min(dt, 0.1);

    // state change -> one soft pulse
    if (pulse.current.last !== state) pulse.current = { last: state, t: 0.9 };
    pulse.current.t = Math.max(0, pulse.current.t - d);
    const p = Math.sin((pulse.current.t / 0.9) * Math.PI) * 0.06;

    // typing -> small hop (0.45 s)
    if (hop.current.last !== react) hop.current = { last: react, t: 0.45 };
    hop.current.t = Math.max(0, hop.current.t - d);
    const h = Math.sin((hop.current.t / 0.45) * Math.PI);

    // colour easing (all parts follow the state colour)
    const k = ease(d, 4);
    coreMat.current?.color.lerp(target, k);
    glowMat.current?.color.lerp(target, k);
    haloMat.current?.color.lerp(target, k);
    for (const m of ringMats.current) m?.color.lerp(target, k);
    bodyMat.current?.emissive.lerp(tmpColor.copy(target).multiplyScalar(0.18), k);
    if (rimMat.current) (rimMat.current.uniforms.uColor!.value as THREE.Color).lerp(target, k);
    if (particleMat.current) {
      particleMat.current.uniforms.uTime!.value = t;
      (particleMat.current.uniforms.uColor!.value as THREE.Color).lerp(target, k);
      particleMat.current.uniforms.uSpeed!.value = THREE.MathUtils.damp(particleMat.current.uniforms.uSpeed!.value as number, look.rings ? 2.2 : 1, 3, d);
    }

    if (root.current) {
      const breathe = 1 + Math.sin((t * Math.PI * 2) / look.breathe) * 0.025 + p;
      // squash-and-stretch on the hop
      root.current.scale.set(breathe * (1 + h * 0.03), breathe * (1 + h * 0.05), breathe);
      root.current.position.y = Math.sin(t * 0.9) * 0.06 + h * 0.12;
    }
    if (tilt.current) {
      // look toward the pointer, lean for concern, small sway for danger (no flashing)
      const leanZ = THREE.MathUtils.degToRad(-look.lean) + THREE.MathUtils.degToRad(look.sway) * Math.sin(t * Math.PI * 2 * 1.2);
      tilt.current.rotation.z = THREE.MathUtils.damp(tilt.current.rotation.z, leanZ, 6, d);
      tilt.current.rotation.y = THREE.MathUtils.damp(tilt.current.rotation.y, s.pointer.x * 0.35 + (hop.current.t > 0 ? -0.25 : 0), 3, d);
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, -s.pointer.y * 0.2 + (hop.current.t > 0 ? 0.12 : 0), 3, d);
    }
    if (eyes.current) {
      // scanning: glance side to side; typing: look down-left toward the search box
      const glanceX = look.rings ? Math.sin(t * 2.2) * 0.06 : hop.current.t > 0 ? -0.05 : 0;
      const glanceY = hop.current.t > 0 ? -0.04 : 0;
      eyes.current.position.x = THREE.MathUtils.damp(eyes.current.position.x, glanceX, 8, d);
      eyes.current.position.y = THREE.MathUtils.damp(eyes.current.position.y, glanceY, 8, d);
      const blink = t % 5.2 > 5.05 ? 0.15 : 1; // blink every ~5 s
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 30, d);
    }
    if (haloRing.current) haloRing.current.rotation.z += d * 0.15;
    if (scanRings.current) {
      scanRings.current.visible = look.rings;
      if (look.rings) {
        scanRings.current.children[0]!.rotation.z += d * 1.4;
        scanRings.current.children[1]!.rotation.z -= d * 1.0;
      }
    }
  });

  return (
    <group ref={root}>
      {/* soft halo: stays inside the ~3.3-unit view so the canvas edge never shows */}
      <sprite scale={[3.1, 3.1, 1]} renderOrder={-1}>
        <spriteMaterial ref={glowMat} map={glowTexture} color={look.color} transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* slow floating particles */}
      <points geometry={particles.geometry}>
        <shaderMaterial ref={particleMat} args={[particles.shader]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* faint orbit ring, always there */}
      <mesh ref={haloRing} rotation={[1.25, 0.15, 0]}>
        <torusGeometry args={[1.34, 0.006, 6, 128]} />
        <meshBasicMaterial ref={haloMat} color={look.color} transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <group ref={tilt}>
        {/* inner core of light */}
        <mesh scale={0.6}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial ref={coreMat} color={look.color} transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* glassy shell */}
        <mesh>
          <sphereGeometry args={[1, 48, 48]} />
          <meshPhysicalMaterial
            ref={bodyMat}
            color="#0e1f47"
            roughness={0.08}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.04}
            transparent
            opacity={0.78}
            emissive={look.color}
            emissiveIntensity={0.22}
          />
        </mesh>
        {/* fresnel rim: the glass edge glow */}
        <mesh scale={1.005}>
          <sphereGeometry args={[1, 48, 48]} />
          <shaderMaterial ref={rimMat} args={[rimShader]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* glass highlight: a soft specular glint upper-left */}
        <sprite position={[-0.42, 0.5, 0.78]} scale={[0.46, 0.26, 1]}>
          <spriteMaterial map={glowTexture} color="#ffffff" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} rotation={0.6} />
        </sprite>
        <sprite position={[0.5, -0.52, 0.7]} scale={[0.12, 0.12, 1]}>
          <spriteMaterial map={glowTexture} color="#ffffff" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        {/* face of light */}
        <group position={[0, 0.02, 0.93]}>
          <group ref={eyes}>
            {[-0.24, 0.24].map((x) => (
              <mesh key={x} position={[x, 0.08, 0]}>
                <capsuleGeometry args={[0.065, 0.13, 6, 12]} />
                <meshBasicMaterial color="#f4fffd" />
              </mesh>
            ))}
          </group>
          <Mouth kind={look.mouth} />
        </group>
      </group>

      {/* scanning rings */}
      <group ref={scanRings} rotation={[1.2, 0.2, 0]}>
        {[1.26, 1.4].map((r, i) => (
          <mesh key={r} rotation={[i * 0.5, i * 0.7, 0]}>
            <torusGeometry args={[r, 0.012, 8, 96]} />
            <meshBasicMaterial
              ref={(m) => {
                if (m) ringMats.current[i] = m;
              }}
              color={look.color}
              transparent
              opacity={0.75}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Mouth({ kind }: { kind: "smile" | "flat" | "o" | "soft" }) {
  const mat = <meshBasicMaterial color="#f4fffd" />;
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

/** Particles on a loose shell around Bag; drift is computed in the vertex shader. */
function makeParticles(count: number, color: string) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 2);
  // deterministic pseudo-random so the layout is stable between renders
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const r = 1.18 + rnd() * 0.36;
    const theta = rnd() * Math.PI * 2;
    const y = (rnd() * 2 - 1) * 0.9;
    pos.set([Math.cos(theta) * r, y, Math.sin(theta) * r], i * 3);
    seed.set([0.15 + rnd() * 0.35, rnd() * Math.PI * 2], i * 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 2));
  const shader = {
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSpeed: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSpeed;
      attribute vec2 aSeed;
      varying float vAlpha;
      void main() {
        float a = uTime * aSeed.x * 0.35 * uSpeed + aSeed.y;
        float c = cos(a), s = sin(a);
        vec3 p = vec3(position.x * c - position.z * s, position.y + sin(uTime * 0.6 + aSeed.y) * 0.08, position.x * s + position.z * c);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // fade particles that pass behind the orb
        vAlpha = smoothstep(-1.2, 0.4, p.z) * (0.55 + 0.45 * sin(uTime * 1.3 + aSeed.y * 3.0));
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

function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
