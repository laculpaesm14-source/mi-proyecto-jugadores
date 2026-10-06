"use client"

import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CountrySelect } from "@/components/country-select"
import { TeamCombobox } from "@/components/team-combobox"
import { MAX_AGE, MIN_AGE, POSITIONS, type Player, type Position } from "@/lib/types"

type FormValues = Omit<Player, "id"> & { id?: number }

// Datos vacíos que aparecen cuando se va a agregar un jugador nuevo.
const EMPTY: FormValues = {
  id: undefined,
  name: "",
  photo: "",
  nationality: "",
  nationalityCode: "",
  team: "",
  teamBadge: "",
  position: "arquero",
  age: MIN_AGE,
}

type Props = {
  editing: Player | null
  existingIds: number[]
  deletedPlayers: Player[]
  onSave: (values: FormValues) => void
  onCancel: () => void
}

// Edades que se pueden elegir en el formulario.
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i)

export function PlayerForm({ editing, existingIds, deletedPlayers, onSave, onCancel }: Props) {
  // Recuerda los datos escritos y los mensajes que hay que mostrar.
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [error, setError] = useState("")
  const [recovering, setRecovering] = useState(false)

  // Al editar muestra los datos del jugador; al agregar, deja los campos vacíos.
  useEffect(() => {
    if (editing) {
      setValues(editing)
    } else {
      setValues(EMPTY)
    }
    setError("")
    setRecovering(false)
  }, [editing])

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function handleIdChange(value: string) {
    const id = value ? Number(value) : undefined
    const deletedPlayer = id === undefined ? undefined : deletedPlayers.find((player) => player.id === id)
    // Si el número era de alguien borrado, vuelve a poner sus datos en el formulario.
    if (deletedPlayer) {
      const { id: deletedId, ...playerValues } = deletedPlayer
      setValues({ ...playerValues, id: deletedId })
      setRecovering(true)
      setError("")
      return
    }
    if (recovering) setValues({ ...EMPTY, id })
    else set("id", id)
    setRecovering(false)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido.")
      return
    }
    // Abre la imagen elegida para mostrarla junto al jugador.
    const reader = new FileReader()
    reader.onload = () => set("photo", String(reader.result))
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Antes de guardar, revisa que el número, el nombre, el país y el equipo estén bien.
    if (values.id !== undefined && (!Number.isInteger(values.id) || values.id < 1)) {
      return setError("El ID debe ser un número entero mayor que 0.")
    }
    if (!editing && values.id !== undefined && existingIds.includes(values.id)) {
      return setError(`El ID ${values.id} ya existe. Coloca otro ID.`)
    }
    if (!values.name.trim()) return setError("El nombre del jugador es obligatorio.")
    if (!values.nationality) return setError("Selecciona una nacionalidad.")
    if (!values.team.trim()) return setError("Indica un equipo.")
    setError("")
    onSave({ ...values, name: values.name.trim(), team: values.team.trim() })
    if (!editing) {
      setValues(EMPTY)
      setRecovering(false)
    }
  }

  const labelClass = "mb-1 block text-sm font-medium text-foreground"

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-card-foreground">
        {editing ? `Editar jugador #${editing.id}` : "Agregar nuevo jugador"}
      </h2>

      {/* Aquí se escriben el número, el nombre y la foto del jugador. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Aquí se elige el país y se escribe o busca el equipo. */}
        <div>
          <label htmlFor="player-id" className={labelClass}>
            ID del jugador (opcional)
          </label>
          <input
            id="player-id"
            type="number"
            min="1"
            step="1"
            value={values.id ?? ""}
            onChange={(e) => handleIdChange(e.target.value)}
            placeholder="Ej. 10"
            disabled={Boolean(editing)}
            aria-invalid={!editing && values.id !== undefined && existingIds.includes(values.id)}
            className={`h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted ${
              !editing && values.id !== undefined && existingIds.includes(values.id)
                ? "border-destructive focus:ring-destructive"
                : "border-input"
            }`}
          />
          {!editing && !recovering && (
            <p className="mt-1 text-xs text-muted-foreground">
              Déjalo vacío para asignarlo automáticamente, o escribe un ID eliminado para recuperarlo.
            </p>
          )}
          {recovering && (
            <p className="mt-1 text-xs font-medium text-emerald-700" role="status">
              Jugador eliminado encontrado. Se recuperarán sus datos al guardar.
            </p>
          )}
          {!editing && values.id !== undefined && existingIds.includes(values.id) && (
            <p className="mt-1 text-xs font-medium text-destructive" role="alert">
              El ID {values.id} ya existe. Coloca otro ID.
            </p>
          )}
          {editing && <p className="mt-1 text-xs text-muted-foreground">El ID no se puede cambiar al editar.</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Nombre del jugador
          </label>
          <input
            id="name"
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ej. Lionel Messi"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="photo" className={labelClass}>
            Foto del jugador
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Puedes pegar una URL o seleccionar una imagen descargada desde tu computador.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
              {values.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.photo || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                id="photo"
                type="url"
                value={values.photo.startsWith("data:") ? "" : values.photo}
                onChange={(e) => set("photo", e.target.value)}
                placeholder="Pega una URL de imagen"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2">
                <label
                  htmlFor="photo-file"
                  className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-secondary"
                >
                  Elegir imagen descargada
                </label>
                <input
                  id="photo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleFile}
                />
                {values.photo && (
                  <button
                    type="button"
                    onClick={() => set("photo", "")}
                    className="text-xs font-medium text-destructive hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Aquí se eligen la posición y la edad del jugador. */}
        <div>
          <label htmlFor="nationality" className={labelClass}>
            Nacionalidad
          </label>
          <CountrySelect
            id="nationality"
            value={values.nationality}
            onChange={(name, code) => setValues((v) => ({ ...v, nationality: name, nationalityCode: code }))}
          />
        </div>

        <div>
          <label htmlFor="team" className={labelClass}>
            Equipo
          </label>
          <TeamCombobox
            id="team"
            value={values.team}
            onChange={(name, badge) => setValues((v) => ({ ...v, team: name, teamBadge: badge }))}
          />
        </div>

        <div>
          <label htmlFor="position" className={labelClass}>
            Posición
          </label>
          <select
            id="position"
            value={values.position}
            onChange={(e) => set("position", e.target.value as Position)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="age" className={labelClass}>
            Edad
          </label>
          <select
            id="age"
            value={values.age}
            onChange={(e) => set("age", Number(e.target.value))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a} años
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Si falta algún dato, aquí aparece un mensaje para corregirlo. */}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* El botón guarda al jugador, actualiza sus datos o recupera uno borrado. */}
      <div className="mt-5 flex gap-2">
        <Button
  type="submit"
  disabled={!editing && values.id !== undefined && existingIds.includes(values.id)}
>
  {editing ? "Actualizar jugador" : recovering ? "Recuperar jugador" : "Añadir jugador"}
</Button>
        {editing && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
