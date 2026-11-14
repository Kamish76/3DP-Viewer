import { test, before } from "node:test";
import assert from "node:assert/strict";
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
