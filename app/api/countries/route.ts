import { NextResponse } from "next/server"
import type { Country } from "@/lib/types"

// Prepara la lista de países para que se pueda elegir uno en el formulario.
export async function GET() {
  try {
    const res = await fetch("https://flagcdn.com/es/codes.json", {
      // Guarda esta lista por un día, porque los países casi nunca cambian.
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "No se pudieron cargar los paises" }, { status: 502 })
    }

    // Recibe los nombres de países y prepara la lista que verá la persona.
    const data = (await res.json()) as Record<string, string>

    // Quita las regiones que no son países, añade sus banderas
    // y ordena la lista por nombre para que sea fácil encontrar un país.
    const countries: Country[] = Object.entries(data)
      .filter(([code]) => code.length === 2)
      .map(([code, name]) => ({
        code,
        name,
        flag: `https://flagcdn.com/w40/${code}.png`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"))

    return NextResponse.json(countries)
  } catch {
    // Avisa que no se pudo cargar la lista de países.
    return NextResponse.json({ error: "Error al cargar los paises" }, { status: 500 })
  }
}
