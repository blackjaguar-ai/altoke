'use client'

import Image from 'next/image'
import { ChevronDown, CircleUserRound, Grid2X2, Home, Search, Store } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Room } from './auction-room'

export type MarketplaceCategory = {
  id: Room['category'] | 'all'
  label: string
}

type MarketplaceHomeProps = {
  rooms: Room[]
  categories: MarketplaceCategory[]
  activeCategory: MarketplaceCategory['id']
  onSelectCategory: (category: MarketplaceCategory['id']) => void
  onOpenRoom: (room: Room) => void
  /**
   * EXCEPCIÓN — agregado a mano, no por v0. El nav inferior que generó v0
   * no traía ningún onClick en sus 4 botones (puramente decorativos). Es
   * un cambio mecánico de una línea, sin tocar diseño ni estructura, así
   * que no ameritaba otra ronda completa de v0 - se documenta acá para
   * que quede claro qué se tocó y por qué.
   */
  onNavigateVender?: () => void
}

const money = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

function RoomImage({ room, sizes }: { room: Room; sizes: string }) {
  return (
    <div className="home-room-media">
      <Image src={room.photoUrl} alt={room.productName} fill sizes={sizes} className="object-cover" />
      <span className="home-live-pill">EN VIVO · {room.spectatorCount}</span>
      <span className="home-heat-track" aria-label={`Nivel de actividad ${room.heat}%`}>
        <span style={{ width: `${Math.min(100, room.heat)}%` }} />
      </span>
    </div>
  )
}

function RoomCard({ room, onOpen }: { room: Room; onOpen: () => void }) {
  const price = room.highestBid ?? room.listPrice
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`home-room-card ${room.status === 'closing' ? 'home-room-closing' : ''}`}
      aria-label={`Abrir sala de ${room.productName}, precio S/ ${money.format(price)}`}
    >
      <RoomImage room={room} sizes="(max-width: 640px) 45vw, 220px" />
      <span className="flex min-w-0 flex-col gap-2 px-1 pb-1 text-left">
        <strong className="line-clamp-2 min-h-10 text-sm leading-5 text-altoke-ink">{room.productName}</strong>
        <span className="font-mono text-base font-bold tabular-nums text-altoke-ink">S/ {money.format(price)}</span>
        <span className="home-district-chip">{room.district}</span>
      </span>
    </button>
  )
}

function HotCard({ room, onOpen }: { room: Room; onOpen: () => void }) {
  return (
    <button type="button" className="home-hot-card" onClick={onOpen} aria-label={`Abrir ${room.productName}`}>
      <RoomImage room={room} sizes="160px" />
      <strong className="line-clamp-2 text-left text-sm leading-5 text-altoke-ink">{room.productName}</strong>
      <span className="font-mono text-left text-sm font-bold tabular-nums text-altoke-accent">
        S/ {money.format(room.highestBid ?? room.listPrice)}
      </span>
    </button>
  )
}

export function MarketplaceHome({ rooms, categories, activeCategory, onSelectCategory, onOpenRoom, onNavigateVender }: MarketplaceHomeProps) {
  const [query, setQuery] = useState('')
  const [salesOpen, setSalesOpen] = useState(false)

  const activeRooms = useMemo(() => rooms.filter((room) => room.status !== 'sold'), [rooms])
  const soldRooms = useMemo(() => rooms.filter((room) => room.status === 'sold'), [rooms])
  const hotRooms = useMemo(() => [...activeRooms].sort((a, b) => b.heat - a.heat).slice(0, 6), [activeRooms])
  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    return activeRooms.filter((room) => {
      const categoryMatches = activeCategory === 'all' || room.category === activeCategory
      const queryMatches = !normalized || `${room.productName} ${room.district}`.toLocaleLowerCase('es').includes(normalized)
      return categoryMatches && queryMatches
    })
  }, [activeCategory, activeRooms, query])

  return (
    <main className="altoke-home min-h-dvh bg-altoke-bg text-altoke-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 pb-32 pt-5 sm:px-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-altoke-accent">Altoke</p>
            <h1 className="text-balance text-2xl font-bold leading-tight">Encuentra tu próxima joyita</h1>
          </div>
          <span className="home-brand-mark" aria-hidden="true">A</span>
        </header>

        <label className="home-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Buscar salas</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca productos o distritos" />
        </label>

        <nav className="home-horizontal-scroll" aria-label="Categorías">
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`home-category-chip ${activeCategory === category.id ? 'home-category-active' : ''}`}
              onClick={() => onSelectCategory(category.id)}
              aria-pressed={activeCategory === category.id}
            >
              {category.label}
            </button>
          ))}
        </nav>

        <section className="flex flex-col gap-4" aria-labelledby="hot-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-altoke-ink-soft">Lo que todos están mirando</p>
              <h2 id="hot-title" className="text-xl font-bold">🔥 En caliente</h2>
            </div>
            <span className="text-xs font-semibold text-altoke-accent">{hotRooms.length} salas</span>
          </div>
          <div className="home-horizontal-scroll home-hot-rail">
            {hotRooms.map((room) => <HotCard key={room.id} room={room} onOpen={() => onOpenRoom(room)} />)}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="rooms-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="rooms-title" className="text-xl font-bold">Salas activas</h2>
            <span className="text-xs font-semibold text-altoke-ink-soft">{filteredRooms.length} disponibles</span>
          </div>
          {filteredRooms.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredRooms.map((room) => <RoomCard key={room.id} room={room} onOpen={() => onOpenRoom(room)} />)}
            </div>
          ) : (
            <div className="home-empty">No encontramos salas con esos filtros.</div>
          )}
        </section>

        <section className="home-sales">
          <button type="button" className="home-sales-trigger" onClick={() => setSalesOpen((open) => !open)} aria-expanded={salesOpen}>
            <span><strong>Últimas ventas</strong><small>{soldRooms.length} remates cerrados</small></span>
            <ChevronDown className={salesOpen ? 'rotate-180' : ''} aria-hidden="true" />
          </button>
          {salesOpen && (
            <ul className="flex flex-col gap-3 pt-4">
              {soldRooms.map((room) => (
                <li key={room.id} className="home-sale-row">
                  <Image src={room.photoUrl} alt="" width={40} height={40} className="size-10 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{room.productName}</span>
                  <strong className="font-mono text-sm tabular-nums text-altoke-sold">S/ {money.format(room.finalPrice ?? room.highestBid ?? room.listPrice)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <nav className="home-bottom-nav" aria-label="Navegación principal">
        <button type="button" className="home-nav-active" aria-current="page"><Home /><span>Inicio</span></button>
        <button type="button"><Grid2X2 /><span>Categorías</span></button>
        <button type="button" onClick={onNavigateVender}><Store /><span>Vender</span></button>
        <button type="button"><CircleUserRound /><span>Cuenta</span></button>
      </nav>
    </main>
  )
}
