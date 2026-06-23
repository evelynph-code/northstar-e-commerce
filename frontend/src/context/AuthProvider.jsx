import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { AuthContext } from './auth-context.js'

const apiUrl = import.meta.env.VITE_API_URL || '/api'

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const updateProfileState = useCallback((updates) => {
    setProfile((current) => ({ ...current, ...updates }))
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)

      if (!user) {
        setProfile(null)
        setAuthLoading(false)
        return
      }

      const fallbackProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
      }

      try {
        const token = await user.getIdToken()
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) throw new Error('Unable to load profile')
        const body = await response.json()
        setProfile({ ...fallbackProfile, ...body.user })
      } catch {
        setProfile(fallbackProfile)
      } finally {
        setAuthLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      authLoading,
      profile,
      user: firebaseUser,
      logout: () => signOut(auth),
      updateProfileState,
    }),
    [authLoading, firebaseUser, profile, updateProfileState],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
