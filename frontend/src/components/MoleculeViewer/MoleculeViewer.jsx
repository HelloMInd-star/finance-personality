/**
 * MoleculeViewer - 3D 分子可视化组件
 * 使用 @react-three/fiber 渲染调酒相关分子的 3D 结构
 *
 * 依赖: three, @react-three/fiber@8, @react-three/drei@9
 * 安装后即可使用,无需修改 Vite 配置
 */
import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  MOLECULES,
  ELEMENT_COLORS,
  ELEMENT_RADIUS,
  getMolecule,
} from './moleculeData';
import './MoleculeViewer.css';

// ========================================
// 3D 子组件
// ========================================

// 原子球体 - 悬停高亮 + 氧原子呼吸辉光
function AtomMesh({ atom, onHover }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const color = ELEMENT_COLORS[atom.element] || '#888888';
  const radius = ELEMENT_RADIUS[atom.element] || 0.4;

  useFrame((state) => {
    if (meshRef.current && atom.element === 'O') {
      const pulse = 0.05 + Math.sin(state.clock.elapsedTime * 2) * 0.03;
      meshRef.current.material.emissiveIntensity = 0.3 + pulse;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={atom.position}
      scale={hovered ? 1.15 : 1}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(atom);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover?.(null);
      }}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.25}
        metalness={atom.element === 'C' ? 0.2 : 0.4}
        emissive={atom.element === 'O' ? '#ff2222' : atom.element === 'H' ? '#ffffff' : '#000000'}
        emissiveIntensity={atom.element === 'O' ? 0.3 : 0.05}
      />
    </mesh>
  );
}

// 化学键 - 圆柱体连接两个原子
function BondMesh({ from, to }) {
  const { position, rotation, length } = useMemo(() => {
    const fromVec = new THREE.Vector3(...from);
    const toVec = new THREE.Vector3(...to);
    const mid = new THREE.Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(toVec, fromVec);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return {
      position: [mid.x, mid.y, mid.z],
      rotation: [euler.x, euler.y, euler.z],
      length: len,
    };
  }, [from, to]);

  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[0.08, 0.08, length, 12]} />
      <meshStandardMaterial color="#888888" metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

// 分子场景 - 组合原子+化学键,自动旋转+浮动
function MoleculeScene({ molecule, autoRotate = true }) {
  const groupRef = useRef();

  const atomMap = useMemo(() => {
    const map = {};
    molecule.atoms.forEach((a) => {
      map[a.id] = a.position;
    });
    return map;
  }, [molecule]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (autoRotate) {
      groupRef.current.rotation.y += delta * 0.3;
    }
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
  });

  return (
    <group ref={groupRef}>
      {molecule.bonds.map((bond, i) => (
        <BondMesh key={`bond-${i}`} from={atomMap[bond.from]} to={atomMap[bond.to]} />
      ))}
      {molecule.atoms.map((atom) => (
        <AtomMesh key={atom.id} atom={atom} />
      ))}
    </group>
  );
}

// ========================================
// 主组件
// ========================================

export default function MoleculeViewer({
  moleculeKey = 'ethanol',
  height = 400,
  autoRotate = true,
  showInfo = true,
}) {
  const molecule = getMolecule(moleculeKey);
  const [hoveredAtom, setHoveredAtom] = useState(null);

  return (
    <div className="molecule-viewer" style={{ height }}>
      <Canvas
        camera={{ position: [0, 0.5, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        {/* 三色点光源:金+紫+蓝 */}
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffd700" />
        <pointLight position={[-5, 3, -3]} intensity={0.6} color="#a855f7" />
        <pointLight position={[0, -3, 3]} intensity={0.4} color="#4488ff" />

        <Suspense fallback={null}>
          <MoleculeScene molecule={molecule} autoRotate={autoRotate} />
        </Suspense>

        <OrbitControls enablePan={false} minDistance={3} maxDistance={10} />
      </Canvas>

      {showInfo && (
        <div className="molecule-info-panel">
          <div className="molecule-formula">{molecule.formula}</div>
          <div className="molecule-name">{molecule.name}</div>
          <div className="molecule-desc">{molecule.desc}</div>
          <div className="molecule-meta">
            <span className="meta-label">风味</span>
            <span className="meta-value">{molecule.flavor}</span>
          </div>
          <div className="molecule-meta">
            <span className="meta-label">关联基酒</span>
            <span className="meta-value">{molecule.relatedSpirit}</span>
          </div>
          {hoveredAtom && (
            <div className="atom-tooltip">
              元素 {hoveredAtom.element} · 坐标 [
              {hoveredAtom.position.map((n) => n.toFixed(1)).join(', ')}]
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { MOLECULES, ELEMENT_COLORS, getMolecule };
