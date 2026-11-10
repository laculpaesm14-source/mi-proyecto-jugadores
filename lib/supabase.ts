import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Player, Position } from "@/lib/types"

export type PlayerRecord = {
  user_id: string
  id: number
  name: string
  photo: string
  nationality: string
  nationality_code: string
  team: string
  team_badge: string
  position: Position
  age: number
  is_deleted: boolean
}

let browserClient: SupabaseClient | null = null

export function getSupabaseConfigMessage() {
  const missing: string[] = []

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL")

  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

  if (missing.length === 0) return null

  const details = missing.length === 1
    ? `Falta la variable ${missing[0]}.`
    : `Faltan las variables ${missing.join(" y ")}.`

  return `${details} Copia .env.example a .env.local y completa la URL y la clave publicable de tu proyecto Supabase. No uses una service_role key en variables NEXT_PUBLIC_.`
}

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null
  if (!browserClient) browserClient = createClient(url, key)
  return browserClient
}

export function toPlayerRecord(player: Player, userId: string, isDeleted = false): PlayerRecord {
  return {
    user_id: userId,
    id: player.id,
    name: player.name,
    photo: player.photo,
    nationality: player.nationality,
    nationality_code: player.nationalityCode,
    team: player.team,
    team_badge: player.teamBadge,
    position: player.position,
    age: player.age,
    is_deleted: isDeleted,
  }
}

export function fromPlayerRecord(record: PlayerRecord): Player {
  return {
    id: record.id,
    name: record.name,
    photo: record.photo ?? "",
    nationality: record.nationality,
    nationalityCode: record.nationality_code ?? "",
    team: record.team,
    teamBadge: record.team_badge ?? "",
    position: record.position,
    age: record.age,
  }
}
