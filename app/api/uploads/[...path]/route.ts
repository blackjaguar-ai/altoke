import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Sirve archivos del volumen `uploads` (docker-compose.yml). No pasa por
 * `public/` a propósito - ver nota en el Dockerfile: ese folder se hornea
 * en el build, cualquier archivo escrito ahí en runtime desaparece en el
 * próximo rebuild. Esto en cambio lee del volumen persistente en runtime.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;

  // Guard de path traversal: ningún segmento puede ser ".." ni contener
  // separadores de ruta. Sin esto, alguien podría pedir
  // /api/uploads/..%2F..%2F.env y leer archivos fuera de uploads/.
  if (segments.some((s) => s === ".." || s.includes("/") || s.includes("\\"))) {
    return new Response("bad path", { status: 400 });
  }

  const ext = path.extname(segments[segments.length - 1] ?? "").toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return new Response("unsupported type", { status: 400 });

  const filePath = path.join(UPLOADS_DIR, ...segments);
  try {
    const buf = await readFile(filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
