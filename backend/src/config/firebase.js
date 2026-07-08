import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

function getCredential() {
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  }

  return applicationDefault()
}

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]

  return initializeApp({
    credential: getCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

export const adminAuth = () => getAuth(getFirebaseApp())
export const firestore = () => getFirestore(getFirebaseApp())
export const storageBucket = () => getStorage(getFirebaseApp()).bucket()
