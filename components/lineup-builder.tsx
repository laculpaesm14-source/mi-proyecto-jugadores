"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Player } from "@/lib/types"
import { POSITION_COLORS } from "@/lib/types"

// Cantidad de jugadores de defensa, centro y ataque en cada formación.
// El arquero siempre va aparte, en la parte de abajo de la cancha.
const FORMATIONS: Record<string, number[]> = {
  "4-4-2": [4, 4, 2],
  "4-3-3": [4, 3, 3],
  "4-2-3-1": [4, 2, 3, 1],
  "3-5-2": [3, 5, 2],
  "5-3-2": [5, 3, 2],
}

type SlotId = string

// Le da un nombre único a cada lugar de la cancha.
function slotId(rowIndex: number, colIndex: number): SlotId {
  return `${rowIndex}-${colIndex}`
}

export function LineupBuilder({ players }: { players: Player[] }) {
  // Recuerda qué formación se eligió, quién está en cada lugar y quién es el técnico.
  const [formation, setFormation] = useState<keyof typeof FORMATIONS>("4-4-2")
  // Guarda qué jugador está en cada lugar de la cancha.
  const [lineup, setLineup] = useState<Record<SlotId, number>>({})
  const [coachId, setCoachId] = useState<number | null>(null)
  const [picking, setPicking] = useState<SlotId | "coach" | null>(null)
  const [search, setSearch] = useState("")

  // Al volver a esta página, recupera la formación y los jugadores elegidos antes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lineup")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.formation in FORMATIONS) setFormation(parsed.formation)
        if (parsed.lineup) setLineup(parsed.lineup)
        if (typeof parsed.coachId === "number") setCoachId(parsed.coachId)
      }
    } catch {
      // Si no hay una alineación guardada, la cancha empieza vacía.
    }
  }, [])

  // Guarda los cambios para que la alineación siga igual la próxima vez.
  useEffect(() => {
    try {
      localStorage.setItem("lineup", JSON.stringify({ formation, lineup, coachId }))
    } catch {
      // Si el navegador no puede guardar, la alineación sigue funcionando por ahora.
    }
  }, [formation, lineup])

  // Acomoda a los jugadores en la cancha: delanteros arriba y arquero abajo.
  // Prepara las filas en el orden visual de la cancha: ataque arriba, arquero abajo.
  const rows = useMemo(() => {
    const outfield = FORMATIONS[formation]
    const attackToDefense = [...outfield].reverse() // ataque primero (arriba)
    return [...attackToDefense, 1] // el 1 final es el arquero (abajo)
  }, [formation])

  // Busca los datos de cada jugador usando su número de identificación.
  const playersById = useMemo(() => {
    const map = new Map<number, Player>()
    for (const p of players) map.set(p.id, p)
    return map
  }, [players])

  // Recuerda quién ya está en la cancha para evitar repetirlo.
  const usedIds = useMemo(() => new Set(Object.values(lineup)), [lineup])

  // Muestra primero a los jugadores que corresponden al lugar elegido.
  // Si se está buscando por nombre o equipo, también conserva ese filtro.
  const availablePlayers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = players.filter((p) => {
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
    })

    let preferredPosition: Player["position"] | null = null
    if (picking === "coach") {
      preferredPosition = "tecnico"
    } else if (picking) {
      const rowIndex = Number(picking.split("-")[0])
      if (rowIndex === rows.length - 1) {
        preferredPosition = "arquero"
      } else if (rowIndex === 0) {
        preferredPosition = "delantero"
      } else if (rowIndex === rows.length - 2) {
        preferredPosition = "defensa"
      } else {
        preferredPosition = "medio campo"
      }
    }

    if (!preferredPosition) return matches
    return matches.sort(
      (a, b) => Number(b.position === preferredPosition) - Number(a.position === preferredPosition),
    )
  }, [players, search, picking, rows])

  function assign(slot: SlotId | "coach", playerId: number) {
    if (slot === "coach") {
      setCoachId(playerId)
      setPicking(null)
      setSearch("")
      return
    }
    setLineup((prev) => {
      const next: Record<SlotId, number> = {}
      // Si ya estaba en otro lugar, lo quita de allí para no repetirlo.
      for (const [s, id] of Object.entries(prev)) {
        if (id !== playerId) next[s] = id
      }
      next[slot] = playerId
      return next
    })
    setPicking(null)
    setSearch("")
  }

  function clearSlot(slot: SlotId) {
    setLineup((prev) => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }

  function clearAll() {
    setLineup({})
  }

  const placedCount = Object.keys(lineup).length

  return (
    <section className="mt-10">
      {/* Aquí se elige cómo acomodar al equipo o se quitan todos de la cancha. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          Arma tu 11 <span className="text-muted-foreground">({placedCount}/11)</span>
        </h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
            {Object.keys(FORMATIONS).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormation(f as keyof typeof FORMATIONS)}
                aria-pressed={formation === f}
                className={
                  formation === f
                    ? "rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                    : "rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted"
                }
              >
                {f}
              </button>
            ))}
          </div>
          {placedCount > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Se elige al técnico por separado porque no juega en uno de los once lugares. */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-yellow-300 bg-yellow-50 p-3">
        <div className="flex items-center gap-3">
          {coachId != null && playersById.get(coachId) ? (
            <PlayerAvatar player={playersById.get(coachId)!} size={48} ring />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-yellow-500 bg-yellow-100 text-xl font-bold text-yellow-700">+</span>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800">Técnico</p>
            <p className="text-sm font-medium text-yellow-950">{coachId != null && playersById.get(coachId) ? playersById.get(coachId)?.name : "Selecciona un técnico"}</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setPicking("coach")}>
          {coachId != null ? "Cambiar" : "Agregar técnico"}
        </Button>
      </div>

      {/* Dibuja la cancha y muestra los lugares donde se pueden poner los jugadores. */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-700/40 bg-emerald-600 p-2 shadow-inner sm:p-4">
        {/* Las líneas blancas hacen que el fondo verde se parezca a una cancha real. */}
        <div className="pointer-events-none absolute inset-0">
          {/* franjas de césped */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgba(255,255,255,0.05)_40px,rgba(255,255,255,0.05)_80px)]" />
          {/* círculo central */}
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
          {/* línea media */}
          <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-white/30" />
          {/* área arriba */}
          <div className="absolute left-1/2 top-0 h-12 w-40 -translate-x-1/2 border-2 border-t-0 border-white/30" />
          {/* área abajo */}
          <div className="absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 border-2 border-b-0 border-white/30" />
        </div>

        <div className="relative flex min-h-[420px] flex-col justify-between gap-1 py-2 sm:min-h-[520px] sm:gap-2">
          {rows.map((count, rowIndex) => (
            <div key={rowIndex} className="flex items-center justify-evenly gap-2">
              {Array.from({ length: count }).map((_, colIndex) => {
                const id = slotId(rowIndex, colIndex)
                const playerId = lineup[id]
                const player = playerId != null ? playersById.get(playerId) : undefined
                return (
                  <Slot
                    key={id}
                    player={player}
                    onClick={() => setPicking(id)}
                    onClear={() => clearSlot(id)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Esta ventana permite buscar un jugador y ponerlo en el lugar elegido. */}
      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Elegir jugador"
          onClick={() => {
            setPicking(null)
            setSearch("")
          }}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-base font-semibold text-card-foreground">{picking === "coach" ? "Elegir técnico" : "Elegir jugador"}</h3>
              <button
                type="button"
                onClick={() => {
                  setPicking(null)
                  setSearch("")
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar jugador..."
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {availablePlayers.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No hay jugadores.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {availablePlayers.map((p) => {
                    const used = usedIds.has(p.id)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => assign(picking, p.id)}
                          className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                        >
                          <PlayerAvatar player={p} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-card-foreground">{p.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{p.team}</span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${POSITION_COLORS[p.position]}`}
                          >
                            {p.position}
                          </span>
                          {used && <span className="shrink-0 text-[10px] text-muted-foreground">en cancha</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Slot({
  player,
  onClick,
  onClear,
}: {
  player?: Player
  onClick: () => void
  onClear: () => void
}) {
  // Si el lugar está vacío, el signo más permite elegir a alguien.
  if (!player) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-1"
        aria-label="Agregar jugador"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-white/60 bg-white/10 text-lg font-bold text-white/80 transition hover:bg-white/20 sm:h-14 sm:w-14">
          +
        </span>
      </button>
    )
  }
  // Si ya hay alguien, se puede cambiar por otro o quitarlo con la X.
  return (
    <div className="group flex flex-col items-center gap-1">
      <div className="relative">
        <button type="button" onClick={onClick} aria-label={`Cambiar ${player.name}`}>
          <PlayerAvatar player={player} size={56} ring />
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Quitar ${player.name}`}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <span className="max-w-[58px] truncate rounded bg-black/40 px-1 py-0.5 text-[9px] font-medium text-white sm:max-w-[72px] sm:px-1.5 sm:text-[10px]">
        {player.name}
      </span>
    </div>
  )
}

function PlayerAvatar({ player, size, ring }: { player: Player; size: number; ring?: boolean }) {
  // Muestra la foto del jugador; si no tiene, muestra la primera letra de su nombre.
  const cls = ring
    ? "rounded-full object-cover ring-2 ring-white shadow-md"
    : "rounded-full object-cover"
  if (player.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.photo || "/placeholder.svg"}
        alt={player.name}
        width={size}
        height={size}
        className={cls}
        style={{ width: size, height: size }}
        crossOrigin="anonymous"
      />
    )
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground ${ring ? "ring-2 ring-white shadow-md" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {player.name.charAt(0).toUpperCase()}
    </span>
  )
}
