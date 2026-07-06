import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { isAdminEmail } from '../config/adminAccess.js'
import { firestore } from '../config/firebase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { broadcastStockUpdate } from '../socket.js'

const orderRouter = Router()

const orderStatuses = ['confirmed', 'packing', 'shipped', 'delivered', 'cancelled', 'returned']
const buyerCancellableStatuses = ['confirmed', 'packing']
const returnReasons = {
  damaged_or_defective: 'Item arrived damaged or defective',
  incorrect_item: 'Incorrect item, size, or color received',
  incorrect_item_details: 'Incorrect item, size, or color received',
  incorrect_size: 'Incorrect item, size, or color received',
  incorrect_color: 'Incorrect item, size, or color received',
  delivery_address_issue: 'Delivery address issue',
  no_longer_needed: 'Item is no longer needed',
  other: 'Other',
}
const returnRequestStatuses = ['approved', 'declined']

async function requireAdminUser(request, response) {
  if (isAdminEmail(request.user.email)) return true

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

orderRouter.post('/:orderId/return', requireAuth, async (request, response, next) => {
  try {
    const reason = String(request.body.reason || '').trim()
    const notes = String(request.body.notes || '').trim()
    const itemIndexes = Array.isArray(request.body.itemIndexes)
      ? [...new Set(request.body.itemIndexes.map((index) => Number(index)).filter(Number.isInteger))]
      : []

    if (!returnReasons[reason]) {
      return response.status(400).json({ message: 'Choose a valid return reason.' })
    }

    if (reason === 'other' && !notes) {
      return response.status(400).json({ message: 'Add a note for this return reason.' })
    }

    if (itemIndexes.length === 0) {
      return response.status(400).json({ message: 'Select at least one item to return.' })
    }

    const orderReference = firestore().collection('orders').doc(request.params.orderId)
    const snapshot = await orderReference.get()

    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Order not found.' })
    }

    const order = snapshot.data()
    if (order.userId !== request.user.uid) {
      return response.status(403).json({ message: 'You can only request returns for your own orders.' })
    }

    if (order.status !== 'delivered') {
      return response.status(409).json({ message: 'Returns can be requested after delivery.' })
    }

    if (order.returnRequest?.status === 'pending_review') {
      return response.status(409).json({ message: 'This return request is already under review.' })
    }

    if (['approved', 'declined'].includes(order.returnRequest?.status)) {
      return response.status(409).json({ message: 'This order already has a return decision.' })
    }

    const orderItems = order.items || []
    const returnItems = itemIndexes
      .map((itemIndex) => ({ item: orderItems[itemIndex], itemIndex }))
      .filter(({ item }) => item)
      .map(({ item, itemIndex }) => ({
        itemIndex,
        name: item.name,
        price: Number(item.price || 0),
        productId: item.productId,
        quantity: Number(item.quantity || 0),
        color: item.color || '',
        size: item.size || '',
      }))

    if (returnItems.length !== itemIndexes.length) {
      return response.status(400).json({ message: 'One or more selected items are not part of this order.' })
    }

    const returnRequest = {
      items: returnItems,
      reason,
      reasonLabel: returnReasons[reason],
      notes,
      requestedAt: new Date().toISOString(),
      requestedBy: request.user.uid,
      status: 'pending_review',
    }

    await orderReference.set(
      {
        returnRequest,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: 'return_requested',
          updatedAt: returnRequest.requestedAt,
          updatedBy: request.user.uid,
        }),
      },
      { merge: true },
    )

    return response.status(201).json({
      order: { id: snapshot.id, ...order, returnRequest },
    })
  } catch (error) {
    return next(error)
  }
})

orderRouter.patch('/:orderId/return', requireAuth, async (request, response, next) => {
  try {
    if (!(await requireAdminUser(request, response))) return

    const status = String(request.body.status || '').trim()
    const adminNotes = String(request.body.adminNotes || '').trim()
    if (!returnRequestStatuses.includes(status)) {
      return response.status(400).json({ message: 'Choose a valid return decision.' })
    }

    if (status === 'declined' && !adminNotes) {
      return response.status(400).json({ message: 'Add a reason before declining this return request.' })
    }

    const orderReference = firestore().collection('orders').doc(request.params.orderId)
    const snapshot = await orderReference.get()

    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Order not found.' })
    }

    const order = snapshot.data()
    if (order.returnRequest?.status !== 'pending_review') {
      return response.status(409).json({ message: 'This order does not have a pending return request.' })
    }

    const reviewedAt = new Date().toISOString()
    const returnRequest = {
      ...order.returnRequest,
      adminNotes,
      reviewedAt,
      reviewedBy: request.user.uid,
      status,
    }
    const returnedItemIndexes = new Set((returnRequest.items || []).map((item) => Number(item.itemIndex)))
    const orderStatus =
      status === 'approved' && returnedItemIndexes.size > 0 && returnedItemIndexes.size === (order.items || []).length
        ? 'returned'
        : order.status

    await orderReference.set(
      {
        payment: {
          ...(order.payment || {}),
          refundStatus: status === 'approved' ? 'approved_pending_processing' : 'not_approved',
        },
        returnRequest,
        status: orderStatus,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: status === 'approved' ? 'return_approved' : 'return_declined',
          updatedAt: reviewedAt,
          updatedBy: request.user.uid,
        }),
      },
      { merge: true },
    )

    return response.json({
      order: {
        id: snapshot.id,
        ...order,
        payment: {
          ...(order.payment || {}),
          refundStatus: status === 'approved' ? 'approved_pending_processing' : 'not_approved',
        },
        returnRequest,
        status: orderStatus,
      },
    })
  } catch (error) {
    return next(error)
  }
})

orderRouter.patch('/:orderId/cancel', requireAuth, async (request, response, next) => {
  try {
    const database = firestore()
    const orderReference = database.collection('orders').doc(request.params.orderId)

    const result = await database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderReference)

      if (!snapshot.exists) {
        const error = new Error('Order not found.')
        error.status = 404
        throw error
      }

      const order = snapshot.data()
      if (order.userId !== request.user.uid) {
        const error = new Error('You can only cancel your own orders.')
        error.status = 403
        throw error
      }

      if (!buyerCancellableStatuses.includes(order.status)) {
        const error = new Error('This order can no longer be cancelled.')
        error.status = 409
        throw error
      }

      const stockReferences = (order.items || []).map((item) => ({
        item,
        productReference: database.collection('products').doc(item.productId),
      }))
      const productSnapshots = await Promise.all(
        stockReferences.map(({ productReference }) => transaction.get(productReference)),
      )
      const stockUpdates = []

      stockReferences.forEach(({ item, productReference }, index) => {
        const productSnapshot = productSnapshots[index]
        if (!productSnapshot.exists) return

        const product = productSnapshot.data()
        const quantity = Number(item.quantity || 0)
        const stock = (Number(product.stock) || 0) + quantity
        const sold = Math.max(0, (Number(product.sold) || 0) - quantity)
        transaction.update(productReference, { sold, stock })
        stockUpdates.push({ productId: item.productId, sold, stock })

        const sellerId = product.sellerId || item.sellerId
        const sellerItemId = product.sellerItemId || item.sellerItemId
        if (sellerId && sellerItemId) {
          transaction.update(
            database.collection('sellers').doc(sellerId).collection('items').doc(sellerItemId),
            {
              sold,
              stock,
              updatedAt: FieldValue.serverTimestamp(),
            },
          )
        }
      })

      transaction.set(
        orderReference,
        {
          status: 'cancelled',
          updatedAt: FieldValue.serverTimestamp(),
          stockRestoredAt: FieldValue.serverTimestamp(),
          statusHistory: FieldValue.arrayUnion({
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
            updatedBy: request.user.uid,
          }),
        },
        { merge: true },
      )

      return {
        order: { id: snapshot.id, ...order, status: 'cancelled' },
        stockUpdates,
      }
    })

    result.stockUpdates.forEach((stockUpdate) => broadcastStockUpdate(stockUpdate))
    return response.json({ order: result.order })
  } catch (error) {
    if (error.status) return response.status(error.status).json({ message: error.message })
    return next(error)
  }
})

orderRouter.post('/:orderId/items/:productId/review', requireAuth, async (request, response, next) => {
  try {
    const rating = Number(request.body.rating)
    const title = String(request.body.title || '').trim()
    const body = String(request.body.body || '').trim()

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return response.status(400).json({ message: 'Choose a rating from 1 to 5 stars.' })
    }

    if (!title || !body) {
      return response.status(400).json({ message: 'Add a review title and comment.' })
    }

    const database = firestore()
    const orderReference = database.collection('orders').doc(request.params.orderId)
    const productReference = database.collection('products').doc(request.params.productId)
    const reviewReference = productReference
      .collection('reviews')
      .doc(`${request.params.orderId}_${request.user.uid}`)

    const result = await database.runTransaction(async (transaction) => {
      const [orderSnapshot, productSnapshot, reviewSnapshot] = await Promise.all([
        transaction.get(orderReference),
        transaction.get(productReference),
        transaction.get(reviewReference),
      ])

      if (!orderSnapshot.exists) {
        const error = new Error('Order not found.')
        error.status = 404
        throw error
      }

      if (!productSnapshot.exists) {
        const error = new Error('Product not found.')
        error.status = 404
        throw error
      }

      if (reviewSnapshot.exists) {
        const error = new Error('You have already reviewed this item.')
        error.status = 409
        throw error
      }

      const order = orderSnapshot.data()
      if (order.userId !== request.user.uid) {
        const error = new Error('You can only review your own orders.')
        error.status = 403
        throw error
      }

      if (order.status !== 'delivered') {
        const error = new Error('Reviews are available after delivery.')
        error.status = 409
        throw error
      }

      const items = order.items || []
      const matchingItem = items.find((item) => item.productId === request.params.productId)
      if (!matchingItem) {
        const error = new Error('This product is not part of the order.')
        error.status = 404
        throw error
      }

      if (matchingItem.reviewed) {
        const error = new Error('You have already reviewed this item.')
        error.status = 409
        throw error
      }

      const product = productSnapshot.data()
      const currentReviews = Number(product.reviews) || 0
      const currentRating = Number(product.rating) || 0
      const nextReviews = currentReviews + 1
      const nextRating = ((currentRating * currentReviews) + rating) / nextReviews
      const reviewedAt = new Date().toISOString()
      const nextItems = items.map((item) =>
        item.productId === request.params.productId
          ? { ...item, reviewed: true, reviewRating: rating, reviewedAt }
          : item,
      )
      const orderReviewed = nextItems.every((item) => item.reviewed)
      const review = {
        author: request.user.name || request.user.email || 'Verified customer',
        body,
        createdAt: FieldValue.serverTimestamp(),
        date: reviewedAt,
        orderId: request.params.orderId,
        productId: request.params.productId,
        rating,
        title,
        userId: request.user.uid,
        verified: true,
      }

      transaction.set(reviewReference, review)
      transaction.update(productReference, {
        rating: Number(nextRating.toFixed(2)),
        reviews: nextReviews,
        updatedAt: FieldValue.serverTimestamp(),
      })

      if (product.sellerId && product.sellerItemId) {
        transaction.update(
          database.collection('sellers').doc(product.sellerId).collection('items').doc(product.sellerItemId),
          {
            rating: Number(nextRating.toFixed(2)),
            reviews: nextReviews,
            updatedAt: FieldValue.serverTimestamp(),
          },
        )
      }

      transaction.update(orderReference, {
        items: nextItems,
        reviewed: orderReviewed,
        updatedAt: FieldValue.serverTimestamp(),
      })

      return {
        order: {
          id: orderSnapshot.id,
          ...order,
          items: nextItems,
          reviewed: orderReviewed,
        },
        review: { ...review, createdAt: null },
      }
    })

    return response.status(201).json(result)
  } catch (error) {
    if (error.status) return response.status(error.status).json({ message: error.message })
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
      const references = productIds.map((productId) => ({
        productId,
        productReference: database.collection('products').doc(productId),
      }))
      const snapshots = await Promise.all(
        references.map(({ productReference }) => transaction.get(productReference)),
      )

      const orderProducts = []
      const stockUpdates = []
      references.forEach((reference, index) => {
        const productSnapshot = snapshots[index]
        const requestedQuantity = quantitiesByProduct[reference.productId]

        if (!productSnapshot.exists) {
          const error = new Error('A product in your cart no longer exists.')
          error.status = 409
          throw error
        }

        const product = productSnapshot.data()
        const currentStock = Number(product.stock) || 0
        const currentSold = Number(product.sold) || 0
        const nextStock = currentStock - requestedQuantity
        const nextSold = currentSold + requestedQuantity

        if (nextStock < 0) {
          const error = new Error(`Only ${currentStock} ${product.name} item${currentStock === 1 ? '' : 's'} remaining.`)
          error.status = 409
          throw error
        }

        orderProducts.push({
          productId: reference.productId,
          sellerId: product.sellerId || '',
          sellerItemId: product.sellerItemId || '',
          name: product.name,
          price: Number(product.price),
          quantity: requestedQuantity,
        })
        stockUpdates.push({ productId: reference.productId, sold: nextSold, stock: nextStock })
        transaction.update(reference.productReference, {
          sold: FieldValue.increment(requestedQuantity),
          stock: nextStock,
        })

        if (product.sellerId && product.sellerItemId) {
          transaction.update(
            database
              .collection('sellers')
              .doc(product.sellerId)
              .collection('items')
              .doc(product.sellerItemId),
            {
              sold: FieldValue.increment(requestedQuantity),
              stock: nextStock,
              updatedAt: FieldValue.serverTimestamp(),
            },
          )
        }
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
          sellerId: orderProducts.find((product) => product.productId === item.productId)?.sellerId || '',
          sellerItemId: orderProducts.find((product) => product.productId === item.productId)?.sellerItemId || '',
          name: item.name,
          quantity: item.quantity,
          color: item.color || '',
          size: item.size || '',
          media: item.media || [],
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

      return {
        id: orderReference.id,
        status: orderData.status,
        total,
        paymentStatus: orderData.payment.status,
        stockUpdates,
      }
    })

    order.stockUpdates.forEach((stockUpdate) => broadcastStockUpdate(stockUpdate))
    const { stockUpdates, ...orderResponse } = order
    return response.status(201).json({ order: orderResponse })
  } catch (error) {
    if (error.status) return response.status(error.status).json({ message: error.message })
    return next(error)
  }
})

export default orderRouter
