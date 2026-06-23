import { Router } from 'express'
import { firestore } from '../config/firebase.js'
import { broadcastStockUpdate } from '../socket.js'

const productRouter = Router()

productRouter.get('/', async (_request, response, next) => {
  try {
    const snapshot = await firestore().collection('products').get()
    const products = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((first, second) => first.name.localeCompare(second.name))

    return response.json({ products })
  } catch (error) {
    return next(error)
  }
})

productRouter.get('/:productId/reviews', async (request, response, next) => {
  try {
    const snapshot = await firestore()
      .collection('products')
      .doc(request.params.productId)
      .collection('reviews')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    return response.json({
      reviews: snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })),
    })
  } catch (error) {
    return next(error)
  }
})

productRouter.post('/:productId/inventory', async (request, response, next) => {
  try {
    const delta = Number(request.body.delta)
    const cartId = request.body.cartId?.trim()

    if (!Number.isInteger(delta) || delta === 0) {
      return response.status(400).json({ message: 'Inventory delta must be a non-zero integer.' })
    }

    if (!cartId) {
      return response.status(400).json({ message: 'Cart ID is required.' })
    }

    const productReference = firestore().collection('products').doc(request.params.productId)
    const reservationReference = productReference.collection('reservations').doc(cartId)
    const result = await firestore().runTransaction(async (transaction) => {
      const [snapshot, reservationSnapshot] = await Promise.all([
        transaction.get(productReference),
        transaction.get(reservationReference),
      ])

      if (!snapshot.exists) {
        const error = new Error('Product not found.')
        error.status = 404
        throw error
      }

      const currentStock = Number(snapshot.data().stock) || 0
      const currentReservation = Number(reservationSnapshot.data()?.quantity) || 0
      const nextStock = currentStock - delta
      const nextReservation = currentReservation + delta

      if (nextStock < 0) {
        const error = new Error(`Only ${currentStock} item${currentStock === 1 ? '' : 's'} remaining.`)
        error.status = 409
        throw error
      }

      if (nextReservation < 0) {
        const error = new Error('This cart cannot release more items than it reserved.')
        error.status = 409
        throw error
      }

      transaction.update(productReference, { stock: nextStock })
      if (nextReservation === 0) {
        transaction.delete(reservationReference)
      } else {
        transaction.set(reservationReference, {
          cartId,
          quantity: nextReservation,
          updatedAt: new Date().toISOString(),
        })
      }

      return { productId: snapshot.id, stock: nextStock, reserved: nextReservation }
    })

    broadcastStockUpdate(result)
    return response.json(result)
  } catch (error) {
    if (error.status) {
      return response.status(error.status).json({ message: error.message })
    }
    return next(error)
  }
})

productRouter.get('/:productId', async (request, response, next) => {
  try {
    const snapshot = await firestore().collection('products').doc(request.params.productId).get()

    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Product not found.' })
    }

    return response.json({ product: { id: snapshot.id, ...snapshot.data() } })
  } catch (error) {
    return next(error)
  }
})

export default productRouter
