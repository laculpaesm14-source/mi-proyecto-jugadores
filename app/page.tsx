"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { AlertTriangle, Download, FileJson, Search, Trophy, Upload, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerForm } from "@/components/player-form"
import { PlayersTable } from "@/components/players-table"
import { LineupBuilder } from "@/components/lineup-builder"
import { POSITIONS, type Country, type Player, type Position, type Team } from "@/lib/types"
import starterPlayers from "@/data/players.json"

// El navegador usa estos nombres para recordar la lista, incluso después de cerrar la página.
const STORAGE_KEY = "gestor-jugadores-local:v2"
const LEGACY_STORAGE_KEY = "gestor-jugadores-local:v1"
const DELETED_PLAYERS_KEY = "gestor-jugadores-eliminados:v1"

// Si todavía no se ha guardado ningún jugador, la página empieza con estos ejemplos.
const INITIAL_PLAYERS: Player[] = starterPlayers.map((player, index) => ({
  id: index + 1,
  ...player,
  nationalityCode: "",
  teamBadge: "",
  position: player.position as Position,
}))

type NavItem = "players" | "form" | "lineup" | "json"

// Ayuda a reconocer el mismo nombre aunque alguien lo escriba con tildes
// o con letras mayúsculas y minúsculas diferentes.
function normalizeLookupName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function normalizePosition(value: unknown): Position | null {
  const normalized = normalizeLookupName(String(value ?? ""))
  const position = POSITIONS.find((item) =>
    normalizeLookupName(item.value) === normalized || normalizeLookupName(item.label) === normalized,
  )
  if (position) return position.value

  // También reconoce otros nombres comunes de las posiciones al cargar una lista.
  const aliases: Record<string, Position> = {
    portero: "arquero",
    goalkeeper: "arquero",
    keeper: "arquero",
    defender: "defensa",
    defensa: "defensa",
    midfielder: "medio campo",
    midfield: "medio campo",
    mediocampista: "medio campo",
    centrocampista: "medio campo",
    forward: "delantero",
    striker: "delantero",
    atacante: "delantero",
    entrenador: "tecnico",
    coach: "tecnico",
    manager: "tecnico",
  }
  return aliases[normalized] ?? null
}

// Lee un archivo de texto sencillo, con datos escritos como "Nombre: ..." y "Equipo: ...".
function parseTextPlayers(text: string): Record<string, unknown>[] {
  const records: Record<string, string>[] = []
  let currentRecord: Record<string, string> = {}

  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator < 0) continue

    const key = normalizeLookupName(line.slice(0, separator))
    const value = line.slice(separator + 1).trim()
    if (key === "id" && currentRecord.id) {
      records.push(currentRecord)
      currentRecord = {}
    }
    if (key) currentRecord[key] = value
  }
  if (Object.keys(currentRecord).length > 0) records.push(currentRecord)

  if (records.length === 0) {
    throw new Error("El archivo TXT está vacío o no tiene datos de jugadores que pueda reconocer.")
  }

  return records.map((record) => {
    const id = Number(record.id)
    const age = Number(record.edad)
    const position = record.posicion
    const name = record.nombre
    const nationality = record.nacionalidad
    const team = record.equipo
    if (!Number.isInteger(id) || !name || !nationality || !team || !position || !Number.isFinite(age)) {
      throw new Error("Revisa el TXT: cada jugador debe tener ID, nombre, nacionalidad, equipo, posición y edad.")
    }
    return {
      id,
      name,
      nationality,
      team,
      position,
      age,
      photo: "",
      nationalityCode: "",
      teamBadge: "",
    }
  })
}

async function resolvePlayerAssets(players: Player[]) {
  // Prepara las banderas y los escudos para que se puedan mostrar junto a cada jugador.
  const resolvedPlayers = players.map((player) => ({
    ...player,
    nationalityCode: String(player.nationalityCode ?? "").trim().toLowerCase(),
    teamBadge: String(player.teamBadge ?? "").trim(),
  }))

  if (resolvedPlayers.some((player) => !player.nationalityCode)) {
    try {
      // Si falta una bandera, la busca usando el país escrito para ese jugador.
      const response = await fetch("/api/countries")
      if (response.ok) {
        const countries = (await response.json()) as Country[]
        const countryCodes = new Map(countries.map((country) => [normalizeLookupName(country.name), country.code]))
        for (const player of resolvedPlayers) {
          if (!player.nationalityCode) {
            player.nationalityCode = countryCodes.get(normalizeLookupName(player.nationality)) ?? ""
          }
        }
      }
    } catch {
      // Si no encuentra las banderas, no borra ni cambia a los jugadores.
    }
  }

  const teamsToResolve = [...new Set(
    resolvedPlayers.filter((player) => !player.teamBadge).map((player) => player.team.trim()).filter(Boolean),
  )]
  // Si falta el escudo de un equipo, intenta encontrarlo para mostrarlo en la lista.
  await Promise.all(teamsToResolve.map(async (teamName) => {
    try {
      const response = await fetch(`/api/teams?q=${encodeURIComponent(teamName)}`)
      if (!response.ok) return
      const teams = (await response.json()) as Team[]
      const normalizedTeamName = normalizeLookupName(teamName)
      const match = teams.find((team) => normalizeLookupName(team.name) === normalizedTeamName)
        ?? teams.find((team) => normalizedTeamName.length >= 5 && normalizeLookupName(team.name).includes(normalizedTeamName))
      if (match?.badge) {
        for (const player of resolvedPlayers) {
          if (!player.teamBadge && normalizeLookupName(player.team) === normalizedTeamName) {
            player.teamBadge = match.badge
          }
        }
      }
    } catch {
      // Si no encuentra los escudos, no borra ni cambia a los jugadores.
    }
  }))

  return resolvedPlayers
}

export default function Page() {
  // Recuerda los jugadores y qué partes de la página están abiertas.
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS)
  const [deletedPlayers, setDeletedPlayers] = useState<Player[]>([])
  const hydratedPlayers = useRef<Player[]>(INITIAL_PLAYERS)
  const [editing, setEditing] = useState<Player | null>(null)
  const [search, setSearch] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [importMessage, setImportMessage] = useState("")
  const [activeNav, setActiveNav] = useState<NavItem>("players")

  // Pinta distinto el botón de la parte de la página que se está viendo.
  function navButtonClass(item: NavItem) {
    return activeNav === item
      ? "shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
      : "shrink-0 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
  }

  // Cuando se abre la página, busca los jugadores que se guardaron antes en este navegador.
  // También busca una lista guardada por una versión anterior para no perderla.
  useEffect(() => {
    try {
      const currentSaved = localStorage.getItem(STORAGE_KEY)
      const saved = currentSaved ?? localStorage.getItem(LEGACY_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Player[]
        if (Array.isArray(parsed)) {
          const restoredById = new Map(
            (currentSaved ? [] : INITIAL_PLAYERS).map((player) => [player.id, player]),
          )
          for (const { id, ...player } of parsed) {
            restoredById.set(id, {
              id,
              ...player,
              position: normalizePosition(player.position) ?? player.position,
            })
          }
          const restoredPlayers = [...restoredById.values()]
          hydratedPlayers.current = restoredPlayers
          setPlayers(restoredPlayers)
        }
      }
      const deletedSaved = localStorage.getItem(DELETED_PLAYERS_KEY)
      if (deletedSaved) {
        const parsedDeleted = JSON.parse(deletedSaved) as Player[]
        if (Array.isArray(parsedDeleted)) setDeletedPlayers(parsedDeleted)
      }
    } catch {
      // Si la lista guardada no se puede leer, deja los jugadores de ejemplo en pantalla.
    }
    setLoaded(true)
  }, [])

  // Después de abrir la lista, intenta completar las banderas y los escudos que falten.
  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    void resolvePlayerAssets(hydratedPlayers.current).then((resolvedPlayers) => {
      if (cancelled) return
      const resolvedById = new Map(resolvedPlayers.map((player) => [player.id, player]))
      setPlayers((currentPlayers) => currentPlayers.map((player) => {
        const resolved = resolvedById.get(player.id)
        if (!resolved) return player
        const nationalityCode = String(player.nationalityCode ?? "").trim().toLowerCase()
        const teamBadge = String(player.teamBadge ?? "").trim()
        const nextNationalityCode = nationalityCode || resolved.nationalityCode
        const nextTeamBadge = teamBadge || resolved.teamBadge
        if (nextNationalityCode === player.nationalityCode && nextTeamBadge === player.teamBadge) return player
        return { ...player, nationalityCode: nextNationalityCode, teamBadge: nextTeamBadge }
      }))
    })
    return () => {
      cancelled = true
    }
  }, [loaded])

  // Cada vez que cambia la lista, la guarda en el navegador para la próxima visita.
  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players))
  }, [players, loaded])

  // Recuerda por separado a los jugadores borrados para poder recuperarlos más tarde.
  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(DELETED_PLAYERS_KEY, JSON.stringify(deletedPlayers))
  }, [deletedPlayers, loaded])

  function saveLocalPlayers(nextPlayers: Player[]) {
    setPlayers(nextPlayers)
  }

  // Guarda la lista como JSON dentro de un archivo cuyo nombre termina en .json.txt.
  function downloadTextFile() {
    const content = JSON.stringify(players, null, 2)
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "jugadores.json.txt"
    link.click()
    URL.revokeObjectURL(url)
  }

  // Lee el archivo elegido y agrega sus jugadores a la lista que ya aparece en la página.
  async function importPlayersFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const fileText = await file.text()
      const isTextFile = file.name.toLowerCase().endsWith(".txt")
      let importedJson: unknown
      let source: unknown[]

      try {
        // Algunos archivos terminan en .txt, aunque su contenido sea una lista JSON.
        importedJson = JSON.parse(fileText)
      } catch (error) {
        if (!isTextFile) throw error
        source = parseTextPlayers(fileText)
      }

      if (importedJson !== undefined) {
        if (Array.isArray(importedJson)) {
          source = importedJson
        } else if (
          importedJson !== null &&
          typeof importedJson === "object" &&
          "players" in importedJson &&
          Array.isArray(importedJson.players)
        ) {
          source = importedJson.players
        } else {
          throw new Error("El archivo JSON debe contener una lista de jugadores.")
        }
      }

      // Revisa que las posiciones del archivo sean las que entiende esta página.
      const normalizedSource = source.map((player) => {
        const position = normalizePosition(player.position)
        if (!position) throw new Error(`Posición no reconocida para ${player.name || "un jugador"}.`)
        return { ...player, position }
      })
      // Si el archivo no trae número para alguien, le asigna uno nuevo.
      const explicitIds = normalizedSource.filter((player) => player.id != null).map((player) => Number(player.id))
      let nextId = Math.max(0, ...players.map((player) => player.id), ...explicitIds) + 1
      const importedPlayers: Player[] = normalizedSource.map((player) => {
        const { id, ...playerValues } = player
        return {
          id: Number(id ?? nextId++),
          ...playerValues,
          nationalityCode: String(player.nationalityCode ?? "").trim().toLowerCase(),
          teamBadge: String(player.teamBadge ?? "").trim(),
        }
      })

      // Comprueba que cada jugador tenga un número válido y que no se repita en el archivo.
      const ids = importedPlayers.map((player) => player.id)
      if (ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
        throw new Error("Cada jugador debe tener un ID entero y único.")
      }
      const playersWithAssets = await resolvePlayerAssets(importedPlayers)

      // Si un número ya está en la lista, lo reemplaza con los datos del archivo nuevo.
      const mergedPlayers = new Map(players.map((player) => [player.id, player]))
      for (const player of playersWithAssets) mergedPlayers.set(player.id, player)
      const nextPlayers = [...mergedPlayers.values()]
      setPlayers(nextPlayers)
      setDeletedPlayers((previous) => previous.filter(
        (deletedPlayer) => !playersWithAssets.some((player) => player.id === deletedPlayer.id),
      ))
      setImportMessage(`${playersWithAssets.length} registros importados. Total: ${nextPlayers.length}.`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No se pudo leer el archivo.")
    }
  }

  // Antes de borrar a alguien, espera cinco segundos y vuelve a preguntar para evitar errores.
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)
  const [deletePhase, setDeletePhase] = useState<"countdown" | "confirm">("countdown")
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (!deleteTarget || deletePhase !== "countdown") return
    if (countdown <= 0) {
      setDeletePhase("confirm")
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [deleteTarget, deletePhase, countdown])

  // Cuenta los jugadores, calcula su edad promedio y busca los tres países y equipos
  // que más se repiten en la lista.
  const stats = useMemo(() => {
    const total = players.length
    const avgAge = total ? Math.round(players.reduce((sum, p) => sum + p.age, 0) / total) : 0

    // Cuenta cuántos jugadores pertenecen a cada equipo.
    const teamCounts = new Map<string, number>()
    for (const player of players) {
      const team = player.team.trim()
      if (team) teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1)
    }
    const topTeams = [...teamCounts]
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team, "es"))
      .slice(0, 3)

    // Cuenta también los países para mostrar los tres que más aparecen.
    const counts = new Map<string, number>()
    for (const player of players) {
      const country = player.nationality.trim()
      if (country) counts.set(country, (counts.get(country) ?? 0) + 1)
    }
    const topCountries = [...counts]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, "es"))
      .slice(0, 3)
    return { total, avgAge, countries: counts.size, teams: teamCounts.size, topCountries, topTeams }
  }, [players])

  // Busca lo escrito en los nombres, equipos, países y números de la lista.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return players
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.nationality.toLowerCase().includes(q) ||
        String(p.id) === q,
    )
  }, [players, search])

  // Si se está editando, cambia los datos de ese jugador; si no, agrega uno nuevo.
  function handleSave(values: Omit<Player, "id"> & { id?: number }) {
    if (editing) {
      const id = editing.id
      const { id: _ignoredId, ...playerValues } = values
      setPlayers((prev) => prev.map((p) => (p.id === id ? { id, ...playerValues } : p)))
      setEditing(null)
      return
    }

    const nextId = values.id ?? Math.max(0, ...players.map((player) => player.id), ...deletedPlayers.map((player) => player.id)) + 1
    if (players.some((p) => p.id === nextId)) return
    const { id: _playerId, ...playerValues } = values
    setPlayers((prev) => [...prev, { id: nextId, ...playerValues }])
    setDeletedPlayers((prev) => prev.filter((player) => player.id !== nextId))
  }

  function requestDelete(id: number) {
    // Busca al jugador elegido y muestra el aviso antes de borrarlo.
    const target = players.find((p) => p.id === id) ?? null
    setDeleteTarget(target)
    setDeletePhase("countdown")
    setCountdown(5)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    // Lo quita de la lista actual, pero lo recuerda por si se quiere recuperar.
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    setDeletedPlayers((prev) => [deleteTarget, ...prev.filter((player) => player.id !== id)])
    if (editing?.id === id) setEditing(null)
    setDeleteTarget(null)
  }

  function cancelDelete() {
    // Cierra el aviso sin borrar al jugador.
    setDeleteTarget(null)
  }

  // Lleva suavemente a la parte de la página que se eligió en el menú.
  function goToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <main className="min-h-dvh">
      {/* Nombre de la página y botones para ir a Jugadores, agregar, armar el equipo o ver el archivo. */}
      <header className="sticky top-0 z-40 border-b border-border bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold leading-tight sm:text-xl">Gestor de Jugadores</h1>
          </div>
          <nav className="flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0" aria-label="Navegación principal">
            <Button type="button" size="sm" onClick={() => { setActiveNav("players"); goToSection("players-section") }} className={navButtonClass("players")}>
              <Users className="mr-1.5 h-4 w-4" /> Jugadores
            </Button>
            <Button type="button" size="sm" onClick={() => { setActiveNav("form"); goToSection("player-form") }} className={navButtonClass("form")}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Agregar jugador
            </Button>
            <Button type="button" size="sm" onClick={() => { setActiveNav("lineup"); goToSection("lineup-section") }} className={navButtonClass("lineup")}>
              <Trophy className="mr-1.5 h-4 w-4" /> Armar el 11
            </Button>
            <Button type="button" size="sm" onClick={() => { setActiveNav("json"); setShowJson(true); goToSection("json-tools-title") }} className={navButtonClass("json")}>
              <FileJson className="mr-1.5 h-4 w-4" /> Ver JSON
            </Button>
          </nav>
        </div>
      </header>

      {/* Muestra un resumen: cuántos jugadores hay, sus edades, sus países y sus equipos. */}
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jugadores</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Edad promedio</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">{stats.avgAge}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Países</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">{stats.countries}</p>
            <div className="mt-1 space-y-0.5 text-xs leading-4 text-muted-foreground">
              {stats.topCountries.length > 0 ? stats.topCountries.map(({ country, count }) => (
                <p key={country} className="truncate">{country}: {count}</p>
              )) : <p>Sin datos</p>}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipos</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">{stats.teams}</p>
            <div className="mt-1 space-y-0.5 text-xs leading-4 text-muted-foreground">
              {stats.topTeams.length > 0 ? stats.topTeams.map(({ team, count }) => (
                <p key={team} className="truncate">
                  {team}: {count}
                </p>
              )) : <p>Sin equipos registrados</p>}
            </div>
          </div>
        </div>
      </div>

      {/* En pantallas anchas, la lista queda a la izquierda y el formulario a la derecha.
          En pantallas angostas, uno aparece debajo del otro. */}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section id="players-section" className="min-w-0 scroll-mt-28">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              Jugadores <span className="text-muted-foreground">({filtered.length})</span>

            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, equipo, país o ID"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <PlayersTable players={filtered} onEdit={setEditing} onDelete={requestDelete} />
        </section>

        <aside className="min-w-0">
          <div id="player-form" className="scroll-mt-28">
          <PlayerForm
            editing={editing}
            existingIds={players.map((player) => player.id)}
            deletedPlayers={deletedPlayers}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
          </div>
        </aside>
      </div>

      {/* Aquí se escoge cómo acomodar al equipo y quién jugará en cada lugar de la cancha. */}
      <div id="lineup-section" className="mx-auto max-w-5xl scroll-mt-28 px-4 pb-12">
        <LineupBuilder players={players} />
      </div>

      {/* Permite ver la lista completa, cargar una lista guardada o descargar una copia. */}
      <section id="json-section" className="mx-auto mb-8 max-w-5xl scroll-mt-28 px-4" aria-labelledby="json-tools-title">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="json-tools-title" className="font-semibold text-card-foreground">Archivos de jugadores</h2>
              <p className="text-sm text-muted-foreground">Visualiza, importa y exporta los registros locales.</p>
            </div>
            <div className="flex flex-nowrap gap-2 overflow-x-auto">
              <Button type="button" variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => setShowJson((visible) => !visible)}>
                <FileJson className="mr-2 h-4 w-4" /> {showJson ? "Ocultar JSON" : "Ver JSON"}
              </Button>
              <label className="inline-flex h-9 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                <Upload className="mr-2 h-4 w-4" /> Importar JSON o TXT
                <input type="file" accept=".json,.txt,application/json,text/plain" className="sr-only" onChange={importPlayersFile} />
              </label>
              <Button type="button" variant="outline" className="shrink-0 whitespace-nowrap" onClick={downloadTextFile}>
                <Download className="mr-2 h-4 w-4" /> Descargar JSON.TXT
              </Button>
            </div>
          </div>
          {importMessage && <p className="mt-3 text-sm text-muted-foreground" role="status">{importMessage}</p>}
          {showJson && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100" aria-label="Registros en formato JSON">
              {JSON.stringify(players, null, 2)}
            </pre>
          )}
        </div>
      </section>

      {/* Este aviso da tiempo para cancelar y pregunta otra vez antes de borrar al jugador. */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 id="delete-dialog-title" className="text-base font-semibold text-card-foreground">Eliminar jugador</h2>
            </div>
            {deletePhase === "countdown" ? (
              <>
                <p className="text-sm text-muted-foreground">Estás a punto de eliminar a <span className="font-medium text-card-foreground">{deleteTarget.name}</span>.</p>
                <p className="mt-3 text-sm text-card-foreground">Podrás confirmar en <span className="font-mono font-semibold text-destructive">{countdown}</span> segundo{countdown === 1 ? "" : "s"}...</p>
                <div className="mt-6 flex justify-end"><Button type="button" variant="outline" onClick={cancelDelete}>Cancelar</Button></div>
              </>
            ) : (
              <>
                <p className="text-sm text-card-foreground">¿Seguro que deseas eliminar a <span className="font-medium">{deleteTarget.name}</span>? Esta acción no se puede deshacer.</p>
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={cancelDelete}>Cancelar</Button>
                  <Button type="button" onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">Sí, eliminar</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
