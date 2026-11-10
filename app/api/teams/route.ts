// app/api/: reúne rutas del servidor; esta ruta busca equipos de fútbol para el formulario.
import { NextResponse } from "next/server"
import type { Team } from "@/lib/types"

const SOCCER_LEAGUES = [
  "eng.1",
  "esp.1",
  "ita.1",
  "ger.1",
  "fra.1",
  "ned.1",
  "por.1",
  "mex.1",
  "arg.1",
  "bra.1",
  "usa.1",
  "col.1",
  "uefa.champions",
] as const

type EspnTeam = {
  id?: string
  displayName?: string
  logos?: { href?: string }[]
}

type EspnLeagueResponse = {
  sports?: {
    leagues?: {
      name?: string
      teams?: { team?: EspnTeam }[]
    }[]
  }[]
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
}

async function fetchLeague(leagueId: string): Promise<Team[]> {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams`,
    { next: { revalidate: 60 * 60 } },
  )
  if (!response.ok) throw new Error(`ESPN respondió con estado ${response.status} para ${leagueId}.`)

  const data = (await response.json()) as EspnLeagueResponse
  const league = data.sports?.[0]?.leagues?.[0]
  return (league?.teams ?? []).flatMap(({ team }) => {
    if (!team?.id || !team.displayName) return []
    return [{
      id: team.id,
      name: team.displayName,
      league: league?.name ?? "",
      badge: team.logos?.[0]?.href ?? "",
    }]
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") || "").trim()

  if (query.length < 2) return NextResponse.json([])

  const results = await Promise.allSettled(SOCCER_LEAGUES.map(fetchLeague))
  const successfulResults = results.filter(
    (result): result is PromiseFulfilledResult<Team[]> => result.status === "fulfilled",
  )

  if (successfulResults.length === 0) {
    console.error("No se pudieron consultar equipos en ninguna liga de ESPN.", results)
    return NextResponse.json({ error: "No se pudo conectar con el servicio de equipos. Inténtalo de nuevo." }, { status: 502 })
  }

  const normalizedQuery = normalize(query)
  const teamsById = new Map<string, Team>()
  for (const result of successfulResults) {
    for (const team of result.value) {
      if (normalize(team.name).includes(normalizedQuery)) teamsById.set(team.id, team)
    }
  }

  return NextResponse.json([...teamsById.values()].slice(0, 20))
}
