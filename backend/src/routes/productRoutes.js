import { Router } from 'express'
import { firestore } from '../config/firebase.js'

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
