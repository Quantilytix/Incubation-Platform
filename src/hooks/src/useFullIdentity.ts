import { useEffect, useState } from 'react'
import { getAuth } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

export const useFullIdentity = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = auth.onAuthStateChanged(async currentUser => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid)
          const userSnap = await getDoc(userDocRef)

          const userProfile = userSnap.exists() ? userSnap.data() : {}

          const fullProfile = {
            id: currentUser.uid,
            uid: currentUser.uid, // Add uid field for consistency
            email: currentUser.email || '',
            name: userProfile.name || currentUser.displayName || 'Unknown User',
            role: userProfile.role || 'guest',
            companyCode: userProfile.companyCode || null,
            phone: userProfile.phone || '',
            ...userProfile
          }

          console.log('[✅ useFullIdentity] Loaded identity:', fullProfile)
          setUser(fullProfile)
        } catch (err) {
          console.error('[❌ useFullIdentity] Failed to fetch user doc:', err)
          setUser(null)
        }
      } else {
        console.warn('[⚠️ useFullIdentity] No user is currently authenticated.')
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
