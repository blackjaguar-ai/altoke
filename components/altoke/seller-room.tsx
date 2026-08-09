'use client'

/**
 * SellerRoom — a diferencia de auction-room.tsx y marketplace-home.tsx,
 * este componente NO lo generó v0 (se acabaron los créditos antes del
 * Prompt 2). Está escrito a mano, reusando EXACTAMENTE los mismos tokens,
 * clases CSS (.altoke-*) y el mismo tipo Room/Bid/ChatMsg/Seller ya
 * definidos en auction-room.tsx - nada de esto redefine un sistema visual
 * paralelo. El patrón del carrusel (posición, tamaño, flechas, puntos) es
 * una copia literal de lo que v0 ya construyó ahí, no una versión propia.
 */

import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Room, Bid, ChatMsg, Seller } from './auction-room'

export type { Room, Bid, ChatMsg, Seller }

type SellerRoomProps = {
  room: Room
  seller: Seller
  bids: Bid[]
  messages: ChatMsg[]
  onClose: (seconds: 300 | 60 | 15) => void
  /** Solo existe cuando room.status === 'sold'. */
  privateChat?: {
    winnerHandle: string
    messages: ChatMsg[]
    draft: string
    onDraftChange: (value: string) => void
    onSend: () => void
  }
}

const money = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

// Copia literal del helper de auction-room.tsx - no está exportado ahí,
// así que se reproduce acá con el mismo comportamiento exacto.
function Avatar({ handle, url }: { handle: string; url?: string }) {
  if (url) {
    return <Image src={url} alt={`Avatar de ${handle}`} width={40} height={40} className="size-10 rounded-full object-cover" />
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-altoke-accent font-bold text-altoke-action-ink">
      {handle.replace('@', '').slice(0, 1).toUpperCase()}
    </span>
  )
}

function formatCountdown(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function SellerRoom({ room, seller, bids, messages, onClose, privateChat }: SellerRoomProps) {
  const [activePhoto, setActivePhoto] = useState(0)
  const [panel, setPanel] = useState<'chat' | 'bids'>('bids')
  const [now, setNow] = useState(() => Date.now())
  const [cerrando, setCerrando] = useState<300 | 60 | 15 | null>(null)

  const leader = bids.find((bid) => bid.isLeader)
  const currentAmount = room.status === 'sold' ? room.finalPrice : room.highestBid
  const visibleMessages = messages.slice(-4)
  const visibleBids = bids.slice(0, 5)

  useEffect(() => {
    if (room.status !== 'closing' || !room.closesAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [room.closesAt, room.status])

  const timeLeft = useMemo(
    () => (room.closesAt ? formatCountdown(room.closesAt - now) : null),
    [now, room.closesAt],
  )

  async function disparar(seconds: 300 | 60 | 15) {
    setCerrando(seconds)
    try {
      await onClose(seconds)
    } finally {
      setCerrando(null)
    }
  }

  const submitPrivate = () => {
    if (privateChat && privateChat.draft.trim()) privateChat.onSend()
  }

  return (
    <main className="altoke-room relative mx-auto min-h-[100svh] w-full max-w-[1180px] overflow-hidden bg-altoke-bg font-sans text-altoke-ink md:min-h-[calc(100svh-2rem)] md:rounded-[32px] md:my-4">
      <section className="relative min-h-[100svh] md:min-h-[calc(100svh-2rem)]" aria-label={`Vista de vendedor: ${room.productName}`}>
        <Image src={room.photos[0]} alt={room.productName} fill priority sizes="(max-width: 768px) 100vw, 1180px" className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(16,18,26,.66)_0%,rgba(16,18,26,.05)_34%,rgba(16,18,26,.28)_58%,rgba(16,18,26,.94)_100%)]" />

        {/* Header — a diferencia de AuctionRoom, acá el badge EN VIVO /
           REPRESENTADO describe al propio vendedor, no a un tercero. Sin
           botón de colapsar: el vendedor no necesita minimizar su propia
           vista de control. */}
        <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar handle={seller.handle} url={seller.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate font-bold text-white">{seller.handle}</p>
              <span className={seller.isAgentRepresented ? 'altoke-glass-pill' : 'altoke-live-pill'}>
                {seller.isAgentRepresented ? 'Representado por su agente' : 'EN VIVO'}
              </span>
            </div>
          </div>
          <span className="altoke-live-pill">
            <Users aria-hidden="true" /> {room.bidderCount} ofertando · {room.spectatorCount} mirando
          </span>
        </header>

        <div className="absolute inset-x-4 top-24 flex items-center gap-3 md:inset-x-6 md:top-28">
          <div className="altoke-inset h-3 flex-1 overflow-hidden rounded-full" role="meter" aria-label="Calor de la subasta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={room.heat}>
            <div className="h-full rounded-full bg-altoke-heat transition-[width] duration-400 motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.max(0, room.heat))}%` }} />
          </div>
          <div className="shrink-0 text-right text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Oferta actual</p>
            <p className="tabular-nums text-xl font-bold md:text-2xl">S/ {money.format(currentAmount ?? room.listPrice)}</p>
          </div>
        </div>

        {/* Carrusel — copia literal del patrón de auction-room.tsx, mismas
           clases (.altoke-product-carousel, .altoke-carousel-*). El
           vendedor necesita ver su propio producto con la misma claridad
           que cualquier comprador. */}
        <div className="altoke-product-carousel absolute inset-x-4 top-36 h-24 overflow-hidden rounded-[24px] md:left-6 md:right-auto md:top-40 md:w-80">
          <Image src={room.photos[activePhoto] ?? room.photos[0]} alt={`${room.productName}, foto ${activePhoto + 1} de ${room.photos.length}`} fill sizes="(max-width: 768px) calc(100vw - 32px), 320px" className="object-cover" />
          {room.photos.length > 1 && (
            <>
              <button type="button" className="altoke-carousel-arrow left-2" onClick={() => setActivePhoto((index) => (index - 1 + room.photos.length) % room.photos.length)} aria-label="Foto anterior"><ChevronLeft /></button>
              <button type="button" className="altoke-carousel-arrow right-2" onClick={() => setActivePhoto((index) => (index + 1) % room.photos.length)} aria-label="Foto siguiente"><ChevronRight /></button>
              <div className="altoke-carousel-dots" aria-label={`Foto ${activePhoto + 1} de ${room.photos.length}`}>
                {room.photos.map((photo, index) => <button type="button" key={`${photo}-${index}`} onClick={() => setActivePhoto(index)} className={index === activePhoto ? 'altoke-carousel-dot-active' : ''} aria-label={`Ver foto ${index + 1}`} aria-current={index === activePhoto ? 'true' : undefined} />)}
              </div>
            </>
          )}
        </div>

        {/* Feed de solo lectura — mismos tabs Chat/Ofertas, sin input en
           ninguno de los dos: el vendedor monitorea, no participa. */}
        <div className="absolute bottom-[252px] left-4 right-4 flex flex-col gap-3 md:bottom-44 md:left-6 md:max-w-md">
          <div className="flex gap-2" role="tablist" aria-label="Actividad de la sala">
            <button type="button" role="tab" aria-selected={panel === 'chat'} onClick={() => setPanel('chat')} className={`altoke-tab ${panel === 'chat' ? 'altoke-tab-active' : ''}`}>Chat</button>
            <button type="button" role="tab" aria-selected={panel === 'bids'} onClick={() => setPanel('bids')} className={`altoke-tab ${panel === 'bids' ? 'altoke-tab-active' : ''}`}>Ofertas</button>
          </div>

          {panel === 'chat' ? (
            <div className="chat-fade flex min-h-32 flex-col justify-end gap-2" role="tabpanel" aria-label="Chat en vivo">
              {visibleMessages.length === 0 && (
                <p className="text-sm text-white/50">Todavía nadie ha escrito.</p>
              )}
              {visibleMessages.map((message) => (
                <div key={message.id} className="flex items-start gap-2 text-sm text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.9)]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">{message.handle.replace('@', '').slice(0, 1).toUpperCase()}</span>
                  <p><span className={`mr-2 font-bold ${message.role === 'agent' ? 'text-altoke-accent' : 'text-white/55'}`}>{message.handle}</span>{message.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="altoke-bid-list flex min-h-32 flex-col gap-2" role="tabpanel" aria-label="Ofertas recientes">
              {visibleBids.length === 0 && (
                <p className="text-sm text-white/50">Todavía nadie ha ofertado.</p>
              )}
              {visibleBids.map((bid) => (
                <div key={bid.id} className={`flex items-center gap-2 rounded-[20px] bg-black/35 px-3 py-2 backdrop-blur-md ${bid.isLeader ? 'ring-2 ring-altoke-accent' : ''}`}>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{bid.handle}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/65">{bid.district}</span>
                  <span className="tabular-nums text-sm font-bold text-white">S/ {money.format(bid.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {leader && room.status !== 'sold' && (
          <div className="absolute inset-x-4 bottom-[206px] rounded-full bg-black/55 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-md md:inset-x-auto md:bottom-28 md:left-1/2 md:-translate-x-1/2">
            ▲ <span className="text-altoke-accent">{leader.handle}</span> va ganando
          </div>
        )}

        <footer className="absolute inset-x-0 bottom-0 bg-altoke-bg/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl md:px-6">
          {room.status === 'sold' && privateChat ? (
            // Canal privado de coordinación - mismo tratamiento visual que
            // el estado "Vendido" de AuctionRoom (bg-altoke-sold), pero acá
            // con input real porque el vendedor SÍ participa de esta parte.
            <div className="rounded-[28px] bg-altoke-sold p-4 text-altoke-action-ink">
              <p className="text-xs font-bold uppercase tracking-[0.18em]">
                Vendido — S/ {money.format(room.finalPrice ?? 0)} a {privateChat.winnerHandle}
              </p>
              <p className="mt-0.5 text-[11px] opacity-80">Coordina la entrega acá</p>
              <div className="mt-3 max-h-28 space-y-1 overflow-y-auto">
                {privateChat.messages.length === 0 && (
                  <p className="text-xs opacity-70">Escribe para coordinar Yape, Plin o el punto de entrega.</p>
                )}
                {privateChat.messages.map((m) => (
                  <p key={m.id} className="text-sm"><span className="font-bold">{m.handle}</span> {m.text}</p>
                ))}
              </div>
              <div className="altoke-message-input mt-2 flex items-center gap-2 bg-black/15">
                <input
                  value={privateChat.draft}
                  onChange={(event) => privateChat.onDraftChange(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') submitPrivate() }}
                  placeholder="Escribe para coordinar…"
                  aria-label="Mensaje de coordinación"
                  className="text-altoke-action-ink placeholder:text-altoke-action-ink/60"
                />
                <button type="button" onClick={submitPrivate} aria-label="Enviar"><Send /></button>
              </div>
            </div>
          ) : room.status === 'sold' ? (
            <div className="rounded-[28px] bg-altoke-sold px-5 py-6 text-center text-altoke-action-ink">
              <p className="text-xs font-bold uppercase tracking-[0.18em]">Vendido</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">S/ {money.format(room.finalPrice ?? 0)} a {leader?.handle ?? 'comprador'}</p>
            </div>
          ) : (
            // Panel de control — la única acción real de esta pantalla:
            // terminar la negociación. En --live a propósito (urgencia
            // real de cerrar), no --accent (que es la acción del
            // COMPRADOR en AuctionRoom - "Ofertar"). Deshabilitado si la
            // sala ya no está abierta (p.ej. "closing": ya se disparó).
            <div className="altoke-inset rounded-[24px] p-4">
              <div className="mb-3 flex items-center gap-3">
                <Image src={room.photos[0]} alt="" width={48} height={48} className="size-12 rounded-[14px] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{room.productName}</p>
                  <p className="text-xs text-altoke-ink-soft">{room.bidderCount} ofertando</p>
                </div>
                {room.status === 'closing' && timeLeft && (
                  <span className="altoke-countdown tabular-nums">{timeLeft}</span>
                )}
              </div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-altoke-ink-soft">
                Anunciar cierre
              </p>
              <div className="flex gap-2">
                {([300, 60, 15] as const).map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    disabled={room.status !== 'open' || cerrando !== null}
                    onClick={() => disparar(seconds)}
                    className="flex-1 rounded-[16px] bg-altoke-live py-3 text-sm font-black uppercase tracking-wide text-altoke-action-ink disabled:opacity-40"
                  >
                    {cerrando === seconds ? '…' : seconds >= 60 ? `${seconds / 60} min` : `${seconds}s`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </footer>
      </section>
    </main>
  )
}
