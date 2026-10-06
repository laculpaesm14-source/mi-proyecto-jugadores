import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Junta los estilos de un elemento y evita que dos estilos se anulen entre sí.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
