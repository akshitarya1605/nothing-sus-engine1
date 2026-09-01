"use client";

import { forwardRef, useEffect, useMemo } from "react";
import * as THREE from "three";

interface CrewmateProps {
  color?: string;
  visorColor?: string;
}

// The classic crewmate silhouette — narrow near the feet, widest through the
// chest, rounded off at the top — built as a lathe profile (revolved around
// the vertical axis) rather than a plain capsule, so it actually reads as
// the bean-shaped astronaut rather than a pill.
const BODY_PROFILE = [
  new THREE.Vector2(0.1, -0.66),
  new THREE.Vector2(0.34, -0.6),
  new THREE.Vector2(0.5, -0.44),
  new THREE.Vector2(0.6, -0.18),
  new THREE.Vector2(0.62, 0.1),
  new THREE.Vector2(0.57, 0.38),
  new THREE.Vector2(0.46, 0.58),
  new THREE.Vector2(0.26, 0.72),
  new THREE.Vector2(0.0, 0.8),
];

/**
 * Procedurally built crewmate — real revolved geometry, not a rotated 2D
 * image. Front (visor), back (backpack) and sides are genuinely distinct
 * meshes, so rotation reveals real form rather than a billboard flip.
 */
export const Crewmate = forwardRef<THREE.Group, CrewmateProps>(function Crewmate(
  { color = "#e2313d", visorColor = "#8fe3f2" },
  ref,
) {
  const bodyColor = useMemo(() => new THREE.Color(color), [color]);
  const backpackColor = useMemo(() => bodyColor.clone().multiplyScalar(0.82), [bodyColor]);
  const legColor = useMemo(() => bodyColor.clone().multiplyScalar(0.9), [bodyColor]);
  const bodyGeometry = useMemo(() => new THREE.LatheGeometry(BODY_PROFILE, 40), []);

  useEffect(() => {
    return () => bodyGeometry.dispose();
  }, [bodyGeometry]);

  return (
    <group ref={ref} dispose={null}>
      {/* backpack — sits behind the body, only visible from the back */}
      <mesh position={[0, -0.06, -0.5]} scale={[0.5, 0.56, 0.3]} castShadow>
        <capsuleGeometry args={[0.5, 0.35, 6, 16]} />
        <meshStandardMaterial color={backpackColor} roughness={0.5} metalness={0.05} />
      </mesh>

      {/* main body — lathed bean silhouette */}
      <mesh geometry={bodyGeometry} scale={[1, 1, 0.86]} castShadow receiveShadow>
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.08} />
      </mesh>

      {/* visor rim */}
      <mesh position={[0, 0.28, 0.52]} rotation={[0.14, 0, 0]} scale={[0.78, 0.46, 0.38]} castShadow>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshStandardMaterial color="#10151b" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* visor glass */}
      <mesh position={[0, 0.3, 0.62]} rotation={[0.14, 0, 0]} scale={[0.66, 0.36, 0.24]}>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshPhysicalMaterial
          color={visorColor}
          roughness={0.06}
          metalness={0.15}
          transmission={0.3}
          thickness={0.5}
          emissive={visorColor}
          emissiveIntensity={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* legs */}
      <mesh position={[-0.24, -0.86, 0.06]} scale={[0.22, 0.3, 0.22]} castShadow>
        <capsuleGeometry args={[0.5, 0.4, 4, 12]} />
        <meshStandardMaterial color={legColor} roughness={0.35} />
      </mesh>
      <mesh position={[0.24, -0.86, 0.06]} scale={[0.22, 0.3, 0.22]} castShadow>
        <capsuleGeometry args={[0.5, 0.4, 4, 12]} />
        <meshStandardMaterial color={legColor} roughness={0.35} />
      </mesh>
    </group>
  );
});