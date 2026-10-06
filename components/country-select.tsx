"use client"

import useSWR from "swr"
import Image from "next/image"
import type { Country } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Al elegir un país, informa su nombre y permite mostrar su bandera.
type Props = {
  value: string
  onChange: (name: string, code: string) => void
  id?: string
}

export function CountrySelect({ value, onChange, id }: Props) {
  // Carga la lista de países para llenar el menú donde se elige uno.
  const { data, isLoading, error } = useSWR<Country[]>("/api/countries", fetcher, {
    revalidateOnFocus: false,
  })

  const countries = Array.isArray(data) ? data : []
  const selected = countries.find((c) => c.name === value)

  return (
    <div className="flex items-center gap-2">
      {/* Muestra la bandera elegida; si todavía no hay país, muestra dos guiones. */}
      <div className="flex h-9 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
        {selected ? (
          <Image
            src={selected.flag || "/placeholder.svg"}
            alt={`Bandera de ${selected.name}`}
            width={40}
            height={30}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </div>
      {/* Muestra los países disponibles y avisa si la lista no pudo cargarse. */}
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const country = countries.find((c) => c.name === e.target.value)
          onChange(e.target.value, country?.code ?? "")
        }}
        disabled={isLoading || !!error}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        <option value="">
          {isLoading ? "Cargando países…" : error ? "Error al cargar países" : "Selecciona un país"}
        </option>
        {countries.map((c) => (
          <option key={c.code} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
