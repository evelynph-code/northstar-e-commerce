import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { firestore } from '../config/firebase.js'
import { requireAuth } from '../middleware/requireAuth.js'

const orderRouter = Router()

const orderStatuses = ['confirmed', 'packing', 'shipped', 'delivered', 'cancelled']

async function requireAdminUser(request, response) {
  const snapshot = await firestore().collection('users').doc(request.user.uid).get()
  if (snapshot.data()?.isAdmin) return true

  response.status(403).json({ message: 'Admin access required.' })
  return false
}

const coupons = {
  NORTHSTAR10: { type: 'percent', value: 10 },
  SAVE20: { type: 'fixed', value: 20, minimum: 100 },
  FREESHIP: { type: 'shipping' },
}

orderRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const snapshot = await firestore()
      .collection('orders')
      .where('userId', '==', request.user.uid)
      .get()
    const orders = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis?.() || 0
        const secondTime = second.createdAt?.toMillis?.() || 0
        return secondTime - firstTime
      })

    return response.json({ orders })
  } catch (error) {
    return next(error)
  }
})

orderRouter.get('/admin', requireAuth, async (request, response, next) => {
  try {
    if (!(await requireAdminUser(request, response))) return

    const snapshot = await firestore().collection('orders').get()
    const orders = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis?.() || 0
        const secondTime = second.createdAt?.toMillis?.() || 0
        return secondTime - firstTime
      })

    return response.json({ orders, statuses: orderStatuses })
  } catch (error) {
    return next(error)
  }
})

orderRouter.patch('/:orderId/status', requireAuth, async (request, response, next) => {
  try {
    if (!(await requireAdminUser(request, response))) return

    const status = String(request.body.status || '').trim()
    if (!orderStatuses.includes(status)) {
      return response.status(400).json({ message: 'Choose a valid order status.' })
    }

    const orderReference = firestore().collection('orders').doc(request.params.orderId)
    const snapshot = await orderReference.get()
    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Order not found.' })
    }

    await orderReference.set(
      {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status,
          updatedAt: new Date().toISOString(),
          updatedBy: request.user.uid,
        }),
      },
      { merge: true },
    )

    return response.json({ order: { id: snapshot.id, ...snapshot.data(), status } })
  } catch (error) {
    return next(error)
  }
})

orderRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const { cartId, delivery, items, paymentMethod } = request.body

    if (!cartId || !Array.isArray(items) || items.length === 0) {
      return response.status(400).json({ message: 'Cart items are required.' })
    }

    if (!['card', 'delivery'].includes(paymentMethod)) {
      return response.status(400).json({ message: 'Choose a valid payment method.' })
    }

    const requiredDeliveryFields = ['fullName', 'email', 'phone', 'address', 'city']
    if (requiredDeliveryFields.some((field) => !delivery?.[field]?.trim())) {
      return response.status(400).json({ message: 'Complete all delivery details.' })
    }

    const quantitiesByProduct = items.reduce((result, item) => {
      const quantity = Number(item.quantity)
      if (!item.productId || !Number.isInteger(quantity) || quantity < 1) return result
      result[item.productId] = (result[item.productId] || 0) + quantity
      return result
    }, {})
    const productIds = Object.keys(quantitiesByProduct)

    if (productIds.length === 0) {
      return response.status(400).json({ message: 'Cart items are invalid.' })
    }

    const database = firestore()
    const orderReference = database.collection('orders').doc()
    const couponCode = request.body.couponCode?.trim().toUpperCase() || ''

    const order = await database.runTransaction(async (transaction) => {
      const references = productIds.map((productId) => {
        const productReference = database.collection('products').doc(productId)
        return {
          productId,
          productReference,
          reservationReference: productReference.collection('reservations').doc(cartId),
        }
      })
      const snapshots = await Promise.all(
        references.flatMap(({ productReference, reservationReference }) => [
          transaction.get(productReference),
          transaction.get(reservationReference),
        ]),
      )

      const orderProducts = []
      references.forEach((reference, index) => {
        const productSnapshot = snapshots[index * 2]
        const reservationSnapshot = snapshots[index * 2 + 1]
        const requestedQuantity = quantitiesByProduct[reference.productId]

        if (!productSnapshot.exists) {
          const error = new Error('A product in your cart no longer exists.')
          error.status = 409
          throw error
        }

        const reservedQuantity = Number(reservationSnapshot.data()?.quantity) || 0
        if (reservedQuantity !== requestedQuantity) {
          const error = new Error(`${productSnapshot.data().name} is no longer available in the requested quantity.`)
          error.status = 409
          throw error
        }

        orderProducts.push({
          productId: reference.productId,
          name: productSnapshot.data().name,
          price: Number(productSnapshot.data().price),
          quantity: requestedQuantity,
        })
      })

      const subtotal = orderProducts.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      )
      const coupon = coupons[couponCode]
      const couponDiscount =
        coupon?.type === 'percent'
          ? subtotal * (coupon.value / 100)
          : coupon?.type === 'fixed' && subtotal >= coupon.minimum
            ? coupon.value
            : 0
      const discountedSubtotal = Math.max(0, subtotal - couponDiscount)
      const shipping =
        subtotal >= 75 || coupon?.type === 'shipping' ? 0 : 8.99
      const tax = discountedSubtotal * 0.08
      const total = discountedSubtotal + shipping + tax

      const orderData = {
        userId: request.user.uid,
        customerEmail: request.user.email,
        cartId,
        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          color: item.color || '',
          size: item.size || '',
          price: orderProducts.find((product) => product.productId === item.productId)?.price,
        })),
        delivery,
        payment: {
          method: paymentMethod,
          status: paymentMethod === 'card' ? 'authorized_placeholder' : 'pending_on_delivery',
          cardLast4: paymentMethod === 'card' ? request.body.cardLast4 || null : null,
        },
        totals: { subtotal, couponDiscount, shipping, tax, total },
        couponCode: coupon ? couponCode : null,
        status: 'confirmed',
        createdAt: FieldValue.serverTimestamp(),
      }

      transaction.set(orderReference, orderData)
      references.forEach(({ reservationReference }) => transaction.delete(reservationReference))

      return {
        id: orderReference.id,
        status: orderData.status,
        total,
        paymentStatus: orderData.payment.status,
      }
    })

    return response.status(201).json({ order })
  } catch (error) {
    if (error.status) return response.status(error.status).json({ message: error.message })
    return next(error)
  }
})

export default orderRouter
