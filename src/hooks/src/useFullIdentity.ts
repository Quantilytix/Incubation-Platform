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
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userDocRef)

        if (userSnap.exists()) {
          const fullProfile = {
            id: currentUser.uid,
            email: currentUser.email,
            name: currentUser.displayName || '',
            ...userSnap.data()
          }
          setUser(fullProfile)
        } else {
          setUser({
            id: currentUser.uid,
            email: currentUser.email,
            name: currentUser.displayName || ''
          })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
