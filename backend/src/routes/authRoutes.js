import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, firestore } from '../config/firebase.js'
import { requireAuth } from '../middleware/requireAuth.js'

const authRouter = Router()

authRouter.post('/profile', requireAuth, async (request, response, next) => {
  try {
    const displayName = request.body.displayName?.trim() || request.user.name?.trim()

    if (!displayName) {
      return response.status(400).json({ message: 'Display name is required.' })
    }

    const profile = {
      uid: request.user.uid,
      email: request.user.email,
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    }

    const userReference = firestore().collection('users').doc(request.user.uid)
    const existingProfile = await userReference.get()

    await userReference.set(
      {
        ...profile,
        ...(!existingProfile.exists && { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    )

    return response.status(201).json({
      user: {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
      },
    })
  } catch (error) {
    return next(error)
  }
})

authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const userReference = firestore().collection('users').doc(request.user.uid)
    const snapshot = await userReference.get()

    if (snapshot.exists) {
      return response.json({ user: snapshot.data() })
    }

    const authUser = await adminAuth().getUser(request.user.uid)
    const profile = {
      uid: authUser.uid,
      email: authUser.email || request.user.email || null,
      displayName: authUser.displayName || request.user.name || null,
    }

    await userReference.set({
      ...profile,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return response.status(201).json({ user: profile })
  } catch (error) {
    return next(error)
  }
})

export default authRouter
