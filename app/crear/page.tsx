"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FOTOS = 6;
const CATEGORIAS: { id: string; label: string }[] = [
  { id: "vehiculos", label: "Vehículos" },
  { id: "tecnologia", label: "Tecnología" },
  { id: "hogar", label: "Hogar" },
  { id: "moda", label: "Moda" },
  { id: "otros", label: "Otros" },
];

export default function CrearSalaPage() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [category, setCategory] = useState("otros");
  const [listPrice, setListPrice] = useState("");
  const [floorPrice, setFloorPrice] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFotos = useRef<HTMLInputElement>(null);

  function agregarFotos(nuevas: FileList | null) {
    if (!nuevas) return;
    const arr = Array.from(nuevas);
    setFotos((prev) => [...prev, ...arr].slice(0, MAX_FOTOS));
  }

  function quitarFoto(i: number) {
    setFotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function crear() {
    setError(null);

    const lista = Math.floor(Number(listPrice));
    const piso = Math.floor(Number(floorPrice));
    if (!productName.trim()) return setError("Ponle un nombre al producto.");
    if (!Number.isFinite(lista) || lista <= 0) return setError("El precio de lista no es válido.");
    if (!Number.isFinite(piso) || piso <= 0) return setError("El precio piso no es válido.");
    if (piso > lista) return setError("El piso no puede ser mayor que el precio de lista.");

    setEnviando(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          productDesc: productDesc.trim() || null,
          category,
          listPrice: lista,
          floorPrice: piso,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(errorTexto(j.error));
        return;
      }
      const roomId: string = j.id;

      if (fotos.length > 0) {
        const form = new FormData();
        for (const f of fotos) form.append("fotos", f);
        const resFotos = await fetch(`/api/rooms/${roomId}/photos`, { method: "POST", body: form });
        if (!resFotos.ok) {
          // La sala YA existe - no revertimos la creación por esto, solo
          // avisamos. El vendedor puede subir fotos después desde el panel.
          console.error("Fotos no subieron", await resFotos.json().catch(() => ({})));
        }
      }

      router.push(`/sala/${roomId}?seller=1`);
    } catch {
      setError("Algo falló de nuestro lado. Intenta otra vez.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="display text-4xl leading-none text-amarillo dura">
        Crea tu<br />sala
      </h1>
      <p className="text-sm text-papel/70">
        El precio piso es privado - nunca lo va a ver ningún comprador, ni en
        el chat ni en ningún payload.
      </p>

      <label className="text-xs font-bold uppercase tracking-widest text-papel/60">Producto</label>
      <input
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
        placeholder="Ej: Bicicleta Monark aro 26"
        maxLength={80}
        className="borde w-full bg-papel px-4 py-3 font-bold text-tinta outline-none focus:ring-4 focus:ring-fucsia"
      />

      <label className="text-xs font-bold uppercase tracking-widest text-papel/60">
        Descripción (el agente la usa para negociar mejor)
      </label>
      <textarea
        value={productDesc}
        onChange={(e) => setProductDesc(e.target.value)}
        placeholder="Ej: Poco uso, llantas nuevas, la compré hace 6 meses..."
        maxLength={500}
        rows={4}
        className="borde w-full bg-papel px-4 py-3 text-sm text-tinta outline-none focus:ring-4 focus:ring-fucsia"
      />

      <label className="text-xs font-bold uppercase tracking-widest text-papel/60">Categoría</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="borde w-full bg-papel px-4 py-3 font-bold text-tinta outline-none focus:ring-4 focus:ring-fucsia"
      >
        {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold uppercase tracking-widest text-papel/60">Precio lista</label>
          <input
            inputMode="numeric" value={listPrice}
            onChange={(e) => setListPrice(e.target.value.replace(/\D/g, ""))}
            placeholder="500"
            className="borde mt-1 w-full bg-papel px-4 py-3 font-bold text-tinta outline-none focus:ring-4 focus:ring-fucsia"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold uppercase tracking-widest text-papel/60">Precio piso</label>
          <input
            inputMode="numeric" value={floorPrice}
            onChange={(e) => setFloorPrice(e.target.value.replace(/\D/g, ""))}
            placeholder="350"
            className="borde mt-1 w-full bg-papel px-4 py-3 font-bold text-tinta outline-none focus:ring-4 focus:ring-fucsia"
          />
        </div>
      </div>

      <label className="text-xs font-bold uppercase tracking-widest text-papel/60">
        Fotos ({fotos.length}/{MAX_FOTOS})
      </label>
      <input
        ref={inputFotos}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => { agregarFotos(e.target.files); e.target.value = ""; }}
        className="text-sm text-papel/70"
      />
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 object-cover borde" />
              <button
                onClick={() => quitarFoto(i)}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-fucsia text-xs font-black text-tinta"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm font-bold text-fucsia">{error}</p>}

      <button
        onClick={crear}
        disabled={enviando}
        className="borde mt-2 bg-amarillo px-6 py-5 display text-2xl text-tinta disabled:opacity-40"
      >
        {enviando ? "Creando…" : "Crear sala"}
      </button>
    </main>
  );
}

function errorTexto(codigo: string): string {
  const m: Record<string, string> = {
    falta_nombre: "Ponle un nombre al producto.",
    precio_lista_invalido: "El precio de lista no es válido.",
    precio_piso_invalido: "El precio piso no es válido.",
    piso_mayor_a_lista: "El piso no puede ser mayor que el precio de lista.",
    no_se_pudo_generar_id: "No se pudo crear la sala, intenta con otro nombre.",
  };
  return m[codigo] ?? "No se pudo crear la sala.";
}
