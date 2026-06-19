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

export default productRouter
