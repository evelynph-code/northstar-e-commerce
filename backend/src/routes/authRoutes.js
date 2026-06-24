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
      userName: request.body.userName?.trim() || '',
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
        userName: profile.userName,
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

authRouter.patch('/me', requireAuth, async (request, response, next) => {
  try {
    const allowedFields = [
      'displayName',
      'userName',
      'phone',
      'address',
      'city',
      'postalCode',
      'country',
      'savedCards',
    ]
    const updates = Object.fromEntries(
      allowedFields
        .filter((field) =>
          field === 'savedCards'
            ? Array.isArray(request.body.savedCards)
            : typeof request.body[field] === 'string',
        )
        .map((field) => [
          field,
          field === 'savedCards'
            ? request.body.savedCards.slice(0, 5).map((card) => ({
                id: String(card.id || ''),
                nickname: String(card.nickname || '').trim(),
                cardholder: String(card.cardholder || '').trim(),
                brand: String(card.brand || '').trim(),
                last4: String(card.last4 || '').replace(/\D/g, '').slice(-4),
                expiry: String(card.expiry || '').trim(),
              }))
            : request.body[field].trim(),
        ]),
    )

    if (!updates.displayName) {
      return response.status(400).json({ message: 'Display name is required.' })
    }

    await Promise.all([
      firestore().collection('users').doc(request.user.uid).set(
        {
          ...updates,
          uid: request.user.uid,
          email: request.user.email,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      adminAuth().updateUser(request.user.uid, {
        displayName: updates.displayName,
      }),
    ])

    return response.json({
      user: {
        ...updates,
        uid: request.user.uid,
        email: request.user.email,
      },
    })
  } catch (error) {
    return next(error)
  }
})

export default authRouter
