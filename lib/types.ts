export type Position = "arquero" | "defensa" | "medio campo" | "delantero" | "tecnico"

// Lista de posiciones que se puede elegir para cada jugador.
export const POSITIONS: { value: Position; label: string }[] = [
  { value: "arquero", label: "Arquero" },
  { value: "defensa", label: "Defensa" },
  { value: "medio campo", label: "Medio campo" },
  { value: "delantero", label: "Delantero" },
  { value: "tecnico", label: "Técnico" },
]

// Elige el color que tendrá la etiqueta de cada posición.
export const POSITION_COLORS: Record<Position, string> = {
  arquero: "bg-violet-100 text-violet-800 ring-1 ring-violet-300",
  defensa: "bg-blue-100 text-blue-800 ring-1 ring-blue-300",
  "medio campo": "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300",
  delantero: "bg-rose-100 text-rose-800 ring-1 ring-rose-300",
  tecnico: "bg-yellow-200 text-yellow-900 ring-1 ring-yellow-400",
}

export const MIN_AGE = 15
export const MAX_AGE = 50

// Información que se guarda sobre cada jugador.
export type Player = {
  id: number
  name: string
  photo: string
  nationality: string
  nationalityCode: string
  team: string
  teamBadge: string
  position: Position
  age: number
}

// Nombre del país y la imagen de su bandera.
export type Country = {
  code: string
  name: string
  flag: string
}

// Nombre del equipo, su liga y la imagen de su escudo.
export type Team = {
  id: string
  name: string
  league: string
  badge: string
}
