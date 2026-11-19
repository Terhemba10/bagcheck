"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { AGENT_LOOKS, type AgentState } from "./states";

/**
 * Bag in 3D. Built for integrated graphics:
 *  - no transmission, no env maps, no post-processing
 *  - ~6 draw calls, dpr capped at 1.5
 *  - the frame loop stops when `active` is false (off-screen or tab hidden)
 */
export default function Agent3D({ state, active }: { state: AgentState; active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      // "demand" (not "never") when paused, so a resize still redraws one frame instead of leaving a blank canvas
      frameloop={active ? "always" : "demand"}
      // view height at the orb ≈ 2·4.8·tan(19°) ≈ 3.3 units: room for the orb (r=1) and rings (r≤1.4)
      camera={{ position: [0, 0, 4.8], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "default" }}
      style={{ background: "transparent" }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 3, 4]} intensity={2.2} />
      <directionalLight position={[-3, -1, 2]} intensity={0.5} color="#7ab2ff" />
      <Bag state={state} />
    </Canvas>
  );
}

const tmpColor = new THREE.Color();

function Bag({ state }: { state: AgentState }) {
  const look = AGENT_LOOKS[state];
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const eyes = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const ringMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const rimMat = useRef<THREE.ShaderMaterial>(null);
  const pulse = useRef({ last: state, t: 0 });

  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const rimShader = useMemo(() => makeRimShader(look.color), []); // eslint-disable-line react-hooks/exhaustive-deps -- colour is eased per frame
  const target = useMemo(() => new THREE.Color(look.color), [look.color]);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const d = Math.min(dt, 0.05);

    // state change -> one soft pulse
    if (pulse.current.last !== state) {
      pulse.current = { last: state, t: 0.9 };
    }
    pulse.current.t = Math.max(0, pulse.current.t - d);
    const p = Math.sin((pulse.current.t / 0.9) * Math.PI) * 0.06;

    // colour easing
    for (const m of [coreMat.current, glowMat.current]) m?.color.lerp(target, 1 - Math.exp(-d * 4));
    if (bodyMat.current) bodyMat.current.emissive.lerp(tmpColor.copy(target).multiplyScalar(0.18), 1 - Math.exp(-d * 4));
    for (const m of ringMats.current) m?.color.lerp(target, 1 - Math.exp(-d * 4));
    if (rimMat.current) (rimMat.current.uniforms.uColor!.value as THREE.Color).lerp(target, 1 - Math.exp(-d * 4));

    if (root.current) {
      const breathe = 1 + Math.sin((t * Math.PI * 2) / look.breathe) * 0.025 + p;
      root.current.scale.setScalar(breathe);
      root.current.position.y = Math.sin(t * 0.9) * 0.06;
    }
    if (tilt.current) {
      // gentle look toward the pointer, lean for concern, small sway for danger (no flashing)
      const leanZ = THREE.MathUtils.degToRad(-look.lean) + THREE.MathUtils.degToRad(look.sway) * Math.sin(t * Math.PI * 2 * 1.2);
      tilt.current.rotation.z = THREE.MathUtils.damp(tilt.current.rotation.z, leanZ, 6, d);
      tilt.current.rotation.y = THREE.MathUtils.damp(tilt.current.rotation.y, s.pointer.x * 0.35, 3, d);
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, -s.pointer.y * 0.2, 3, d);
    }
    if (eyes.current) {
      const glance = look.rings ? Math.sin(t * 2.2) * 0.06 : 0;
      eyes.current.position.x = THREE.MathUtils.damp(eyes.current.position.x, glance, 8, d);
      // blink every ~5 s
      const blink = (t % 5.2) > 5.05 ? 0.15 : 1;
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 30, d);
    }
    if (rings.current) {
      rings.current.visible = look.rings;
      if (look.rings) {
        rings.current.children[0]!.rotation.z += d * 1.4;
        rings.current.children[1]!.rotation.z -= d * 1.0;
      }
    }
  });

  return (
    <group ref={root}>
      {/* soft halo: must stay inside the camera's ~2.9-unit view or the canvas edge shows */}
      <sprite scale={[3.1, 3.1, 1]} renderOrder={-1}>
        <spriteMaterial ref={glowMat} map={glowTexture} color={look.color} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
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
            roughness={0.1}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.78}
            emissive={look.color}
            emissiveIntensity={0.22}
          />
        </mesh>
        {/* fresnel rim: the "glass" edge glow, one cheap draw call */}
        <mesh scale={1.005}>
          <sphereGeometry args={[1, 48, 48]} />
          <shaderMaterial ref={rimMat} args={[rimShader]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
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
      <group ref={rings} rotation={[1.2, 0.2, 0]}>
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
        <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
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
