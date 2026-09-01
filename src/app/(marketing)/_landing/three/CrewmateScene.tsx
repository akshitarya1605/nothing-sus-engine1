"use client";

import { Suspense, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import type * as THREE from "three";
import { Crewmate } from "./Crewmate";

interface CrewmateSceneProps {
  groupRef: RefObject<THREE.Group | null>;
  lowQuality?: boolean;
}

export function CrewmateScene({ groupRef, lowQuality = false }: CrewmateSceneProps) {
  return (
    <Canvas
      dpr={lowQuality ? 1 : [1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, -0.06, 4.0], fov: 32 }}
      style={{ position: "absolute", inset: 0 }}
      frameloop="always"
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[2.6, 3, 2.2]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-3, -1.2, -2.4]} intensity={0.55} color="#3fe8e0" />
      <pointLight position={[0, 1.6, -2.4]} intensity={0.8} color="#ff4d5e" distance={8} />
      <Suspense fallback={null}>
        <group ref={groupRef}>
          <Crewmate />
        </group>
      </Suspense>
    </Canvas>
  );
}