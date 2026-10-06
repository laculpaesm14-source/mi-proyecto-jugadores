import { NextResponse } from "next/server"
import type { Team } from "@/lib/types"

type SportsDbTeam = {
  idTeam: string
  strTeam: string
  strLeague: string | null
  strSport: string | null
  strBadge: string | null
}

// Busca equipos de fútbol que se parezcan al nombre escrito.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") || "").trim()

  // Espera a que se escriban dos letras para empezar la búsqueda.
  if (query.length < 2) {
    return NextResponse.json([])
  }

  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(query)}`,
      { next: { revalidate: 60 * 60 } },
    )

    if (!res.ok) {
      return NextResponse.json({ error: "No se pudieron cargar los equipos" }, { status: 502 })
    }

    // La lista recibida puede tener equipos de otros deportes.
    const data = (await res.json()) as { teams: SportsDbTeam[] | null }

    // Deja solo equipos de fútbol y prepara sus nombres, ligas y escudos.
    const teams: Team[] = (data.teams || [])
      .filter((t) => t.strSport === "Soccer")
      .map((t) => ({
        id: t.idTeam,
        name: t.strTeam,
        league: t.strLeague || "",
        badge: t.strBadge ? `${t.strBadge}/tiny` : "",
      }))

    return NextResponse.json(teams)
  } catch {
    // Avisa que no se pudo encontrar equipos en este momento.
    return NextResponse.json({ error: "Error al cargar los equipos" }, { status: 500 })
  }
}
