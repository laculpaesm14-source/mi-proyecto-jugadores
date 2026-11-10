// app/: contiene la pantalla principal; data/: guarda el JSON de jugadores de ejemplo que esta página carga.
"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import type { Session } from "@supabase/supabase-js"
import { Activity, AlertTriangle, ArrowUpRight, Download, FileJson, Globe2, LogOut, Search, ShieldCheck, Sparkles, Trophy, Upload, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerForm } from "@/components/player-form"
import { PlayersTable } from "@/components/players-table"
import { LineupBuilder } from "@/components/lineup-builder"
import { AuthForm } from "@/components/auth-form"
import { fromPlayerRecord, getSupabaseBrowserClient, getSupabaseConfigMessage, toPlayerRecord, type PlayerRecord } from "@/lib/supabase"
import { POSITIONS, type Country, type Player, type Position, type Team } from "@/lib/types"

type NavItem = "players" | "form" | "lineup" | "json"
type ImportedPlayer = Omit<Player, "id"> & { id?: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

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
    if (["id", "identificacion", "identification", "documento", "document"].includes(key)
      && Object.keys(currentRecord).length > 0) {
      records.push(currentRecord)
      currentRecord = {}
    }
    if (key) currentRecord[key] = value
  }
  if (Object.keys(currentRecord).length > 0) records.push(currentRecord)

  if (records.length === 0) {
    throw new Error("El archivo TXT está vacío o no tiene datos de jugadores que pueda reconocer.")
  }

  return records
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
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient>>(null)
  const [supabaseReady, setSupabaseReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [deletedPlayers, setDeletedPlayers] = useState<Player[]>([])
  const [editing, setEditing] = useState<Player | null>(null)
  const [search, setSearch] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const [databaseError, setDatabaseError] = useState("")
  const [showJson, setShowJson] = useState(false)
  const [importMessage, setImportMessage] = useState("")
  const [activeNav, setActiveNav] = useState<NavItem>("players")

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient())
    setSupabaseReady(true)
  }, [])

  useEffect(() => {
    if (!supabase) {
      if (supabaseReady) setAuthLoading(false)
      return
    }

    setAuthLoading(true)
    let active = true
    const recoveryHash = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"
    const recoveryQuery = new URLSearchParams(window.location.search).get("type") === "recovery"
    if (recoveryHash || recoveryQuery) setPasswordRecovery(true)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true)
      setSession(nextSession)
      setLoaded(false)
      setDatabaseError("")
    })

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setDatabaseError(error.message)
        setSession(data.session)
        setAuthLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setDatabaseError(error instanceof Error ? error.message : "No se pudo consultar la sesión.")
        setAuthLoading(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase, supabaseReady])

  // Pinta distinto el botón de la parte de la página que se está viendo.
  function navButtonClass(item: NavItem) {
    return activeNav === item
      ? "shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
      : "shrink-0 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
  }

  // Carga exclusivamente los datos de la cuenta desde Supabase.
  useEffect(() => {
    if (!supabase || !session) {
      setLoaded(false)
      setPlayers([])
      setDeletedPlayers([])
      return
    }

    const client = supabase
    const userId = session.user.id
    let cancelled = false
    async function loadPlayers() {
      setLoaded(false)
      setDatabaseError("")
      try {
        const { data, error } = await client
          .from("players")
          .select("*")
          .eq("user_id", userId)
          .order("id")
        if (error) throw error

        const records = (data ?? []) as PlayerRecord[]

        const activeRecords = records.filter((record) => !record.is_deleted)
        const resolvedPlayers = await resolvePlayerAssets(activeRecords.map(fromPlayerRecord))
        const resolvedById = new Map(resolvedPlayers.map((player) => [player.id, player]))
        const changedRecords = activeRecords.flatMap((record) => {
          const player = fromPlayerRecord(record)
          const resolved = resolvedById.get(player.id)
          if (!resolved || (
            resolved.nationalityCode === player.nationalityCode
            && resolved.teamBadge === player.teamBadge
          )) return []
          return [toPlayerRecord(resolved, userId)]
        })

        if (changedRecords.length > 0) {
          const { error: assetsError } = await client
            .from("players")
            .upsert(changedRecords, { onConflict: "user_id,id" })
          if (assetsError) throw assetsError
        }

        if (cancelled) return
        const deleted = records.filter((record) => record.is_deleted).map(fromPlayerRecord)
        setPlayers(resolvedPlayers)
        setDeletedPlayers(deleted)
        setLoaded(true)
      } catch (error) {
        if (cancelled) return
        setDatabaseError(error instanceof Error ? error.message : "No se pudieron cargar los jugadores.")
      }
    }

    void loadPlayers()
    return () => {
      cancelled = true
    }
  }, [supabase, session, reloadCount])

  // Mantiene abiertas las demás sesiones del mismo usuario al día.
  useEffect(() => {
    if (!supabase || !session || !loaded) return

    const channel = supabase
      .channel(`players-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `user_id=eq.${session.user.id}`,
        },
        async () => {
          const { data, error } = await supabase
            .from("players")
            .select("*")
            .eq("user_id", session.user.id)
            .order("id")
          if (error) {
            setDatabaseError(error.message)
            return
          }
          const records = (data ?? []) as PlayerRecord[]
          setPlayers(records.filter((record) => !record.is_deleted).map(fromPlayerRecord))
          setDeletedPlayers(records.filter((record) => record.is_deleted).map(fromPlayerRecord))
          setDatabaseError("")
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setDatabaseError("No se pudo activar la sincronización en tiempo real de Supabase.")
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, session, loaded])

  async function signOut() {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setDatabaseError(error.message)
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : "No se pudo cerrar la sesión.")
    }
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
      let source: unknown[] | undefined

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
        } else if (isRecord(importedJson)) {
          const recordsProperty = Object.entries(importedJson).find(([key, value]) =>
            ["players", "jugadores", "data"].includes(normalizeLookupName(key)) && Array.isArray(value),
          )
          if (recordsProperty && Array.isArray(recordsProperty[1])) source = recordsProperty[1]
        } else {
          throw new Error("El archivo JSON debe contener una lista de jugadores.")
        }
      }
      if (!source) throw new Error("El archivo JSON/TXT debe contener una lista de jugadores o registros.")

      // Revisa que las posiciones del archivo sean las que entiende esta página.
      const normalizedSource: ImportedPlayer[] = source.map((value, index) => {
        if (!isRecord(value)) {
          throw new Error(`El registro ${index + 1} no contiene los datos de un jugador.`)
        }

        const fields = new Map(Object.entries(value).map(([key, fieldValue]) => [normalizeLookupName(key), fieldValue]))
        const readField = (...names: string[]) => names
          .map((name) => fields.get(normalizeLookupName(name)))
          .find((fieldValue) => fieldValue !== undefined && fieldValue !== null)
        const position = normalizePosition(readField("position", "posicion"))
        if (!position) {
          const fieldName = readField("name", "nombre")
          const name = typeof fieldName === "string" && fieldName ? fieldName : "un jugador"
          throw new Error(`Posición no reconocida para ${name}.`)
        }

        const idValue = readField("id", "identificacion", "identification", "documento", "document")
        const name = String(readField("name", "nombre") ?? "").trim()
        const nationality = String(readField("nationality", "nacionalidad", "pais", "country") ?? "").trim()
        const team = String(readField("team", "equipo", "club") ?? "").trim()
        const age = Number(readField("age", "edad"))
        const id = idValue == null || String(idValue).trim() === "" ? undefined : Number(idValue)
        if (!name || !nationality || !team || !Number.isInteger(age) || age < 15 || age > 50) {
          throw new Error(`Revisa los datos del jugador ${name || `del registro ${index + 1}`}.`)
        }
        if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) {
          throw new Error(`La identificación del registro ${index + 1} debe ser un entero positivo.`)
        }

        return {
          id,
          name,
          photo: String(readField("photo", "foto", "imagen", "image") ?? ""),
          nationality,
          nationalityCode: String(readField("nationalityCode", "codigoNacionalidad", "nationality_code") ?? "").trim().toLowerCase(),
          team,
          teamBadge: String(readField("teamBadge", "escudo", "team_badge") ?? "").trim(),
          position,
          age,
        }
      })
      // Si el archivo no trae número para alguien, le asigna uno nuevo.
      const explicitIds = normalizedSource.filter((player) => player.id != null).map((player) => Number(player.id))
      let nextId = Math.max(0, ...players.map((player) => player.id), ...deletedPlayers.map((player) => player.id), ...explicitIds) + 1
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
      const uniquePlayers = new Map<number, Player>()
      for (const player of importedPlayers) uniquePlayers.set(player.id, player)
      const duplicateCount = importedPlayers.length - uniquePlayers.size
      const playersWithAssets = await resolvePlayerAssets([...uniquePlayers.values()])

      // Si un número ya está en la lista, lo reemplaza con los datos del archivo nuevo.
      const mergedPlayers = new Map(players.map((player) => [player.id, player]))
      for (const player of playersWithAssets) mergedPlayers.set(player.id, player)
      const nextPlayers = [...mergedPlayers.values()]
      if (!supabase || !session) throw new Error("Inicia sesión antes de importar jugadores.")
      const { error } = await supabase
        .from("players")
        .upsert(playersWithAssets.map((player) => toPlayerRecord(player, session.user.id)), {
          onConflict: "user_id,id",
        })
      if (error) throw error
      setPlayers(nextPlayers)
      setDeletedPlayers((previous) => previous.filter(
        (deletedPlayer) => !playersWithAssets.some((player) => player.id === deletedPlayer.id),
      ))
      setImportMessage(
        `${playersWithAssets.length} jugadores importados o actualizados. Total en la lista: ${nextPlayers.length}.`
        + (duplicateCount > 0 ? ` Se omitieron ${duplicateCount} identificaciones repetidas del archivo.` : ""),
      )
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
  async function handleSave(values: Omit<Player, "id"> & { id?: number }) {
    if (!supabase || !session) throw new Error("Inicia sesión para guardar jugadores.")
    if (editing) {
      const id = editing.id
      const { id: _ignoredId, ...playerValues } = values
      const player = { id, ...playerValues }
      const { error } = await supabase
        .from("players")
        .upsert(toPlayerRecord(player, session.user.id), { onConflict: "user_id,id" })
      if (error) throw error
      setPlayers((prev) => prev.map((current) => (current.id === id ? player : current)))
      setEditing(null)
      return
    }

    const nextId = values.id ?? Math.max(0, ...players.map((player) => player.id), ...deletedPlayers.map((player) => player.id)) + 1
    if (players.some((player) => player.id === nextId)) {
      throw new Error(`El ID ${nextId} ya existe.`)
    }
    const { id: _playerId, ...playerValues } = values
    const player = { id: nextId, ...playerValues }
    const { error } = await supabase
      .from("players")
      .upsert(toPlayerRecord(player, session.user.id), { onConflict: "user_id,id" })
    if (error) throw error
    setPlayers((prev) => [...prev, player])
    setDeletedPlayers((prev) => prev.filter((player) => player.id !== nextId))
  }

  function requestDelete(id: number) {
    // Busca al jugador elegido y muestra el aviso antes de borrarlo.
    const target = players.find((p) => p.id === id) ?? null
    setDeleteTarget(target)
    setDeletePhase("countdown")
    setCountdown(5)
  }

  const [deleteBusy, setDeleteBusy] = useState(false)

  async function confirmDelete() {
    if (!deleteTarget || !supabase || !session) return
    const id = deleteTarget.id
    setDeleteBusy(true)
    setDatabaseError("")
    try {
      const { error } = await supabase
        .from("players")
        .update({ is_deleted: true })
        .eq("user_id", session.user.id)
        .eq("id", id)
      if (error) throw error
      setPlayers((prev) => prev.filter((player) => player.id !== id))
      setDeletedPlayers((prev) => [deleteTarget, ...prev.filter((player) => player.id !== id)])
      if (editing?.id === id) setEditing(null)
      setDeleteTarget(null)
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : "No se pudo eliminar el jugador.")
    } finally {
      setDeleteBusy(false)
    }
  }

  function cancelDelete() {
    // Cierra el aviso sin borrar al jugador.
    setDeleteTarget(null)
  }

  // Lleva suavemente a la parte de la página que se eligió en el menú.
  function goToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (!supabaseReady) {
    return <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Iniciando la aplicación...</main>
  }

  if (!supabase) {
    const configMessage = getSupabaseConfigMessage()
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
        <section className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold text-card-foreground">Configura la conexión a Supabase</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {configMessage ?? "Copia .env.example a .env.local y completa la URL y la clave publicable desde la sección API de tu proyecto Supabase. Luego reinicia el servidor de desarrollo."}
          </p>
        </section>
      </main>
    )
  }

  if (authLoading) {
    return <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Conectando con Supabase...</main>
  }

  if (passwordRecovery) {
    return (
      <AuthForm
        supabase={supabase}
        authError={databaseError}
        isPasswordRecovery
        onPasswordRecoveryComplete={() => setPasswordRecovery(false)}
      />
    )
  }

  if (!session) return <AuthForm supabase={supabase} authError={databaseError} />

  if (!loaded) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        {databaseError ? (
          <>
            <p className="max-w-lg text-sm text-destructive" role="alert">
              No se pudieron cargar los jugadores: {databaseError}
            </p>
            <Button type="button" onClick={() => setReloadCount((count) => count + 1)}>Reintentar</Button>
          </>
        ) : <p className="text-sm text-muted-foreground">Cargando tus jugadores...</p>}
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-background to-stone-100">
      {/* Nombre de la página y botones para ir a Jugadores, agregar, armar el equipo o ver el archivo. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-emerald-950 text-white shadow-lg shadow-emerald-950/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-emerald-950 shadow-lg shadow-lime-950/15">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight sm:text-lg">Gestor de Jugadores</h1>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.17em] text-emerald-100/65">Centro de gestión deportiva</p>
            </div>
          </div>
          <nav className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap" aria-label="Navegación principal">
            <Button type="button" size="sm" onClick={() => { setActiveNav("players"); goToSection("players-section") }} className={`${navButtonClass("players")} min-w-0 justify-start px-2 text-xs sm:w-auto sm:justify-center sm:px-3 sm:text-sm`}>
              <Users className="mr-1.5 h-4 w-4 shrink-0" /> <span className="whitespace-normal text-left leading-tight sm:text-center">Jugadores</span>
            </Button>
            <Button type="button" size="sm" onClick={() => { setActiveNav("form"); goToSection("player-form") }} className={`${navButtonClass("form")} min-w-0 justify-start px-2 text-xs sm:w-auto sm:justify-center sm:px-3 sm:text-sm`}>
              <UserPlus className="mr-1.5 h-4 w-4 shrink-0" /> <span className="whitespace-normal text-left leading-tight sm:text-center">Agregar jugador</span>
            </Button>
            <Button type="button" size="sm" onClick={() => { setActiveNav("lineup"); goToSection("lineup-section") }} className={`${navButtonClass("lineup")} min-w-0 justify-start px-2 text-xs sm:w-auto sm:justify-center sm:px-3 sm:text-sm`}>
              <Trophy className="mr-1.5 h-4 w-4 shrink-0" /> <span className="whitespace-normal text-left leading-tight sm:text-center">Armar el 11</span>
            </Button>
            <Button type="button" size="sm" onClick={() => { setActiveNav("json"); setShowJson(true); goToSection("json-tools-title") }} className={`${navButtonClass("json")} min-w-0 justify-start px-2 text-xs sm:w-auto sm:justify-center sm:px-3 sm:text-sm`}>
              <FileJson className="mr-1.5 h-4 w-4 shrink-0" /> <span className="whitespace-normal text-left leading-tight sm:text-center">Ver JSON</span>
            </Button>
          </nav>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="hidden max-w-40 truncate sm:inline" title={session.user.email ?? ""}>
              {session.user.email}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => void signOut()} className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <LogOut className="mr-1.5 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {databaseError && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
            {databaseError}
          </p>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 sm:pt-10">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-950 via-emerald-800 to-green-700 px-6 py-7 text-white shadow-xl shadow-emerald-950/15 sm:px-9 sm:py-9">
          <div aria-hidden="true" className="absolute -right-10 -top-24 -z-10 h-72 w-72 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-2 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute bottom-0 right-0 -z-10 h-44 w-44 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-50">
                <Sparkles className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />
                Bienvenido a tu espacio deportivo
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Tu equipo, en un solo lugar.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75 sm:text-base">
                Administra jugadores, arma tu once ideal y mantén la plantilla sincronizada en la nube.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => { setActiveNav("form"); goToSection("player-form") }}
              className="h-11 shrink-0 rounded-xl bg-lime-300 px-5 font-semibold text-emerald-950 shadow-lg shadow-emerald-950/20 hover:bg-lime-200"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Agregar jugador
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-5 text-xs font-medium text-emerald-50/75">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-lime-300" />Datos protegidos por cuenta</span>
            <span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-lime-300" />Sincronización en tiempo real</span>
          </div>
        </div>
      </section>

      {/* Muestra un resumen: cuántos jugadores hay, sus edades, sus países y sus equipos. */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="group rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm shadow-emerald-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Jugadores</p>
              <span className="rounded-xl bg-emerald-100 p-2 text-emerald-800"><Users className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-emerald-950">{stats.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">en tu plantilla</p>
          </div>
          <div className="group rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-sm shadow-emerald-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Edad promedio</p>
              <span className="rounded-xl bg-amber-100 p-2 text-amber-800"><Activity className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-emerald-950">{stats.avgAge}</p>
            <p className="mt-1 text-xs text-muted-foreground">años</p>
          </div>
          <div className="group rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm shadow-emerald-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Países</p>
              <span className="rounded-xl bg-sky-100 p-2 text-sky-800"><Globe2 className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-emerald-950">{stats.countries}</p>
            <div className="mt-1 space-y-0.5 text-xs leading-4 text-muted-foreground">
              {stats.topCountries.length > 0 ? stats.topCountries.map(({ country, count }) => (
                <p key={country} className="truncate">{country}: {count}</p>
              )) : <p>Sin datos</p>}
            </div>
          </div>
          <div className="group rounded-2xl border border-violet-100 bg-white/90 p-4 shadow-sm shadow-emerald-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Equipos</p>
              <span className="rounded-xl bg-violet-100 p-2 text-violet-800"><Trophy className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-emerald-950">{stats.teams}</p>
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
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_370px]">
        <section id="players-section" className="min-w-0 scroll-mt-28 rounded-[1.5rem] border border-white bg-white/80 p-4 shadow-sm shadow-emerald-950/[0.04] sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Plantilla</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight text-emerald-950">
                Jugadores <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">{filtered.length}</span>
              </h2>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, equipo, país o ID"
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
      <div id="lineup-section" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-12 sm:px-6">
        <LineupBuilder players={players} supabase={supabase} userId={session.user.id} />
      </div>

      {/* Permite ver la lista completa, cargar una lista guardada o descargar una copia. */}
      <section id="json-section" className="mx-auto mb-10 max-w-7xl scroll-mt-28 px-4 sm:px-6" aria-labelledby="json-tools-title">
        <div className="rounded-[1.5rem] border border-white bg-white/85 p-5 shadow-sm shadow-emerald-950/[0.04] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="json-tools-title" className="font-semibold text-card-foreground">Archivos de jugadores</h2>
              <p className="text-sm text-muted-foreground">Visualiza, importa y exporta los registros de tu cuenta de Supabase.</p>
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
                  <Button type="button" onClick={() => void confirmDelete()} disabled={deleteBusy} className="bg-destructive text-white hover:bg-destructive/90">
                    {deleteBusy ? "Eliminando..." : "Sí, eliminar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
