import { useEffect, useState } from 'react'

export function useActiveProgramId() {
    const [programId, setProgramId] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (typeof window === 'undefined') return

        // 🔹 bootstrap from the current global value set by CustomLayout
        const current =
            (window as any).__ACTIVE_PROGRAM_ID__ as string | undefined
        if (current !== undefined) {
            setProgramId(current)
        }

        const onChange = (e: Event) => {
            const ce = e as CustomEvent<{ programId?: string }>
            setProgramId(ce.detail?.programId ?? undefined)
        }

        window.addEventListener('program-filter-changed', onChange)
        return () => window.removeEventListener('program-filter-changed', onChange)
    }, [])

    return programId
}
