import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { CONTAINERS } from "../../src/data";
import { buildStl } from "./stl.js";
import { getMailer, type Attachment } from "./mail.js";

const app = new Hono();
app.use("/v1/*", cors());

app.get("/v1/health", (c) => c.json({ ok: true, service: "packout-stl", version: "0.1.0" }));

app.get("/v1/containers", (c) =>
  c.json(
    CONTAINERS.map((k) => ({
      id: k.id,
      name: k.name,
      modelNumbers: k.modelNumbers,
      internal: k.internal,
      verified: k.verified,
    })),
  ),
);

/** POST /v1/stl  -> binary STL, or 4xx JSON with validation issues. */
app.post("/v1/stl", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body == null) return c.json({ error: "Body must be JSON." }, 400);

  const r = buildStl(body);
  if (!r.ok) return c.json({ error: r.error, issues: r.issues }, r.status);

  c.header("Content-Type", "model/stl");
  c.header("Content-Disposition", `attachment; filename="${r.filename}"`);
  c.header("X-Triangle-Count", String(r.triangleCount));
  c.header("X-Insert-Height-Mm", r.height_mm.toFixed(1));
  // serializeBinarySTL returns a Uint8Array over a fresh, exact-size ArrayBuffer
  return c.body(r.bytes.buffer as ArrayBuffer);
});

/** POST /v1/stl/email  -> generates the STL and emails it as an attachment. */
app.post("/v1/stl/email", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body == null) return c.json({ error: "Body must be JSON." }, 400);

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.json({ error: "A valid \"email\" is required." }, 400);
  }

  const r = buildStl(body);
  if (!r.ok) return c.json({ error: r.error, issues: r.issues }, r.status);

  const mailer = getMailer();
  if (!mailer.configured) {
    return c.json(
      { error: "Email delivery is not configured on this server. Set SMTP_URL / MAIL_FROM." },
      501,
    );
  }

  const attachment: Attachment = {
    filename: r.filename,
    content: r.bytes,
    contentType: "model/stl",
  };
  try {
    await mailer.send(
      email,
      `Your PACKOUT insert — ${r.filename}`,
      `Attached is the STL for your insert.\n\n${r.triangleCount.toLocaleString()} triangles, ${r.height_mm.toFixed(
        1,
      )} mm tall.${r.notes.length ? `\n\nNotes:\n- ${r.notes.join("\n- ")}` : ""}`,
      [attachment],
    );
  } catch (err) {
    return c.json({ error: `Send failed: ${(err as Error).message}` }, 502);
  }
  return c.json({ ok: true, sentTo: email, filename: r.filename });
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`packout-stl API listening on http://localhost:${info.port}`);
});

export { app };
