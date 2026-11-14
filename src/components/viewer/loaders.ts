import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";

export interface FilamentSlotInfo {
  slot: number; // 1-based extruder/filament slot
  color: string; // #RRGGBB
  type?: string; // e.g. "PLA", "PETG"
  active?: boolean;
}

export interface ModelStats {
  triangleCount: number;
  vertexCount: number;
  bbox: {
    width: number; // X (mm)
    depth: number; // Y (mm, mapped to Three.js Z)
    height: number; // Z (mm, mapped to Three.js Y)
  };
  volumeCm3: number;
  colors: string[];
  hasColors: boolean;
  filaments?: FilamentSlotInfo[];
  partCount?: number;
}

export interface Loaded3DModel {
  root: THREE.Group;
  stats: ModelStats;
}

const UNIT_TO_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1.0,
  centimeter: 10.0,
  inch: 25.4,
  foot: 304.8,
  meter: 1000.0,
};

const SKIPPED_SUBTYPES = new Set([
  "negative_part",
  "modifier_part",
  "support_blocker",
  "support_enforcer",
]);

const DEFAULT_MODEL_HEX = "#d1d5db";

function normalizeHexColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

function getDirectChildrenByTag(parent: Element, localName: string): Element[] {
  const out: Element[] = [];
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if ((child.localName || child.nodeName.split(":").pop()) === localName) {
      out.push(child);
    }
  }
  return out;
}

function getFirstDirectChildByTag(parent: Element, localName: string): Element | null {
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if ((child.localName || child.nodeName.split(":").pop()) === localName) {
      return child;
    }
  }
  return null;
}

function normalizeArchivePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

function parse3MFTransform(transformStr: string | null): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (!transformStr) return m;
  const parts = transformStr.trim().split(/\s+/).map(Number);
  if (parts.length !== 12 || parts.some((n) => Number.isNaN(n))) return m;
  m.set(
    parts[0], parts[3], parts[6], parts[9],
    parts[1], parts[4], parts[7], parts[10],
    parts[2], parts[5], parts[8], parts[11],
    0.0, 0.0, 0.0, 1.0
  );
  return m;
}

function scaleMatrixTranslation(matrix: THREE.Matrix4, scale: number): THREE.Matrix4 {
  if (scale === 1.0) return matrix.clone();
  const out = matrix.clone();
  const e = out.elements;
  e[12] *= scale;
  e[13] *= scale;
  e[14] *= scale;
  return out;
}

/**
 * Calculates volume of a triangle mesh using signed tetrahedron sum.
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
 * Re-centers an object at X=0, Z=0 and grounds its bottom at Y=0.
 * Returns updated millimeter bounding dimensions.
 */
export function recenterAndGroundObject(root: THREE.Object3D): ModelStats["bbox"] {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) {
    return { width: 0, depth: 0, height: 0 };
  }

  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  root.position.x -= center.x;
  root.position.y -= box.min.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);

  return {
    width: Number(size.x.toFixed(2)),
    depth: Number(size.z.toFixed(2)),
    height: Number(size.y.toFixed(2)),
  };
}

/**
 * Extracts dimensional statistics, triangle counts, and detected colors from a 3D hierarchy.
 */
export function extractStatsAndNormalize(
  root: THREE.Group,
  extra?: {
    overrideColors?: string[];
    filaments?: FilamentSlotInfo[];
    partCount?: number;
  }
): ModelStats {
  let triangleCount = 0;
  let vertexCount = 0;
  let totalVolumeMm3 = 0;
  const colorSet = new Set<string>(extra?.overrideColors ?? []);
  let hasVertexColoredMesh = false;

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

      if (!extra?.overrideColors?.length) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (!mat) continue;
          if (mat.vertexColors) {
            hasVertexColoredMesh = true;
          } else if ("color" in mat && mat.color instanceof THREE.Color) {
            colorSet.add("#" + mat.color.getHexString());
          }
        }
      }
    }
  });

  const bbox = recenterAndGroundObject(root);
  const colors = Array.from(colorSet);
  if (colors.length === 0 && hasVertexColoredMesh) {
    colors.push("vertex-colors");
  }

  return {
    triangleCount: Math.round(triangleCount),
    vertexCount,
    bbox,
    volumeCm3: Number((totalVolumeMm3 / 1000.0).toFixed(2)),
    colors,
    hasColors: colors.length > 1 || colors.includes("vertex-colors"),
    filaments: extra?.filaments,
    partCount: extra?.partCount,
  };
}

/**
 * Loads an STL file from an ArrayBuffer, applying CAD Z-up -> Three.js Y-up orientation.
 */
export function loadSTLModel(buffer: ArrayBuffer, defaultColor = 0x38bdf8): Loaded3DModel {
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();

  const hasVertexColors = !!(geometry as unknown as { hasColors?: boolean }).hasColors;
  const material = new THREE.MeshStandardMaterial({
    color: hasVertexColors ? 0xffffff : defaultColor,
    vertexColors: hasVertexColors,
    roughness: 0.35,
    metalness: 0.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // STL coordinates follow CAD/slicer Z-up; rotate -90° around X into Three.js Y-up
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData = {
    originalColor: "#" + material.color.getHexString(),
    originalVertexColors: hasVertexColors,
  };

  const root = new THREE.Group();
  root.add(mesh);

  const stats = extractStatsAndNormalize(root, { partCount: 1 });
  return { root, stats };
}

// ============================================================================
// Slicer-Aware 3MF Parsing (Production Extension, Filaments, Paint Tree)
// ============================================================================

interface ParsedFilamentProfile {
  colorsBySlot: Map<number, string>;
  typesBySlot: Map<number, string>;
}

interface PartSetting {
  name?: string;
  subtype?: string;
  extruder?: number;
}

interface ObjectSetting {
  name?: string;
  extruder?: number;
  parts: Map<string, PartSetting>;
}

interface Parsed3MFModelDoc {
  path: string;
  unitScale: number;
  baseMaterials: Map<string, string[]>;
  colorGroups: Map<string, string[]>;
  hasTextures: boolean;
  objects: Map<string, Parsed3MFObject>;
  buildItems: Array<{ objectId: string; transform: THREE.Matrix4 }>;
}

interface Parsed3MFObject {
  id: string;
  name?: string;
  type?: string;
  pid?: string;
  pindex?: number;
  mesh?: {
    vertices: Float32Array;
    triangles: Element[];
  };
  components: Array<{
    path: string;
    objectId: string;
    transform: THREE.Matrix4;
  }>;
}

function parseFilamentProfile(
  zip: Record<string, Uint8Array>,
  textDecoder: TextDecoder
): ParsedFilamentProfile {
  const colorsBySlot = new Map<number, string>();
  const typesBySlot = new Map<number, string>();

  // 1. Bambu Studio / OrcaSlicer JSON project settings
  const projBytes = zip["Metadata/project_settings.config"];
  if (projBytes) {
    try {
      const json = JSON.parse(textDecoder.decode(projBytes)) as Record<string, unknown>;
      const rawColors = Array.isArray(json.filament_colour)
        ? json.filament_colour
        : typeof json.filament_colour === "string"
        ? json.filament_colour.split(/[;,]/)
        : [];
      rawColors.forEach((val, idx) => {
        if (typeof val === "string") {
          const hex = normalizeHexColor(val);
          if (hex) colorsBySlot.set(idx + 1, hex);
        }
      });

      const rawTypes = Array.isArray(json.filament_type)
        ? json.filament_type
        : typeof json.filament_type === "string"
        ? json.filament_type.split(/[;,]/)
        : [];
      rawTypes.forEach((val, idx) => {
        if (typeof val === "string" && val.trim()) {
          typesBySlot.set(idx + 1, val.trim());
        }
      });
    } catch {
      // Ignore malformed JSON metadata and fall back to other config sources
    }
  }

  // 2. Bambu Studio slice_info.config (1-based <filament id="N" color="#..." type="..." />)
  const sliceBytes = zip["Metadata/slice_info.config"];
  if (sliceBytes) {
    try {
      const doc = new DOMParser().parseFromString(textDecoder.decode(sliceBytes), "application/xml");
      const filamentEls = doc.getElementsByTagName("filament");
      for (let i = 0; i < filamentEls.length; i++) {
        const el = filamentEls[i];
        const slot = parseInt(el.getAttribute("id") || "", 10);
        if (!Number.isFinite(slot) || slot <= 0) continue;
        const hex = normalizeHexColor(el.getAttribute("color"));
        if (hex && !colorsBySlot.has(slot)) {
          colorsBySlot.set(slot, hex);
        }
        const fType = el.getAttribute("type")?.trim();
        if (fType && !typesBySlot.has(slot)) {
          typesBySlot.set(slot, fType);
        }
      }
    } catch {
      // Ignore malformed XML
    }
  }

  // 3. PrusaSlicer / Slic3r PE INI config fallback
  for (const iniName of ["Metadata/Slic3r_pe.config", "Metadata/PrusaSlicer.config"]) {
    const iniBytes = zip[iniName];
    if (!iniBytes) continue;
    const text = textDecoder.decode(iniBytes);
    const colorMatch = text.match(/^;?\s*(?:extruder_colour|filament_colour)\s*=\s*(.+)$/m);
    if (colorMatch) {
      colorMatch[1].split(/[;,]/).forEach((val, idx) => {
        const hex = normalizeHexColor(val);
        if (hex && !colorsBySlot.has(idx + 1)) {
          colorsBySlot.set(idx + 1, hex);
        }
      });
    }
    const typeMatch = text.match(/^;?\s*filament_type\s*=\s*(.+)$/m);
    if (typeMatch) {
      typeMatch[1].split(/[;,]/).forEach((val, idx) => {
        if (val.trim() && !typesBySlot.has(idx + 1)) {
          typesBySlot.set(idx + 1, val.trim());
        }
      });
    }
  }

  return { colorsBySlot, typesBySlot };
}

function parseModelSettings(
  zip: Record<string, Uint8Array>,
  textDecoder: TextDecoder
): Map<string, ObjectSetting> {
  const settings = new Map<string, ObjectSetting>();

  const modelSettingsBytes = zip["Metadata/model_settings.config"];
  if (modelSettingsBytes) {
    try {
      const doc = new DOMParser().parseFromString(
        textDecoder.decode(modelSettingsBytes),
        "application/xml"
      );
      const objEls = doc.getElementsByTagName("object");
      for (let i = 0; i < objEls.length; i++) {
        const objEl = objEls[i];
        const oid = objEl.getAttribute("id");
        if (!oid) continue;

        const objSetting: ObjectSetting = { parts: new Map() };
        for (const meta of getDirectChildrenByTag(objEl, "metadata")) {
          const key = meta.getAttribute("key");
          const val = meta.getAttribute("value");
          if (key === "name" && val) objSetting.name = val;
          if (key === "extruder" && val) {
            const parsed = parseInt(val, 10);
            if (Number.isFinite(parsed) && parsed > 0) objSetting.extruder = parsed;
          }
        }

        for (const partEl of getDirectChildrenByTag(objEl, "part")) {
          const pid = partEl.getAttribute("id");
          if (!pid) continue;
          const partSetting: PartSetting = {
            subtype: partEl.getAttribute("subtype") || undefined,
          };
          for (const meta of getDirectChildrenByTag(partEl, "metadata")) {
            const key = meta.getAttribute("key");
            const val = meta.getAttribute("value");
            if (key === "name" && val) partSetting.name = val;
            if (key === "extruder" && val) {
              const parsed = parseInt(val, 10);
              if (Number.isFinite(parsed) && parsed > 0) partSetting.extruder = parsed;
            }
          }
          objSetting.parts.set(pid, partSetting);
        }

        settings.set(oid, objSetting);
      }
    } catch {
      // Ignore malformed XML
    }
  }

  // PrusaSlicer Slic3r_pe_model.config fallback for object-level extruder
  const prusaModelBytes = zip["Metadata/Slic3r_pe_model.config"];
  if (prusaModelBytes && settings.size === 0) {
    try {
      const doc = new DOMParser().parseFromString(
        textDecoder.decode(prusaModelBytes),
        "application/xml"
      );
      const objEls = doc.getElementsByTagName("object");
      for (let i = 0; i < objEls.length; i++) {
        const objEl = objEls[i];
        const oid = objEl.getAttribute("id");
        if (!oid) continue;
        const objSetting: ObjectSetting = { parts: new Map() };
        for (const meta of getDirectChildrenByTag(objEl, "metadata")) {
          if (meta.getAttribute("key") === "extruder") {
            const parsed = parseInt(meta.getAttribute("value") || "", 10);
            if (Number.isFinite(parsed) && parsed > 0) objSetting.extruder = parsed;
          }
        }
        const volEl = getFirstDirectChildByTag(objEl, "volume");
        if (volEl && !objSetting.extruder) {
          for (const meta of getDirectChildrenByTag(volEl, "metadata")) {
            if (meta.getAttribute("key") === "extruder") {
              const parsed = parseInt(meta.getAttribute("value") || "", 10);
              if (Number.isFinite(parsed) && parsed > 0) objSetting.extruder = parsed;
            }
          }
        }
        settings.set(oid, objSetting);
      }
    } catch {
      // Ignore malformed XML
    }
  }

  return settings;
}

function parse3MFModelXml(modelPath: string, xmlText: string): Parsed3MFModelDoc | null {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const modelEl = doc.documentElement;
  if (!modelEl || (modelEl.localName || modelEl.nodeName.split(":").pop())?.toLowerCase() !== "model") {
    return null;
  }

  const unitAttr = (modelEl.getAttribute("unit") || "millimeter").toLowerCase();
  const unitScale = UNIT_TO_MM[unitAttr] ?? 1.0;

  const baseMaterials = new Map<string, string[]>();
  const colorGroups = new Map<string, string[]>();
  const objects = new Map<string, Parsed3MFObject>();
  const buildItems: Array<{ objectId: string; transform: THREE.Matrix4 }> = [];
  let hasTextures = false;

  const resourcesEl = getFirstDirectChildByTag(modelEl, "resources");
  if (resourcesEl) {
    for (const child of Array.from(resourcesEl.children)) {
      const tag = (child.localName || child.nodeName.split(":").pop())?.toLowerCase();
      if (tag === "basematerials") {
        const id = child.getAttribute("id");
        if (!id) continue;
        const colors: string[] = [];
        for (const baseEl of getDirectChildrenByTag(child, "base")) {
          colors.push(normalizeHexColor(baseEl.getAttribute("displaycolor")) || DEFAULT_MODEL_HEX);
        }
        baseMaterials.set(id, colors);
      } else if (tag === "colorgroup") {
        const id = child.getAttribute("id");
        if (!id) continue;
        const colors: string[] = [];
        for (const colEl of getDirectChildrenByTag(child, "color")) {
          colors.push(normalizeHexColor(colEl.getAttribute("color")) || DEFAULT_MODEL_HEX);
        }
        colorGroups.set(id, colors);
      } else if (tag === "texture2d" || tag === "texture2dgroup") {
        hasTextures = true;
      } else if (tag === "object") {
        const id = child.getAttribute("id");
        if (!id) continue;
        const pindexAttr = child.getAttribute("pindex");
        const parsedObj: Parsed3MFObject = {
          id,
          name: child.getAttribute("name") || undefined,
          type: child.getAttribute("type") || undefined,
          pid: child.getAttribute("pid") || undefined,
          pindex: pindexAttr !== null ? parseInt(pindexAttr, 10) : undefined,
          components: [],
        };

        const meshEl = getFirstDirectChildByTag(child, "mesh");
        if (meshEl) {
          const vertsEl = getFirstDirectChildByTag(meshEl, "vertices");
          const trisEl = getFirstDirectChildByTag(meshEl, "triangles");
          if (vertsEl && trisEl) {
            const vChildren = vertsEl.children;
            const vertices = new Float32Array(vChildren.length * 3);
            for (let vi = 0; vi < vChildren.length; vi++) {
              const vEl = vChildren[vi];
              vertices[vi * 3] = parseFloat(vEl.getAttribute("x") || "0");
              vertices[vi * 3 + 1] = parseFloat(vEl.getAttribute("y") || "0");
              vertices[vi * 3 + 2] = parseFloat(vEl.getAttribute("z") || "0");
            }
            parsedObj.mesh = {
              vertices,
              triangles: Array.from(trisEl.children),
            };
          }
        }

        const compsEl = getFirstDirectChildByTag(child, "components");
        if (compsEl) {
          for (const compEl of getDirectChildrenByTag(compsEl, "component")) {
            const compObjId = compEl.getAttribute("objectid");
            if (!compObjId) continue;
            const rawPath =
              compEl.getAttribute("p:path") ||
              compEl.getAttributeNS("http://schemas.microsoft.com/3dmanufacturing/production/2015/06", "path") ||
              compEl.getAttribute("path");
            const compPath = rawPath ? normalizeArchivePath(rawPath) : modelPath;
            parsedObj.components.push({
              path: compPath,
              objectId: compObjId,
              transform: parse3MFTransform(compEl.getAttribute("transform")),
            });
          }
        }

        objects.set(id, parsedObj);
      }
    }
  }

  const buildEl = getFirstDirectChildByTag(modelEl, "build");
  if (buildEl) {
    for (const itemEl of getDirectChildrenByTag(buildEl, "item")) {
      const objectId = itemEl.getAttribute("objectid");
      if (!objectId) continue;
      buildItems.push({
        objectId,
        transform: parse3MFTransform(itemEl.getAttribute("transform")),
      });
    }
  }

  return {
    path: modelPath,
    unitScale,
    baseMaterials,
    colorGroups,
    hasTextures,
    objects,
    buildItems,
  };
}

/**
 * Decodes PrusaSlicer / Bambu Studio / OrcaSlicer `TriangleSelector` nibble bitstream
 * (`paint_color` or `slic3rpe:mmu_segmentation`) into subdivided sub-triangles and
 * 1-based extruder indices.
 */
function decodePaintTriangle(
  hexStr: string,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  defaultExtruder: number,
  outPositions: number[],
  outExtruders: number[]
): void {
  let pos = hexStr.length - 1;
  const nextNibble = (): number => {
    if (pos < 0) return 0;
    const val = parseInt(hexStr[pos], 16);
    pos--;
    return Number.isNaN(val) ? 0 : val;
  };

  const visit = (
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): void => {
    const code = nextNibble();
    const numSplit = code & 0b11;

    if (numSplit === 0) {
      let state = 0;
      if ((code & 0b1100) === 0b1100) {
        let nextCode = nextNibble();
        let num = 0;
        while (nextCode === 0b1111 && pos >= 0) {
          num++;
          nextCode = nextNibble();
        }
        state = nextCode + 15 * num + 3;
      } else {
        state = code >> 2;
      }
      const resolvedExtruder = state > 0 ? state : defaultExtruder;
      outPositions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
      outExtruders.push(resolvedExtruder);
      return;
    }

    const specialSide = (code >> 2) & 0b11;
    let ux0: number, uy0: number, uz0: number;
    let ux1: number, uy1: number, uz1: number;
    let ux2: number, uy2: number, uz2: number;

    if (specialSide === 1) {
      ux0 = x1; uy0 = y1; uz0 = z1;
      ux1 = x2; uy1 = y2; uz1 = z2;
      ux2 = x0; uy2 = y0; uz2 = z0;
    } else if (specialSide === 2) {
      ux0 = x2; uy0 = y2; uz0 = z2;
      ux1 = x0; uy1 = y0; uz1 = z0;
      ux2 = x1; uy2 = y1; uz2 = z1;
    } else {
      ux0 = x0; uy0 = y0; uz0 = z0;
      ux1 = x1; uy1 = y1; uz1 = z1;
      ux2 = x2; uy2 = y2; uz2 = z2;
    }

    // TriangleSelector::deserialize traverses children from total_children - 1 down to 0
    if (numSplit === 1) {
      const mx12 = (ux1 + ux2) * 0.5;
      const my12 = (uy1 + uy2) * 0.5;
      const mz12 = (uz1 + uz2) * 0.5;
      // child 1 then child 0
      visit(mx12, my12, mz12, ux2, uy2, uz2, ux0, uy0, uz0);
      visit(ux0, uy0, uz0, ux1, uy1, uz1, mx12, my12, mz12);
    } else if (numSplit === 2) {
      const mx01 = (ux0 + ux1) * 0.5;
      const my01 = (uy0 + uy1) * 0.5;
      const mz01 = (uz0 + uz1) * 0.5;
      const mx20 = (ux2 + ux0) * 0.5;
      const my20 = (uy2 + uy0) * 0.5;
      const mz20 = (uz2 + uz0) * 0.5;
      // child 2, child 1, child 0
      visit(ux1, uy1, uz1, ux2, uy2, uz2, mx20, my20, mz20);
      visit(mx01, my01, mz01, ux1, uy1, uz1, mx20, my20, mz20);
      visit(ux0, uy0, uz0, mx01, my01, mz01, mx20, my20, mz20);
    } else {
      const mx01 = (ux0 + ux1) * 0.5;
      const my01 = (uy0 + uy1) * 0.5;
      const mz01 = (uz0 + uz1) * 0.5;
      const mx12 = (ux1 + ux2) * 0.5;
      const my12 = (uy1 + uy2) * 0.5;
      const mz12 = (uz1 + uz2) * 0.5;
      const mx20 = (ux2 + ux0) * 0.5;
      const my20 = (uy2 + uy0) * 0.5;
      const mz20 = (uz2 + uz0) * 0.5;
      // child 3, child 2, child 1, child 0
      visit(mx01, my01, mz01, mx12, my12, mz12, mx20, my20, mz20);
      visit(mx12, my12, mz12, ux2, uy2, uz2, mx20, my20, mz20);
      visit(mx01, my01, mz01, ux1, uy1, uz1, mx12, my12, mz12);
      visit(ux0, uy0, uz0, mx01, my01, mz01, mx20, my20, mz20);
    }
  };

  visit(ax, ay, az, bx, by, bz, cx, cy, cz);
}

function getOrConvertColor(
  hex: string,
  cache: Map<string, THREE.Color>
): THREE.Color {
  let c = cache.get(hex);
  if (!c) {
    c = new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
    cache.set(hex, c);
  }
  return c;
}

function buildSlicer3MFMesh(
  obj: Parsed3MFObject,
  doc: Parsed3MFModelDoc,
  worldMatrix: THREE.Matrix4,
  defaultExtruder: number,
  profile: ParsedFilamentProfile,
  usedSlots: Set<number>,
  usedColors: Set<string>,
  colorCache: Map<string, THREE.Color>
): THREE.Mesh | null {
  if (!obj.mesh) return null;
  const { vertices, triangles } = obj.mesh;
  if (vertices.length === 0 || triangles.length === 0) return null;

  // Check for painted faces or standard 3MF multi-material / vertex-color references
  let hasPaintAttr = false;
  let hasStandardMultiColor = false;
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    if (tri.getAttribute("paint_color") || tri.getAttribute("slic3rpe:mmu_segmentation")) {
      hasPaintAttr = true;
      break;
    }
    if (tri.getAttribute("pid") || tri.getAttribute("p1") || tri.getAttribute("p2") || tri.getAttribute("p3")) {
      hasStandardMultiColor = true;
    }
  }
  if (!hasStandardMultiColor && obj.pid) {
    hasStandardMultiColor = true;
  }

  const flipWinding = worldMatrix.determinant() < 0;
  const te = worldMatrix.elements;
  const vertexCount = vertices.length / 3;

  // Pre-transform all vertices into world 3MF millimeter space
  const transformedVerts = new Float32Array(vertices.length);
  for (let i = 0; i < vertexCount; i++) {
    const ix = i * 3;
    const x = vertices[ix];
    const y = vertices[ix + 1];
    const z = vertices[ix + 2];
    transformedVerts[ix] = te[0] * x + te[4] * y + te[8] * z + te[12];
    transformedVerts[ix + 1] = te[1] * x + te[5] * y + te[9] * z + te[13];
    transformedVerts[ix + 2] = te[2] * x + te[6] * y + te[10] * z + te[14];
  }

  const resolveExtruderHex = (slot: number): string => {
    const profileHex = profile.colorsBySlot.get(slot);
    if (profileHex) {
      usedSlots.add(slot);
      return profileHex;
    }
    const firstProfileHex = profile.colorsBySlot.get(1) || profile.colorsBySlot.values().next().value;
    if (firstProfileHex) {
      return firstProfileHex;
    }
    return DEFAULT_MODEL_HEX;
  };

  // Fast path: uniform single-material mesh (no paint_color and no multi-color pid)
  if (!hasPaintAttr && !hasStandardMultiColor) {
    const indices = new Uint32Array(triangles.length * 3);
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i];
      const v1 = parseInt(tri.getAttribute("v1") || "0", 10);
      const v2 = parseInt(tri.getAttribute("v2") || "0", 10);
      const v3 = parseInt(tri.getAttribute("v3") || "0", 10);
      const base = i * 3;
      if (flipWinding) {
        indices[base] = v1;
        indices[base + 1] = v3;
        indices[base + 2] = v2;
      } else {
        indices[base] = v1;
        indices[base + 1] = v2;
        indices[base + 2] = v3;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(transformedVerts, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    const hex = resolveExtruderHex(defaultExtruder);
    usedColors.add(hex);

    const material = new THREE.MeshStandardMaterial({
      color: getOrConvertColor(hex, colorCache).clone(),
      roughness: 0.38,
      metalness: 0.1,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = obj.name || `object_${obj.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      originalColor: hex,
      originalVertexColors: false,
    };
    return mesh;
  }

  // Painted / Multi-color path: expand triangles (with TriangleSelector subdivision when needed)
  const fixedPositions = hasPaintAttr ? null : new Float32Array(triangles.length * 9);
  const fixedColors = hasPaintAttr ? null : new Float32Array(triangles.length * 9);
  let fixedPosCursor = 0;
  let fixedColCursor = 0;

  const outPositions: number[] = [];
  const outColors: number[] = [];
  const subPositions: number[] = [];
  const subExtruders: number[] = [];

  const pushPosTri = (
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    x3: number, y3: number, z3: number
  ) => {
    if (fixedPositions) {
      fixedPositions[fixedPosCursor++] = x1;
      fixedPositions[fixedPosCursor++] = y1;
      fixedPositions[fixedPosCursor++] = z1;
      fixedPositions[fixedPosCursor++] = x2;
      fixedPositions[fixedPosCursor++] = y2;
      fixedPositions[fixedPosCursor++] = z2;
      fixedPositions[fixedPosCursor++] = x3;
      fixedPositions[fixedPosCursor++] = y3;
      fixedPositions[fixedPosCursor++] = z3;
    } else {
      outPositions.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
    }
  };

  const pushColorTri = (c1: THREE.Color, c2: THREE.Color, c3: THREE.Color) => {
    if (fixedColors) {
      fixedColors[fixedColCursor++] = c1.r;
      fixedColors[fixedColCursor++] = c1.g;
      fixedColors[fixedColCursor++] = c1.b;
      fixedColors[fixedColCursor++] = c2.r;
      fixedColors[fixedColCursor++] = c2.g;
      fixedColors[fixedColCursor++] = c2.b;
      fixedColors[fixedColCursor++] = c3.r;
      fixedColors[fixedColCursor++] = c3.g;
      fixedColors[fixedColCursor++] = c3.b;
    } else {
      outColors.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b, c3.r, c3.g, c3.b);
    }
  };

  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const v1 = parseInt(tri.getAttribute("v1") || "0", 10) * 3;
    const v2 = parseInt(tri.getAttribute("v2") || "0", 10) * 3;
    const v3 = parseInt(tri.getAttribute("v3") || "0", 10) * 3;

    const ax = transformedVerts[v1], ay = transformedVerts[v1 + 1], az = transformedVerts[v1 + 2];
    const bx = transformedVerts[v2], by = transformedVerts[v2 + 1], bz = transformedVerts[v2 + 2];
    const cx = transformedVerts[v3], cy = transformedVerts[v3 + 1], cz = transformedVerts[v3 + 2];

    const paintAttr =
      tri.getAttribute("paint_color") || tri.getAttribute("slic3rpe:mmu_segmentation");

    if (paintAttr) {
      subPositions.length = 0;
      subExtruders.length = 0;
      if (flipWinding) {
        decodePaintTriangle(
          paintAttr,
          ax, ay, az, cx, cy, cz, bx, by, bz,
          defaultExtruder,
          subPositions,
          subExtruders
        );
      } else {
        decodePaintTriangle(
          paintAttr,
          ax, ay, az, bx, by, bz, cx, cy, cz,
          defaultExtruder,
          subPositions,
          subExtruders
        );
      }

      for (let si = 0; si < subExtruders.length; si++) {
        const pBase = si * 9;
        outPositions.push(
          subPositions[pBase], subPositions[pBase + 1], subPositions[pBase + 2],
          subPositions[pBase + 3], subPositions[pBase + 4], subPositions[pBase + 5],
          subPositions[pBase + 6], subPositions[pBase + 7], subPositions[pBase + 8]
        );
        const hex = resolveExtruderHex(subExtruders[si]);
        usedColors.add(hex);
        const col = getOrConvertColor(hex, colorCache);
        pushColorTri(col, col, col);
      }
      continue;
    }

    if (flipWinding) {
      pushPosTri(ax, ay, az, cx, cy, cz, bx, by, bz);
    } else {
      pushPosTri(ax, ay, az, bx, by, bz, cx, cy, cz);
    }

    const pid = tri.getAttribute("pid") || obj.pid;
    const p1Attr = tri.getAttribute("p1");
    const p2Attr = tri.getAttribute("p2");
    const p3Attr = tri.getAttribute("p3");
    const p1 = p1Attr !== null ? parseInt(p1Attr, 10) : obj.pindex;

    const colorGroup = pid ? doc.colorGroups.get(pid) : undefined;
    const baseMats = pid ? doc.baseMaterials.get(pid) : undefined;

    if (colorGroup && p1 !== undefined && colorGroup[p1]) {
      const p2 = p2Attr !== null ? parseInt(p2Attr, 10) : p1;
      const p3 = p3Attr !== null ? parseInt(p3Attr, 10) : p1;
      const h1 = colorGroup[p1] || DEFAULT_MODEL_HEX;
      const h2 = colorGroup[p2] || h1;
      const h3 = colorGroup[p3] || h1;
      usedColors.add(h1);
      usedColors.add(h2);
      usedColors.add(h3);
      const c1 = getOrConvertColor(h1, colorCache);
      const c2 = getOrConvertColor(h2, colorCache);
      const c3 = getOrConvertColor(h3, colorCache);
      if (flipWinding) {
        pushColorTri(c1, c3, c2);
      } else {
        pushColorTri(c1, c2, c3);
      }
    } else if (baseMats && p1 !== undefined && baseMats[p1]) {
      const hex = baseMats[p1];
      usedColors.add(hex);
      const col = getOrConvertColor(hex, colorCache);
      pushColorTri(col, col, col);
    } else {
      const hex = resolveExtruderHex(defaultExtruder);
      usedColors.add(hex);
      const col = getOrConvertColor(hex, colorCache);
      pushColorTri(col, col, col);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    fixedPositions
      ? new THREE.BufferAttribute(fixedPositions, 3)
      : new THREE.Float32BufferAttribute(outPositions, 3)
  );
  geometry.setAttribute(
    "color",
    fixedColors
      ? new THREE.BufferAttribute(fixedColors, 3)
      : new THREE.Float32BufferAttribute(outColors, 3)
  );
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.38,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = obj.name || `object_${obj.id}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    originalColor: "#ffffff",
    originalVertexColors: true,
  };
  return mesh;
}

function load3MFWithThreeFallback(buffer: ArrayBuffer): Loaded3DModel {
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);

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
        const firstMat = newMats[0];
        child.userData = {
          originalColor: "#" + firstMat.color.getHexString(),
          originalVertexColors: !!firstMat.vertexColors,
        };
      }
    }
  });

  const root = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  root.add(group);

  const stats = extractStatsAndNormalize(root);
  return { root, stats };
}

/**
 * Loads a 3MF file with slicer build-plate orientation, filament profile colors,
 * per-part extruder assignments, negative_part exclusion, and painted triangle decoding.
 */
export function load3MFModel(buffer: ArrayBuffer): Loaded3DModel {
  const zip = unzipSync(new Uint8Array(buffer));
  const textDecoder = new TextDecoder();

  const modelDocs = new Map<string, Parsed3MFModelDoc>();
  let rootModelPath: string | null = null;
  let anyTextures = false;

  for (const rawName of Object.keys(zip)) {
    const normName = normalizeArchivePath(rawName);
    if (!normName.toLowerCase().endsWith(".model")) continue;
    const xmlText = textDecoder.decode(zip[rawName]);
    const parsed = parse3MFModelXml(normName, xmlText);
    if (!parsed) continue;
    modelDocs.set(normName, parsed);
    if (parsed.hasTextures) anyTextures = true;
    if (/^3d\/[^/]+\.model$/i.test(normName)) {
      rootModelPath = normName;
    }
  }

  // Fallback to ThreeMFLoader if textured 3MF or no root model found
  if (!rootModelPath || anyTextures) {
    return load3MFWithThreeFallback(buffer);
  }

  const rootDoc = modelDocs.get(rootModelPath);
  if (!rootDoc) {
    return load3MFWithThreeFallback(buffer);
  }

  const profile = parseFilamentProfile(zip, textDecoder);
  const modelSettings = parseModelSettings(zip, textDecoder);

  const buildPlateGroup = new THREE.Group();
  // Convert 3MF Z-up build plate to Three.js Y-up floor
  buildPlateGroup.rotation.x = -Math.PI / 2;

  const usedSlots = new Set<number>();
  const usedColors = new Set<string>();
  const colorCache = new Map<string, THREE.Color>();
  let partCount = 0;

  const traverseObject = (
    docPath: string,
    objectId: string,
    parentMatrix: THREE.Matrix4,
    buildObjectId: string,
    inheritedExtruder: number,
    visiting: Set<string>
  ) => {
    const visitKey = `${docPath}#${objectId}`;
    if (visiting.has(visitKey)) return;

    const doc = modelDocs.get(docPath);
    if (!doc) return;
    const obj = doc.objects.get(objectId);
    if (!obj) return;

    const buildObjSetting = modelSettings.get(buildObjectId);
    const partSetting = buildObjSetting?.parts.get(objectId);

    if (partSetting?.subtype && SKIPPED_SUBTYPES.has(partSetting.subtype)) {
      return;
    }

    visiting.add(visitKey);
    try {
      const nextExtruder =
        partSetting?.extruder ?? buildObjSetting?.extruder ?? inheritedExtruder;

      if (obj.mesh) {
        const meshWorldMatrix =
          doc.unitScale !== 1.0
            ? parentMatrix
                .clone()
                .multiply(new THREE.Matrix4().makeScale(doc.unitScale, doc.unitScale, doc.unitScale))
            : parentMatrix;
        const mesh = buildSlicer3MFMesh(
          obj,
          doc,
          meshWorldMatrix,
          nextExtruder,
          profile,
          usedSlots,
          usedColors,
          colorCache
        );
        if (mesh) {
          buildPlateGroup.add(mesh);
          partCount++;
        }
      }

      for (const comp of obj.components) {
        const compMatrix = scaleMatrixTranslation(comp.transform, doc.unitScale);
        const nextMatrix = parentMatrix.clone().multiply(compMatrix);
        traverseObject(comp.path, comp.objectId, nextMatrix, buildObjectId, nextExtruder, visiting);
      }
    } finally {
      visiting.delete(visitKey);
    }
  };

  if (rootDoc.buildItems.length > 0) {
    for (const item of rootDoc.buildItems) {
      const itemMatrix = scaleMatrixTranslation(item.transform, rootDoc.unitScale);
      const objSetting = modelSettings.get(item.objectId);
      const defaultExtruder = objSetting?.extruder ?? 1;
      traverseObject(rootModelPath, item.objectId, itemMatrix, item.objectId, defaultExtruder, new Set());
    }
  } else {
    // Some CAD exporters omit <build> items; render top-level objects in rootDoc
    for (const [oid] of rootDoc.objects) {
      const objSetting = modelSettings.get(oid);
      traverseObject(rootModelPath, oid, new THREE.Matrix4(), oid, objSetting?.extruder ?? 1, new Set());
    }
  }

  if (partCount === 0) {
    return load3MFWithThreeFallback(buffer);
  }

  const root = new THREE.Group();
  root.add(buildPlateGroup);

  const filaments: FilamentSlotInfo[] = [];
  const allSlots = new Set<number>([...profile.colorsBySlot.keys(), ...usedSlots]);
  for (const slot of Array.from(allSlots).sort((a, b) => a - b)) {
    const color = profile.colorsBySlot.get(slot);
    if (!color) continue;
    filaments.push({
      slot,
      color,
      type: profile.typesBySlot.get(slot),
      active: usedSlots.has(slot),
    });
  }

  const stats = extractStatsAndNormalize(root, {
    overrideColors: Array.from(usedColors),
    filaments: filaments.length > 0 ? filaments : undefined,
    partCount,
  });

  return { root, stats };
}
