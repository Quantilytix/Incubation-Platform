// src/hooks/src/usePrograms.ts
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'

export type ActiveProgram = { id: string; name: string }

export function usePrograms() {
    const [programs, setPrograms] = useState<ActiveProgram[]>([])
    const [loadingPrograms, setLoadingPrograms] = useState(false)

    useEffect(() => {
        let mounted = true

        const loadPrograms = async () => {
            setLoadingPrograms(true)
            try {
                const snap = await getDocs(collection(db, 'programs'))
                const list: ActiveProgram[] = snap.docs.map(d => {
                    const data = d.data() as any
                    return { id: d.id, name: data.programName || data.name || d.id }
                })
                if (mounted) setPrograms(list)
            } catch {
                if (mounted) setPrograms([])
            } finally {
                if (mounted) setLoadingPrograms(false)
            }
        }

        loadPrograms()
        return () => {
            mounted = false
        }
    }, [])

    return { programs, loadingPrograms }
}
