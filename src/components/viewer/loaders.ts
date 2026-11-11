import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

export interface ModelStats {
  triangleCount: number;
  vertexCount: number;
  bbox: {
    width: number; // X (mm)
    depth: number; // Y (mm)
    height: number; // Z (mm)
  };
  volumeCm3: number;
  colors: string[];
  hasColors: boolean;
}

export interface Loaded3DModel {
  root: THREE.Group;
  stats: ModelStats;
}

/**
 * Calculates volume of a closed triangle mesh using signed tetrahedron sum.
 * Uses zero-allocation raw typed-array scalar triple product for maximum speed.
 */
function calculateMeshVolume(geometry: THREE.BufferGeometry): number {
  let volume = 0;
  const pos = geometry.attributes.position;
  if (!pos) return 0;

  const array = pos.array;

  if (geometry.index) {
    const indices = geometry.index.array;
    const indexCount = geometry.index.count;
    for (let i = 0; i < indexCount; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;

      const x1 = array[i1], y1 = array[i1 + 1], z1 = array[i1 + 2];
      const x2 = array[i2], y2 = array[i2 + 1], z2 = array[i2 + 2];
      const x3 = array[i3], y3 = array[i3 + 1], z3 = array[i3 + 2];

      volume += (x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3)) / 6.0;
    }
  } else {
    const end = pos.count * 3;
    for (let i = 0; i < end; i += 9) {
      const x1 = array[i], y1 = array[i + 1], z1 = array[i + 2];
      const x2 = array[i + 3], y2 = array[i + 4], z2 = array[i + 5];
      const x3 = array[i + 6], y3 = array[i + 7], z3 = array[i + 8];

      volume += (x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3)) / 6.0;
    }
  }

  return Math.abs(volume);
}

/**
 * Extracts dimensional statistics, triangle counts, and detected colors from a 3D hierarchy.
 */
export function extractStatsAndNormalize(root: THREE.Group): ModelStats {
  let triangleCount = 0;
  let vertexCount = 0;
  let totalVolumeMm3 = 0;
  const colorSet = new Set<string>();

  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geom = child.geometry;
      if (geom) {
        const pos = geom.attributes.position;
        if (pos) {
          vertexCount += pos.count;
          if (geom.index) {
            triangleCount += geom.index.count / 3;
          } else {
            triangleCount += pos.count / 3;
          }
        }
        totalVolumeMm3 += calculateMeshVolume(geom);
      }

      // Collect materials and colors
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat) continue;
        if ("color" in mat && mat.color instanceof THREE.Color) {
          colorSet.add("#" + mat.color.getHexString());
        }
        if (mat.vertexColors) {
          colorSet.add("vertex-colors");
        }
      }
    }
  });

  // Compute bounding box
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Re-center object at origin and ground its bottom at y = 0
  root.position.x -= center.x;
  root.position.y -= box.min.y;
  root.position.z -= center.z;

  const colors = Array.from(colorSet);

  return {
    triangleCount: Math.round(triangleCount),
    vertexCount,
    bbox: {
      width: Number(size.x.toFixed(2)),
      depth: Number(size.z.toFixed(2)),
      height: Number(size.y.toFixed(2)),
    },
    volumeCm3: Number((totalVolumeMm3 / 1000.0).toFixed(2)),
    colors,
    hasColors: colors.length > 1 || colors.includes("vertex-colors"),
  };
}

/**
 * Loads an STL file from an ArrayBuffer.
 */
export function loadSTLModel(buffer: ArrayBuffer, defaultColor = 0x38bdf8): Loaded3DModel {
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();

  const hasVertexColors = (geometry as unknown as { hasColors?: boolean }).hasColors;
  const material = new THREE.MeshStandardMaterial({
    color: hasVertexColors ? 0xffffff : defaultColor,
    vertexColors: !!hasVertexColors,
    roughness: 0.35,
    metalness: 0.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const root = new THREE.Group();
  root.add(mesh);

  const stats = extractStatsAndNormalize(root);
  return { root, stats };
}

/**
 * Loads a 3MF file with full color fidelity from an ArrayBuffer.
 */
export function load3MFModel(buffer: ArrayBuffer): Loaded3DModel {
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);

  // Modernize materials to MeshStandardMaterial with shadows and smooth lighting
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const newMats = mats.map((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.roughness = 0.4;
            mat.metalness = 0.1;
            return mat;
          }

          // Convert Phong/Basic to Standard preserving color and vertex color settings
          const color = mat.color ? mat.color.clone() : new THREE.Color(0xd1d5db);
          return new THREE.MeshStandardMaterial({
            color,
            vertexColors: !!mat.vertexColors,
            roughness: 0.4,
            metalness: 0.1,
            map: mat.map || null,
          });
        });

        child.material = Array.isArray(child.material) ? newMats : newMats[0];
      }
    }
  });

  const stats = extractStatsAndNormalize(group);
  return { root: group, stats };
}
