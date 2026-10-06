"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import Image from "next/image"
import type { Team } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Cuando se elige un equipo, permite mostrar también el escudo que le corresponde.
type Props = {
  value: string
  onChange: (name: string, badge: string) => void
  id?: string
}

export function TeamCombobox({ value, onChange, id }: Props) {
  // Recuerda lo escrito y si se deben mostrar los equipos encontrados.
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Espera a que la persona termine de escribir antes de buscar el equipo.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  // Cierra la lista de equipos cuando se hace clic fuera del buscador.
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  // Empieza a buscar cuando ya se escribieron al menos dos letras.
  const { data, isLoading } = useSWR<Team[]>(
    debounced.length >= 2 ? `/api/teams?q=${encodeURIComponent(debounced)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const teams = Array.isArray(data) ? data : []

  return (
    <div ref={containerRef} className="relative">
      {/* Al escribir un nombre nuevo, olvida el escudo anterior y busca coincidencias. */}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value, "")
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Escribe para buscar un equipo…"
        autoComplete="off"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {/* Muestra los equipos encontrados después de escribir al menos dos letras. */}
      {open && debounced.length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {isLoading && <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>}
          {!isLoading && teams.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados. Puedes escribir el nombre manualmente.
            </li>
          )}
          {teams.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  // Al elegir un equipo, lo pone en el formulario y cierra la lista.
                  onChange(t.name, t.badge)
                  setQuery(t.name)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {t.badge ? (
                  <Image
                    src={t.badge || "/placeholder.svg"}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-muted" aria-hidden />
                )}
                <span className="truncate">{t.name}</span>
                {t.league && <span className="ml-auto truncate text-xs text-muted-foreground">{t.league}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
