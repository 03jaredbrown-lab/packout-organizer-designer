/** Minimal triangle-soup mesh + binary STL serialisation. Units: millimetres. */

export type V3 = [number, number, number];

export interface Triangle {
  a: V3;
  b: V3;
  c: V3;
}

export interface Mesh {
  triangles: Triangle[];
}

export function emptyMesh(): Mesh {
  return { triangles: [] };
}

export function mergeMeshes(meshes: Mesh[]): Mesh {
  const out: Triangle[] = [];
  for (const m of meshes) out.push(...m.triangles);
  return { triangles: out };
}

function sub(p: V3, q: V3): V3 {
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}

function cross(u: V3, v: V3): V3 {
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

function normalize(v: V3): V3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function triangleNormal(t: Triangle): V3 {
  return normalize(cross(sub(t.b, t.a), sub(t.c, t.a)));
}

/**
 * Axis-aligned box from (x0,y0,z0) to (x0+dx, y0+dy, z0+dz) with all faces wound
 * counter-clockwise as seen from outside (outward normals).
 */
export function box(x0: number, y0: number, z0: number, dx: number, dy: number, dz: number): Mesh {
  const x1 = x0 + dx;
  const y1 = y0 + dy;
  const z1 = z0 + dz;

  // 8 corners
  const p000: V3 = [x0, y0, z0];
  const p100: V3 = [x1, y0, z0];
  const p110: V3 = [x1, y1, z0];
  const p010: V3 = [x0, y1, z0];
  const p001: V3 = [x0, y0, z1];
  const p101: V3 = [x1, y0, z1];
  const p111: V3 = [x1, y1, z1];
  const p011: V3 = [x0, y1, z1];

  const quad = (a: V3, b: V3, c: V3, d: V3): Triangle[] => [
    { a, b, c },
    { a, b: c, c: d },
  ];

  const tris: Triangle[] = [
    ...quad(p000, p010, p110, p100), // bottom (z0), normal -z
    ...quad(p001, p101, p111, p011), // top (z1), normal +z
    ...quad(p000, p100, p101, p001), // front (y0), normal -y
    ...quad(p010, p011, p111, p110), // back (y1), normal +y
    ...quad(p000, p001, p011, p010), // left (x0), normal -x
    ...quad(p100, p110, p111, p101), // right (x1), normal +x
  ];
  return { triangles: tris };
}

export function meshBounds(mesh: Mesh) {
  let min: V3 = [Infinity, Infinity, Infinity];
  let max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const t of mesh.triangles) {
    for (const p of [t.a, t.b, t.c]) {
      for (let i = 0; i < 3; i++) {
        if (p[i] < min[i]) min[i] = p[i];
        if (p[i] > max[i]) max[i] = p[i];
      }
    }
  }
  return { min, max };
}

/** Serialise a mesh to a binary STL byte buffer. */
export function serializeBinarySTL(mesh: Mesh, header = "packout-organizer-designer"): Uint8Array {
  const count = mesh.triangles.length;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const headerBytes = new TextEncoder().encode(header.slice(0, 80));
  bytes.set(headerBytes, 0);

  view.setUint32(80, count, true);

  let offset = 84;
  for (const t of mesh.triangles) {
    const n = triangleNormal(t);
    view.setFloat32(offset, n[0], true);
    view.setFloat32(offset + 4, n[1], true);
    view.setFloat32(offset + 8, n[2], true);
    const verts = [t.a, t.b, t.c];
    for (let i = 0; i < 3; i++) {
      const base = offset + 12 + i * 12;
      view.setFloat32(base, verts[i][0], true);
      view.setFloat32(base + 4, verts[i][1], true);
      view.setFloat32(base + 8, verts[i][2], true);
    }
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }
  return bytes;
}
