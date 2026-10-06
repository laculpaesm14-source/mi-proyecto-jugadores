"use client"

import Image from "next/image"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { POSITIONS, POSITION_COLORS, type Player } from "@/lib/types"

// Cambia el nombre corto de la posición por uno fácil de leer.
function positionLabel(value: Player["position"]) {
  return POSITIONS.find((p) => p.value === value)?.label ?? value
}

type Props = {
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: number) => void
}

export function PlayersTable({ players, onEdit, onDelete }: Props) {
  // Si no hay jugadores para mostrar, aparece este mensaje.
  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
        No hay jugadores para mostrar.
      </div>
    )
  }

  // En pantallas pequeñas muestra los datos en tarjetas para que no haya que mover la tabla a los lados.
  // En pantallas grandes usa una tabla con todas las columnas visibles.
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {players.map((p) => (
          <article key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium text-card-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">ID: {p.id}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label={`Editar a ${p.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(p.id)}
                  aria-label={`Eliminar a ${p.name}`}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Nacionalidad</dt>
                <dd className="flex min-w-0 items-center gap-2 break-words">
                  {p.nationalityCode && (
                    <Image
                      src={`https://flagcdn.com/w40/${p.nationalityCode}.png`}
                      alt=""
                      width={24}
                      height={18}
                      className="h-[18px] w-6 shrink-0 rounded-sm object-cover"
                      unoptimized
                    />
                  )}
                  <span className="break-words">{p.nationality}</span>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Equipo</dt>
                <dd className="flex min-w-0 items-center gap-2 break-words">
                  {p.teamBadge && (
                    <Image
                      src={p.teamBadge}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0 object-contain"
                      unoptimized
                    />
                  )}
                  <span className="break-words">{p.team}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Posición</dt>
                <dd>
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${POSITION_COLORS[p.position] ?? "bg-secondary text-secondary-foreground ring-1 ring-border"}`}
                  >
                    {positionLabel(p.position)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Edad</dt>
                <dd>{p.age} años</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:block">
      <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[18%]" />
          <col className="w-[22%]" />
          <col className="w-[20%]" />
          <col className="w-[12%]" />
          <col className="w-[7%]" />
          <col className="w-[15%]" />
        </colgroup>
        <caption className="sr-only">Lista completa de jugadores registrados</caption>
        {/* Estos títulos explican qué información hay debajo de cada uno. */}
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="px-2 py-3 text-left font-semibold sm:px-3">ID</th>
            <th className="px-2 py-3 text-left font-semibold sm:px-3">Nombre</th>
            <th className="px-2 py-3 text-left font-semibold sm:px-3">Nacionalidad</th>
            <th className="px-2 py-3 text-left font-semibold sm:px-3">Equipo</th>
            <th className="px-2 py-3 text-left font-semibold sm:px-3">Posición</th>
            <th className="px-2 py-3 text-left font-semibold sm:px-3">Edad</th>
            <th className="px-2 py-3 text-center font-semibold sm:px-3">Acciones</th>
          </tr>
        </thead>
        {/* Cada fila muestra el nombre, el país, el equipo y otros datos de un jugador. */}
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-t border-border even:bg-secondary/40">
              {/* Estos botones permiten cambiar o borrar los datos del jugador. */}
              <td className="px-2 py-3 sm:px-3">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-2 font-mono text-xs font-semibold text-accent-foreground">
                  {p.id}
                </span>
              </td>
              <td className="px-2 py-3 sm:px-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary sm:h-9 sm:w-9">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo || "/placeholder.svg"} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 break-words font-medium text-card-foreground">{p.name}</span>
                </span>
              </td>
              <td className="px-2 py-3 sm:px-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  {p.nationalityCode && (
                    <Image
                      src={`https://flagcdn.com/w40/${p.nationalityCode}.png`}
                      alt=""
                      width={24}
                      height={18}
                      className="h-[18px] w-6 shrink-0 rounded-sm object-cover"
                      unoptimized
                    />
                  )}
                  <span className="min-w-0 break-normal">{p.nationality}</span>
                </span>
              </td>
              <td className="px-2 py-3 sm:px-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  {p.teamBadge && (
                    <Image
                      src={p.teamBadge || "/placeholder.svg"}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0 object-contain"
                      unoptimized
                    />
                  )}
                  <span className="min-w-0 break-normal">{p.team}</span>
                </span>
              </td>
              <td className="px-2 py-3 sm:px-3">
                <span
                  className={`inline-block break-words rounded-full px-1.5 py-1 text-[10px] font-semibold sm:px-2.5 sm:text-xs ${POSITION_COLORS[p.position] ?? "bg-secondary text-secondary-foreground ring-1 ring-border"}`}
                >
                  {positionLabel(p.position)}
                </span>
              </td>
              <td className="px-2 py-3 tabular-nums sm:px-3">{p.age}</td>
              <td className="px-1 py-3 sm:px-2">
                <div className="flex justify-center gap-0 sm:gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="sm:!size-8"
                    onClick={() => onEdit(p)}
                    aria-label={`Editar a ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDelete(p.id)}
                    aria-label={`Eliminar a ${p.name}`}
                    className="text-destructive hover:text-destructive sm:!size-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}
