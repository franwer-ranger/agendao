'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  makeDefaultDraft,
  resizeMatrix,
  sanitizeDraftForStorage,
  type WizardDraft,
} from './draft'

const STORAGE_KEY = 'setup-wizard-draft'

export function useWizardDraft() {
  const [draft, setDraft] = useState<WizardDraft>(() => makeDefaultDraft())
  const [hydrated, setHydrated] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hidratamos solo después de mount para evitar mismatch con SSR.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardDraft>
        const base = makeDefaultDraft()
        const merged: WizardDraft = {
          ...base,
          ...parsed,
          admin: {
            ...base.admin,
            ...(parsed.admin ?? {}),
            password: '',
            passwordConfirm: '',
          },
          salon: {
            ...base.salon,
            ...(parsed.salon ?? {}),
            identity: {
              ...base.salon.identity,
              ...(parsed.salon?.identity ?? {}),
            },
            workingHours: parsed.salon?.workingHours ?? base.salon.workingHours,
            cancellation: {
              ...base.salon.cancellation,
              ...(parsed.salon?.cancellation ?? {}),
            },
            legal: { ...base.salon.legal, ...(parsed.salon?.legal ?? {}) },
          },
          services: parsed.services ?? base.services,
          employees: parsed.employees ?? base.employees,
          matrix: resizeMatrix(
            parsed.matrix ?? [],
            (parsed.services ?? base.services).length,
            (parsed.employees ?? base.employees).length,
          ),
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- patrón de hidratación: localStorage no está disponible en SSR.
        setDraft(merged)
      }
    } catch {
      // JSON inválido o localStorage no disponible: arrancamos limpio.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(sanitizeDraftForStorage(draft)),
        )
      } catch {
        // Cuota llena / cookies bloqueadas: ignorar.
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [draft, hydrated])

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return { draft, setDraft, hydrated, clear }
}
