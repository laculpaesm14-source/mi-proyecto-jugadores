"use client"

import { useState, type FormEvent } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ArrowRight, Eye, EyeOff, Goal, ShieldCheck, Sparkles, Trophy } from "lucide-react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import type { Country } from "@/lib/types"

type Props = {
  supabase: SupabaseClient
  authError?: string
  isPasswordRecovery?: boolean
  onPasswordRecoveryComplete?: () => void
}

async function fetchCountries(url: string): Promise<Country[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("No se pudieron cargar los países.")
  return response.json() as Promise<Country[]>
}

const INVALID_PASSWORD_CHARACTERS = /[><'"\\&¨]/u
const INVALID_PASSWORD_CHARACTER_MESSAGE = "No se permiten los caracteres <, >, ', \", \\, &, ni ¨ en la contraseña."

function normalizePasswordText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "")
}

function hasConsecutiveSequence(value: string) {
  const normalized = normalizePasswordText(value)
  for (let index = 0; index <= normalized.length - 4; index += 1) {
    const sequence = normalized.slice(index, index + 4)
    if (/^(.)\1{3}$/u.test(sequence)) return true

    const codes = [...sequence].map((character) => character.charCodeAt(0))
    if (codes.every((code, offset) => offset === 0 || code === codes[offset - 1] + 1)) return true
  }
  return false
}

export function AuthForm({
  supabase,
  authError,
  isPasswordRecovery = false,
  onPasswordRecoveryComplete,
}: Props) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in")
  const [fullName, setFullName] = useState("")
  const [document, setDocument] = useState("")
  const [email, setEmail] = useState("")
  const [age, setAge] = useState("")
  const [nationality, setNationality] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordCharacterError, setPasswordCharacterError] = useState("")
  const [confirmPasswordCharacterError, setConfirmPasswordCharacterError] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const { data: countries, error: countriesError } = useSWR<Country[]>("/api/countries", fetchCountries, {
    revalidateOnFocus: false,
  })

  const nameParts = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es").match(/[a-z0-9]{3,}/g) ?? []
  const rawEmailUsername = email.trim().split("@")[0]
  const emailUsername = normalizePasswordText(rawEmailUsername)
  const emailUsernameParts = rawEmailUsername.toLocaleLowerCase("es").match(/[a-z0-9]{3,}/g) ?? []
  const normalizedPassword = normalizePasswordText(password)
  const commonPasswords = ["12345678", "password", "qwerty123"]
  const includesName = nameParts.some((part) => normalizedPassword.includes(part))
  const includesEmailUsername = (emailUsername.length >= 3 && normalizedPassword.includes(emailUsername))
    || emailUsernameParts.some((part) => normalizedPassword.includes(part))
  const isCommonPassword = commonPasswords.includes(normalizedPassword)
  const passwordRequirements = [
    { label: "Usa de 8 a 12 caracteres", valid: password.length >= 8 && password.length <= 12 },
    { label: "Incluye al menos 1 carácter especial válido", valid: /[^\p{L}\p{N}\s]/u.test(password) && !INVALID_PASSWORD_CHARACTERS.test(password) },
    { label: "No uses caracteres prohibidos (<, >, ', \", \\, &, ¨)", valid: !INVALID_PASSWORD_CHARACTERS.test(password) },
    { label: "Evita secuencias como 1234, abcd o aaaa", valid: !hasConsecutiveSequence(password) },
    { label: "No incluyas tu nombre en la contraseña", valid: !includesName },
    { label: "No incluyas el usuario de tu correo en la contraseña", valid: !includesEmailUsername },
    { label: "No uses una contraseña común", valid: !isCommonPassword },
  ]
  const unmetPasswordRequirements = passwordRequirements.filter((requirement) => !requirement.valid)
  const passwordIsValid = unmetPasswordRequirements.length === 0
  const passwordsMatch = password !== "" && password === confirmPassword
  const knownNationality = countries?.some((country) =>
    country.name.toLocaleLowerCase("es") === nationality.trim().toLocaleLowerCase("es"),
  ) ?? false

  function updateNewPassword(value: string, field: "password" | "confirm") {
    const filteredValue = value.replace(/[><'"\\&¨]/gu, "")
    const error = filteredValue === value ? "" : INVALID_PASSWORD_CHARACTER_MESSAGE

    if (field === "password") {
      setPassword(filteredValue)
      setPasswordCharacterError(error)
    } else {
      setConfirmPassword(filteredValue)
      setConfirmPasswordCharacterError(error)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (isPasswordRecovery) {
      if (INVALID_PASSWORD_CHARACTERS.test(password) || INVALID_PASSWORD_CHARACTERS.test(confirmPassword)
        || passwordCharacterError || confirmPasswordCharacterError) {
        setMessage({ text: INVALID_PASSWORD_CHARACTER_MESSAGE, success: false })
        return
      }
      if (!passwordIsValid) {
        setMessage({
          text: `La contraseña debe cumplir: ${unmetPasswordRequirements.map((requirement) => requirement.label).join("; ")}.`,
          success: false,
        })
        return
      }
      if (password !== confirmPassword) {
        setMessage({ text: "Las contraseñas no coinciden.", success: false })
        return
      }

      setBusy(true)
      try {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) throw signOutError
        setPassword("")
        setConfirmPassword("")
        setMode("sign-in")
        setMessage({ text: "Contraseña actualizada. Ya puedes iniciar sesión.", success: true })
        onPasswordRecoveryComplete?.()
      } catch (error) {
        setMessage({
          text: error instanceof Error
            ? `No se pudo actualizar la contraseña: ${error.message}`
            : "No se pudo actualizar la contraseña. Usa un enlace de recuperación válido e inténtalo de nuevo.",
          success: false,
        })
      } finally {
        setBusy(false)
      }
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (/\s/.test(normalizedEmail)) {
      setMessage({ text: "El correo no puede contener espacios.", success: false })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage({ text: "Escribe un correo electrónico válido.", success: false })
      return
    }
    if (mode === "sign-up" && password !== confirmPassword) {
      setMessage({ text: "Las contraseñas no coinciden.", success: false })
      return
    }
    if (mode === "sign-up" && (
      INVALID_PASSWORD_CHARACTERS.test(password)
      || INVALID_PASSWORD_CHARACTERS.test(confirmPassword)
      || passwordCharacterError
      || confirmPasswordCharacterError
    )) {
      setMessage({ text: INVALID_PASSWORD_CHARACTER_MESSAGE, success: false })
      return
    }
    if (mode === "sign-up" && !passwordIsValid) {
      setMessage({
        text: `La contraseña debe cumplir: ${unmetPasswordRequirements.map((requirement) => requirement.label).join("; ")}.`,
        success: false,
      })
      return
    }
    if (mode === "sign-up" && !knownNationality) {
      setMessage({ text: "Escribe y selecciona un país de la lista de sugerencias.", success: false })
      return
    }

    setEmail(normalizedEmail)
    setBusy(true)

    try {
      if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        })
        if (error) throw error
        setMessage({
          text: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.",
          success: true,
        })
      } else if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              document: document.trim(),
              age: Number(age),
              nationality: nationality.trim(),
            },
          },
        })
        if (error) throw error
        if (!data.session) {
          setMessage({ text: "Cuenta creada. Revisa tu correo para confirmar el registro.", success: true })
        } else {
          setMessage({ text: "Registro exitoso. Tu cuenta está lista.", success: true })
        }
      }
    } catch (error) {
      const errorCode = typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined
      if (mode === "sign-in" && errorCode === "invalid_credentials") {
        setMessage({ text: "Correo o contraseña incorrectos.", success: false })
        return
      }
      setMessage({
        text: error instanceof Error ? error.message : "No se pudo completar la autenticación.",
        success: false,
      })
    } finally {
      setBusy(false)
    }
  }

  function changeMode(nextMode: "sign-in" | "sign-up" | "forgot-password") {
    setMode(nextMode)
    setMessage(null)
    setPasswordCharacterError("")
    setConfirmPasswordCharacterError("")
  }

  const inputClassName = "h-11 w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 text-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-stone-50 to-lime-50 px-4 py-8 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-lime-200/50 blur-3xl" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_-35px_rgba(6,78,59,0.32)] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative isolate flex min-h-56 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-green-700 p-7 text-white sm:p-10 lg:min-h-[680px]">
          <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div aria-hidden="true" className="absolute -bottom-28 -left-24 -z-10 h-80 w-80 rounded-full border border-white/20" />
          <div aria-hidden="true" className="absolute -bottom-16 -left-12 -z-10 h-56 w-56 rounded-full border border-white/20" />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <Goal className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold uppercase tracking-[0.18em]">Cancha y plantilla</span>
          </div>
          <div className="py-8 lg:py-0">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-50 ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Tu equipo, siempre contigo
            </p>
            <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Cada jugador tiene su lugar.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-50/80">
              Organiza tu plantilla, crea alineaciones y mantén tus datos sincronizados en la nube.
            </p>
          </div>
          <div className="hidden items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:flex">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 text-emerald-950">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Tu próxima alineación</p>
              <p className="text-xs text-emerald-50/75">Empieza con un equipo bien organizado</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-emerald-50/80" aria-hidden="true" />
          </div>
        </aside>
        <div className="p-6 sm:p-10 lg:p-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {isPasswordRecovery ? "Recuperación segura" : mode === "forgot-password" ? "Recupera el acceso" : mode === "sign-up" ? "Únete al equipo" : "Acceso de usuario"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
          {isPasswordRecovery ? "Nueva contraseña" : mode === "forgot-password" ? "Restablecer contraseña" : mode === "sign-up" ? "Crear tu cuenta" : "Bienvenido de nuevo"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isPasswordRecovery
            ? "Elige una contraseña nueva para tu cuenta."
            : mode === "forgot-password"
              ? "Escribe el correo de tu cuenta y te enviaremos un enlace de recuperación."
              : mode === "sign-in"
                ? "Inicia sesión para ver tus jugadores."
                : "Crea una cuenta para guardar tus jugadores en la nube."}
        </p>

        {authError && <p className="mt-4 text-sm text-destructive" role="alert">{authError}</p>}

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {!isPasswordRecovery && mode === "sign-up" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="auth-full-name" className="mb-1 block text-sm font-medium">Nombre completo *</label>
                <input
                  id="auth-full-name"
                  required
                  minLength={2}
                  maxLength={50}
                  autoComplete="name"
                  placeholder="Ej. María Pérez"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="auth-document" className="mb-1 block text-sm font-medium">Documento de identidad *</label>
                <input
                  id="auth-document"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6,10}"
                  maxLength={10}
                  placeholder="Solo números"
                  value={document}
                  onChange={(event) => setDocument(event.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={inputClassName}
                />
              </div>
            </div>
          )}
          {!isPasswordRecovery && (
            <div>
              <label htmlFor="auth-email" className="mb-1 block text-sm font-medium">Correo electrónico</label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                placeholder="usuario@gmail.com"
                className={inputClassName}
              />
            </div>
          )}
          {!isPasswordRecovery && mode === "sign-up" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="auth-age" className="mb-1 block text-sm font-medium">Edad *</label>
                <input
                  id="auth-age"
                  type="number"
                  required
                  min={14}
                  max={100}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="auth-nationality" className="mb-1 block text-sm font-medium">País / nacionalidad *</label>
                <input
                  id="auth-nationality"
                  required
                  maxLength={60}
                  autoComplete="country-name"
                  list="auth-countries"
                  placeholder={countriesError ? "No se pudieron cargar los países" : "Escribe para buscar un país"}
                  value={nationality}
                  onChange={(event) => setNationality(event.target.value)}
                  className={inputClassName}
                />
                <datalist id="auth-countries">
                  {(countries ?? []).map((country) => (
                    <option key={country.code} value={country.name} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                  {countriesError
                    ? "No se pudieron cargar los países. Revisa tu conexión e inténtalo de nuevo."
                    : countries
                      ? `${countries.length} países disponibles. Escribe para ver sugerencias.`
                      : "Cargando países…"}
                </p>
              </div>
            </div>
          )}
          {mode !== "forgot-password" && (
            <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium">
              {isPasswordRecovery ? "Nueva contraseña *" : "Contraseña"}
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={mode === "sign-up" || isPasswordRecovery ? 8 : 6}
                maxLength={mode === "sign-up" || isPasswordRecovery ? 12 : 64}
                required
                value={password}
                onChange={(event) => {
                  if (mode === "sign-up" || isPasswordRecovery) {
                    updateNewPassword(event.target.value, "password")
                  } else {
                    setPassword(event.target.value)
                  }
                }}
                className={`${inputClassName} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {(mode === "sign-up" || isPasswordRecovery) && (
              <section className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3" aria-label="Fortaleza de la contraseña">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-950">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Fortaleza de la contraseña:
                  </span>
                  <span className={password ? (passwordIsValid ? "text-emerald-700" : "text-amber-700") : "text-muted-foreground"}>
                    {!password ? "Sin evaluar" : passwordIsValid ? "Segura" : "Incompleta"}
                  </span>
                </div>
                <ul className="grid gap-1.5 text-xs sm:grid-cols-2" aria-live="polite">
                  {passwordRequirements.map((requirement) => (
                    <li
                      key={requirement.label}
                      className={
                        requirement.valid
                          ? "text-emerald-700"
                          : password
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      <span aria-hidden="true">
                        {requirement.valid ? "✓" : password ? "✗" : "•"}
                      </span>{" "}
                      {requirement.label}
                    </li>
                  ))}
                </ul>
                {passwordCharacterError && (
                  <p className="mt-2 text-xs text-destructive" role="alert">{passwordCharacterError}</p>
                )}
              </section>
            )}
            </div>
          )}

          {(mode === "sign-up" || isPasswordRecovery) && (
            <>
              <div>
                <label htmlFor="auth-confirm-password" className="mb-1 block text-sm font-medium">
                  Confirmar contraseña *
                </label>
                <div className="relative">
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={12}
                    required
                    value={confirmPassword}
                    onChange={(event) => updateNewPassword(event.target.value, "confirm")}
                    className={`${inputClassName} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((shown) => !shown)}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showConfirmPassword}
                    title={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {(confirmPasswordCharacterError || (confirmPassword && !passwordsMatch)) && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {confirmPasswordCharacterError || "Las contraseñas no coinciden."}
                  </p>
                )}
              </div>
              {mode === "sign-up" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span>Acepto los términos y condiciones *</span>
                </label>
              )}
            </>
          )}

          {message && (
            <p className={`text-sm ${message.success ? "text-emerald-700" : "text-destructive"}`} role={message.success ? "status" : "alert"}>
              {message.text}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || (
              isPasswordRecovery
                ? password.length < 12 || password.length > 64 || !passwordsMatch
                : mode === "sign-up" && (!passwordIsValid || !passwordsMatch || !acceptedTerms)
            )}
          >
            {busy
              ? "Espera..."
              : isPasswordRecovery
                ? "Actualizar contraseña"
                : mode === "sign-in"
                  ? "Iniciar sesión"
                  : mode === "forgot-password"
                    ? "Enviar enlace de recuperación"
                    : "Registrar usuario"}
          </Button>
        </form>

        {!isPasswordRecovery && (
          <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            {mode === "sign-in" && (
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => changeMode("forgot-password")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <p>
              {mode === "sign-in" || mode === "forgot-password" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => changeMode(mode === "sign-up" ? "sign-in" : "sign-up")}
              >
                {mode === "sign-in" || mode === "forgot-password" ? "Crear cuenta" : "Iniciar sesión"}
              </button>
            </p>
            {mode === "forgot-password" && (
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => changeMode("sign-in")}
              >
                Volver a iniciar sesión
              </button>
            )}
          </div>
        )}
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          Tus datos están protegidos por Supabase
        </p>
        </div>
      </section>
    </main>
  )
}
