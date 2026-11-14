import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";

// Minimal DOMParser shim for Node so loaders.ts can parse 3MF XML without a browser.
before(() => {
  if (typeof globalThis.DOMParser !== "undefined") return;

  class NodeElement {
    private el: Element;
    constructor(el: Element) {
      this.el = el;
    }
    get nodeName(): string {
      return this.el.name;
    }
    get localName(): string {
      const idx = this.el.name.indexOf(":");
      return idx >= 0 ? this.el.name.slice(idx + 1) : this.el.name;
    }
    get children(): NodeElement[] {
      return (this.el.children || [])
        .filter((c): c is Element => c.type === "tag")
        .map((c) => new NodeElement(c));
    }
    getAttribute(name: string): string | null {
      return this.el.attribs && name in this.el.attribs ? this.el.attribs[name] : null;
    }
    getAttributeNS(_ns: string, local: string): string | null {
      if (!this.el.attribs) return null;
      for (const [k, v] of Object.entries(this.el.attribs)) {
        if (k === local || k.endsWith(`:${local}`)) return v;
      }
      return null;
    }
  }

  (globalThis as unknown as { DOMParser: unknown }).DOMParser = class {
    parseFromString(xml: string) {
      const doc = parseDocument(xml, { xmlMode: true });
      const rootEl = (doc.children || []).find((c: ChildNode): c is Element => c.type === "tag");
      const rootNode = rootEl ? new NodeElement(rootEl) : null;
      return {
        documentElement: rootNode,
        getElementsByTagName(tagName: string): NodeElement[] {
          const out: NodeElement[] = [];
          const target = tagName.toLowerCase();
          const walk = (node: NodeElement | null) => {
            if (!node) return;
            if (node.localName.toLowerCase() === target || node.nodeName.toLowerCase() === target) {
              out.push(node);
            }
            for (const c of node.children) walk(c);
          };
          walk(rootNode);
          return out;
        },
      };
    }
  };
});

async function make3mfBuffer(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

const BOX_MESH_XML = `
  <mesh>
    <vertices>
      <vertex x="0" y="0" z="0"/>
      <vertex x="1" y="0" z="0"/>
      <vertex x="1" y="1" z="0"/>
      <vertex x="0" y="1" z="0"/>
      <vertex x="0" y="0" z="1"/>
      <vertex x="1" y="0" z="1"/>
      <vertex x="1" y="1" z="1"/>
      <vertex x="0" y="1" z="1"/>
    </vertices>
    <triangles>
      <triangle v1="0" v2="2" v3="1"/>
      <triangle v1="0" v2="3" v3="2"/>
      <triangle v1="4" v2="5" v3="6"/>
      <triangle v1="4" v2="6" v3="7"/>
      <triangle v1="0" v2="1" v3="5"/>
      <triangle v1="0" v2="5" v3="4"/>
      <triangle v1="1" v2="2" v3="6"/>
      <triangle v1="1" v2="6" v3="5"/>
      <triangle v1="2" v2="3" v3="7"/>
      <triangle v1="2" v2="7" v3="6"/>
      <triangle v1="3" v2="0" v3="4"/>
      <triangle v1="3" v2="4" v3="7"/>
    </triangles>
  </mesh>
`;

test("load3MFModel applies unit='inch', filament profile colors, and Z-up -> Y-up grounding", async () => {
  const { load3MFModel } = await import("../src/components/viewer/loaders");
  const buf = await make3mfBuffer({
    "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
      <model unit="inch" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
        <resources>
          <object id="1" type="model">${BOX_MESH_XML}</object>
        </resources>
        <build><item objectid="1"/></build>
      </model>`,
    "Metadata/project_settings.config": JSON.stringify({
      filament_colour: ["#ff0000", "#00ff00"],
      filament_type: ["PLA", "PETG"],
    }),
    "Metadata/model_settings.config": `
      <config>
        <object id="1">
          <metadata key="extruder" value="2"/>
        </object>
      </config>`,
  });

  const loaded = load3MFModel(buf);
  assert.equal(loaded.stats.triangleCount, 12);
  assert.ok(Math.abs(loaded.stats.bbox.width - 25.4) < 0.05);
  assert.ok(Math.abs(loaded.stats.bbox.height - 25.4) < 0.05);
  assert.ok(Math.abs(loaded.stats.bbox.depth - 25.4) < 0.05);
  assert.ok(loaded.stats.colors.includes("#00ff00"));
  assert.equal(loaded.stats.filaments?.length, 2);
  assert.equal(loaded.stats.filaments?.[1]?.active, true);
});

test("load3MFModel decodes TriangleSelector paint_color and skips negative_part", async () => {
  const { load3MFModel } = await import("../src/components/viewer/loaders");
  const buf = await make3mfBuffer({
    "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
      <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
        <resources>
          <object id="1" type="model">
            <mesh>
              <vertices>
                <vertex x="0" y="0" z="0"/>
                <vertex x="10" y="0" z="0"/>
                <vertex x="0" y="10" z="0"/>
              </vertices>
              <triangles>
                <triangle v1="0" v2="1" v3="2" paint_color="481"/>
              </triangles>
            </mesh>
          </object>
          <object id="2" type="model">${BOX_MESH_XML}</object>
          <object id="3" type="model">
            <components>
              <component objectid="1"/>
              <component objectid="2"/>
            </components>
          </object>
        </resources>
        <build><item objectid="3"/></build>
      </model>`,
    "Metadata/project_settings.config": JSON.stringify({
      filament_colour: ["#111111", "#222222", "#333333"],
      filament_type: ["PLA", "PLA", "PLA"],
    }),
    "Metadata/model_settings.config": `
      <config>
        <object id="3">
          <part id="1" subtype="normal_part"><metadata key="extruder" value="1"/></part>
          <part id="2" subtype="negative_part"><metadata key="extruder" value="2"/></part>
        </object>
      </config>`,
  });

  const loaded = load3MFModel(buf);
  // 1 painted triangle with split nibble 'C' (or 2 sub-triangles) and negative_part #2 skipped
  assert.equal(loaded.stats.partCount, 1);
  assert.ok(loaded.stats.triangleCount >= 2);
  assert.equal(loaded.stats.hasColors, true);
});

test("load3MFModel handles negative-determinant mirror transform and cyclic components safely", async () => {
  const { load3MFModel } = await import("../src/components/viewer/loaders");
  const buf = await make3mfBuffer({
    "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
      <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
        <resources>
          <object id="1" type="model">
            ${BOX_MESH_XML}
            <components>
              <component objectid="2"/>
            </components>
          </object>
          <object id="2" type="model">
            <components>
              <component objectid="1"/>
            </components>
          </object>
        </resources>
        <build>
          <item objectid="1" transform="-10 0 0 0 10 0 0 0 10 0 0 0"/>
        </build>
      </model>`,
  });

  const loaded = load3MFModel(buf);
  assert.equal(loaded.stats.triangleCount, 12);
  assert.ok(loaded.stats.volumeCm3 > 0, `expected positive volumeCm3, got ${loaded.stats.volumeCm3}`);
});

test("load3MFModel pre-allocated multi-color colorgroup path preserves vertex colors", async () => {
  const { load3MFModel } = await import("../src/components/viewer/loaders");
  const buf = await make3mfBuffer({
    "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
      <model unit="millimeter"
             xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
             xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
        <resources>
          <m:colorgroup id="5">
            <m:color color="#ff0000"/>
            <m:color color="#0000ff"/>
          </m:colorgroup>
          <object id="1" type="model">
            <mesh>
              <vertices>
                <vertex x="0" y="0" z="0"/>
                <vertex x="10" y="0" z="0"/>
                <vertex x="0" y="10" z="0"/>
              </vertices>
              <triangles>
                <triangle v1="0" v2="1" v3="2" pid="5" p1="0" p2="1" p3="1"/>
              </triangles>
            </mesh>
          </object>
        </resources>
        <build><item objectid="1"/></build>
      </model>`,
  });

  const loaded = load3MFModel(buf);
  assert.equal(loaded.stats.triangleCount, 1);
  assert.deepEqual(loaded.stats.colors, ["#ff0000", "#0000ff"]);
});

test("load3MFModel extracts multi-plate metadata, compacts inter-plate gaps, and filters plates", async () => {
  const { load3MFModel, applyPlateFilter } = await import("../src/components/viewer/loaders");
  const buf = await make3mfBuffer({
    "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
      <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
        <resources>
          <object id="1" type="model">${BOX_MESH_XML}</object>
          <object id="2" type="model">${BOX_MESH_XML}</object>
        </resources>
        <build>
          <item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
          <item objectid="2" transform="1 0 0 0 1 0 0 0 1 300 0 0"/>
        </build>
      </model>`,
    "Metadata/project_settings.config": JSON.stringify({
      filament_colour: ["#161616", "#ddbc00"],
      filament_type: ["PLA", "PLA"],
    }),
    "Metadata/model_settings.config": `
      <config>
        <object id="1"><metadata key="extruder" value="1"/></object>
        <object id="2"><metadata key="extruder" value="2"/></object>
        <plate>
          <metadata key="plater_id" value="1"/>
          <metadata key="plater_name" value="Base"/>
          <model_instance><metadata key="object_id" value="1"/></model_instance>
        </plate>
        <plate>
          <metadata key="plater_id" value="2"/>
          <metadata key="plater_name" value="Top"/>
          <model_instance><metadata key="object_id" value="2"/></model_instance>
        </plate>
      </config>`,
  });

  const loaded = load3MFModel(buf);
  assert.equal(loaded.stats.plates?.length, 2);
  assert.equal(loaded.stats.plates?.[0]?.name, "Base");
  assert.deepEqual(loaded.stats.plates?.[0]?.colors, ["#161616"]);
  assert.deepEqual(loaded.stats.plates?.[1]?.colors, ["#ddbc00"]);
  // Two 1mm boxes separated by a 24mm compacted gap -> ~26mm width instead of 301mm
  assert.ok(loaded.stats.bbox.width < 30, `expected compacted width < 30, got ${loaded.stats.bbox.width}`);

  const p1 = applyPlateFilter(loaded.root, 1);
  assert.equal(p1.triangleCount, 12);
  assert.deepEqual(p1.colors, ["#161616"]);
  assert.ok(Math.abs(p1.bbox.width - 1) < 0.05);

  const p2 = applyPlateFilter(loaded.root, 2);
  assert.equal(p2.triangleCount, 12);
  assert.deepEqual(p2.colors, ["#ddbc00"]);

  const all = applyPlateFilter(loaded.root, null);
  assert.equal(all.triangleCount, 24);
  assert.ok(all.bbox.width < 30);
});

test("load3MFModel handles Doctors trophy's.3mf multi-plate colors and upright orientation", async () => {
  const samplePath =
    "/Users/Kamish/Library/CloudStorage/GoogleDrive-jabezrafael1@gmail.com/Other computers/Ideapad Gaming 3/3d printing shiz/orders from peeps/Doctors trophy's.3mf";
  if (!fs.existsSync(samplePath)) return;

  const { load3MFModel, applyPlateFilter } = await import("../src/components/viewer/loaders");
  const raw = fs.readFileSync(samplePath);
  const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const loaded = load3MFModel(ab);

  assert.equal(loaded.stats.plates?.length, 2);
  assert.equal(loaded.stats.filaments?.length, 3);
  assert.ok(loaded.stats.bbox.height > 120, `expected upright height > 120mm, got ${loaded.stats.bbox.height}`);
  assert.equal(loaded.stats.hasColors, true);

  const p1 = applyPlateFilter(loaded.root, 1);
  assert.equal(p1.triangleCount, 395196);
  assert.equal(p1.colors.length, 3);

  const p2 = applyPlateFilter(loaded.root, 2);
  assert.equal(p2.triangleCount, 5454);
  assert.equal(p2.colors.length, 2);

  const all = applyPlateFilter(loaded.root, null);
  assert.equal(all.triangleCount, 400650);
});
