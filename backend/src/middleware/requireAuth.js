import { adminAuth } from '../config/firebase.js'

export async function requireAuth(request, response, next) {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    return response.status(401).json({ message: 'Authentication required.' })
  }

  try {
    request.user = await adminAuth().verifyIdToken(authorization.slice(7))
    return next()
  } catch {
    return response.status(401).json({ message: 'Invalid or expired authentication token.' })
  }
}
