'use client'

import Image from 'next/image'
import {
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gavel,
  Heart,
  MessageCircle,
  Send,
  Share2,
  Smile,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export type Room = {
  id: string
  productName: string
  photos: [string, ...string[]]
  listPrice: number
  highestBid: number | null
  category: 'vehiculos' | 'tecnologia' | 'hogar' | 'moda' | 'otros'
  status: 'open' | 'closing' | 'sold'
  closesAt: number | null
  finalPrice: number | null
  bidderCount: number
  spectatorCount: number
  district: string
  heat: number
}

export type Bid = {
  id: string
  handle: string
  amount: number
  district: string
  createdAt: number
  isLeader: boolean
}

export type ChatMsg = {
  id: string
  handle: string
  text: string
  role: 'buyer' | 'seller' | 'agent'
  createdAt: number
}

export type Reaction = { id: string; emoji: string; handle: string }

export type Seller = {
  handle: string
  avatarUrl?: string
  isAgentRepresented: boolean
}

type AuctionRoomProps = {
  room: Room
  seller: Seller
  bids: Bid[]
  messages: ChatMsg[]
  reactions: Reaction[]
  myRole: 'spectator' | 'bidder'
  isInterested: boolean
  activePanel: 'chat' | 'bids'
  bidDraft: string
  messageDraft: string
  onBid: () => void
  onSend: () => void
  onReact: (emoji: string) => void
  onToggleRole: () => void
  onToggleInterest: () => void
  onPanelChange: (panel: 'chat' | 'bids') => void
  onBidDraftChange: (value: string) => void
  onMessageDraftChange: (value: string) => void
  onShare: () => void
  onCollapse: () => void
}

const reactions = ['🔥', '😍', '🤯', '👏', '💜', '👀']
const money = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

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

export function AuctionRoom({
  room,
  seller,
  bids,
  messages,
  reactions: liveReactions,
  myRole,
  isInterested,
  activePanel,
  bidDraft,
  messageDraft,
  onBid,
  onSend,
  onReact,
  onToggleRole,
  onToggleInterest,
  onPanelChange,
  onBidDraftChange,
  onMessageDraftChange,
  onShare,
  onCollapse,
}: AuctionRoomProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)
  const [now, setNow] = useState(() => Date.now())
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

  const submitMessage = () => {
    if (messageDraft.trim()) onSend()
  }

  return (
    <main className="altoke-room relative mx-auto min-h-[100svh] w-full max-w-[1180px] overflow-hidden bg-altoke-bg font-sans text-altoke-ink md:min-h-[calc(100svh-2rem)] md:rounded-[32px] md:my-4">
      <section className="relative min-h-[100svh] md:min-h-[calc(100svh-2rem)]" aria-label={`Sala de subasta: ${room.productName}`}>
        <Image src={room.photos[0]} alt={room.productName} fill priority sizes="(max-width: 768px) 100vw, 1180px" className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(16,18,26,.66)_0%,rgba(16,18,26,.05)_34%,rgba(16,18,26,.28)_58%,rgba(16,18,26,.94)_100%)]" />

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
          <div className="flex items-center gap-2">
            <span className="altoke-live-pill"><Users aria-hidden="true" /> {room.spectatorCount} mirando</span>
            <button type="button" onClick={onCollapse} className="altoke-icon-button" aria-label="Colapsar sala"><ChevronDown /></button>
          </div>
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

        <div className="altoke-product-carousel absolute inset-x-4 top-36 h-24 overflow-hidden rounded-[24px] md:left-6 md:right-auto md:top-40 md:w-full md:max-w-md">
          <Image src={room.photos[activePhoto]} alt={`${room.productName}, foto ${activePhoto + 1} de ${room.photos.length}`} fill sizes="(max-width: 768px) calc(100vw - 32px), 320px" className="object-cover" />
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

        <div className="absolute bottom-[252px] left-4 right-20 flex flex-col gap-3 md:bottom-44 md:left-6 md:max-w-md">
          <div className="flex gap-2" role="tablist" aria-label="Actividad de la sala">
            <button type="button" role="tab" aria-selected={activePanel === 'chat'} onClick={() => onPanelChange('chat')} className={`altoke-tab ${activePanel === 'chat' ? 'altoke-tab-active' : ''}`}><MessageCircle /> Chat</button>
            <button type="button" role="tab" aria-selected={activePanel === 'bids'} onClick={() => onPanelChange('bids')} className={`altoke-tab ${activePanel === 'bids' ? 'altoke-tab-active' : ''}`}><Gavel /> Ofertas</button>
          </div>

          {activePanel === 'chat' ? (
            <div className="chat-fade flex min-h-32 flex-col justify-end gap-2" role="tabpanel" aria-label="Chat en vivo">
              {visibleMessages.map((message) => (
                <div key={message.id} className="flex items-start gap-2 text-sm text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.9)]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">{message.handle.replace('@', '').slice(0, 1).toUpperCase()}</span>
                  <p><span className={`mr-2 font-bold ${message.role === 'agent' ? 'text-altoke-accent' : 'text-white/55'}`}>{message.handle}</span>{message.text}</p>
                </div>
              ))}
              <div className="altoke-message-input flex items-center gap-2">
                <input value={messageDraft} onChange={(event) => onMessageDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) submitMessage() }} placeholder="Escribe en el chat" aria-label="Mensaje para el chat" />
                <button type="button" onClick={submitMessage} aria-label="Enviar mensaje"><Send /></button>
              </div>
            </div>
          ) : (
            <div className="altoke-bid-list flex min-h-32 flex-col gap-2" role="tabpanel" aria-label="Ofertas recientes">
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

        <div className="absolute bottom-[268px] right-4 flex flex-col items-center gap-3 md:bottom-44 md:right-6">
          {pickerOpen && (
            <div className="altoke-picker flex flex-col gap-1" aria-label="Elegir reacción">
              {reactions.map((emoji) => <button type="button" key={emoji} onClick={() => { onReact(emoji); setPickerOpen(false) }} aria-label={`Reaccionar con ${emoji}`}>{emoji}</button>)}
            </div>
          )}
          <button type="button" onClick={onToggleInterest} className={`altoke-icon-button ${isInterested ? 'altoke-interest-active' : ''}`} aria-pressed={isInterested} aria-label={isInterested ? 'Quitar interés' : 'Me interesa'}><Heart fill={isInterested ? 'currentColor' : 'none'} /></button>
          <button type="button" onClick={() => setPickerOpen((value) => !value)} className="altoke-icon-button" aria-expanded={pickerOpen} aria-label="Abrir reacciones"><Smile /></button>
          <button type="button" onClick={onShare} className="altoke-icon-button" aria-label="Compartir sala"><Share2 /></button>
        </div>

        <div className="pointer-events-none absolute inset-y-32 right-2 w-16 overflow-hidden" aria-hidden="true">
          {liveReactions.slice(-8).map((reaction, index) => (
            <span key={reaction.id} className="reaction-particle" style={{ '--reaction-x': `${((index * 13) % 31) - 15}px`, '--reaction-delay': `${(index % 4) * -0.7}s` } as React.CSSProperties}>{reaction.emoji}</span>
          ))}
        </div>

        {leader && room.status !== 'sold' && (
          <div className="absolute inset-x-4 bottom-[206px] rounded-full bg-black/55 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-md md:inset-x-auto md:bottom-28 md:left-1/2 md:-translate-x-1/2">
            ▲ <span className="text-altoke-accent">{leader.handle}</span> va ganando
          </div>
        )}

        <footer className="absolute inset-x-0 bottom-0 bg-altoke-bg/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl md:px-6">
          {room.status === 'sold' ? (
            <div className="rounded-[28px] bg-altoke-sold px-5 py-6 text-center text-altoke-action-ink">
              <p className="text-xs font-bold uppercase tracking-[0.18em]">Vendido</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">S/ {money.format(room.finalPrice ?? 0)} a {leader?.handle ?? 'comprador'}</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <Image src={room.photos[0]} alt="" width={48} height={48} className="size-12 rounded-[14px] object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{room.productName}</p><p className="text-xs text-altoke-ink-soft">{room.district} · {room.bidderCount} ofertando</p></div>
                <div className="text-right"><p className="tabular-nums text-xl font-bold">S/ {money.format(room.highestBid ?? room.listPrice)}</p>{room.status === 'closing' && <p className="altoke-countdown tabular-nums">{timeLeft}</p>}</div>
              </div>
              <div className="flex items-stretch gap-2">
                <button type="button" onClick={onToggleRole} className="altoke-role-toggle" aria-label={myRole === 'bidder' ? 'Cambiar a espectador' : 'Cambiar a ofertante'}>{myRole === 'bidder' ? <Eye /> : <Banknote />}</button>
                {myRole === 'bidder' ? (
                  <>
                    <div className="altoke-inset flex min-w-0 flex-1 items-center rounded-[20px] px-4"><span className="font-bold text-altoke-ink-soft">S/</span><input inputMode="numeric" value={bidDraft} onChange={(event) => onBidDraftChange(event.target.value.replace(/\D/g, ''))} className="min-w-0 flex-1 bg-transparent px-2 py-4 font-bold tabular-nums outline-none" aria-label="Monto de oferta" /></div>
                    <button type="button" onClick={onBid} className="altoke-bid-button">Ofertar</button>
                  </>
                ) : (
                  <button type="button" onClick={onToggleRole} className="altoke-spectator-message"><Eye /> Estás mirando · toca para ofertar</button>
                )}
              </div>
            </>
          )}
        </footer>
      </section>
    </main>
  )
}
