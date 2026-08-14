import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Particles({ count = 900 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.035;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.08;
    ref.current.position.x = state.pointer.x * 0.4;
    ref.current.position.y = state.pointer.y * 0.25;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#8b8cf7"
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function Orb() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.18;
    ref.current.rotation.x += delta * 0.06;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.18;
  });
  return (
    <mesh ref={ref} position={[2.6, 0, -1]}>
      <icosahedronGeometry args={[1.5, 1]} />
      <meshStandardMaterial
        color="#6366f1"
        wireframe
        transparent
        opacity={0.32}
        emissive="#22d3ee"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

export default function Scene({ withOrb = true }: { withOrb?: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 6], fov: 55 }}
      gl={{ antialias: false, powerPreference: "low-power" }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 5]} intensity={40} color="#a78bfa" />
      <Particles />
      {withOrb ? <Orb /> : null}
    </Canvas>
  );
}