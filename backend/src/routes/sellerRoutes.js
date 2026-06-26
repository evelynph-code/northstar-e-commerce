import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { firestore } from '../config/firebase.js'
import { requireAuth } from '../middleware/requireAuth.js'

const sellerRouter = Router()
const uploadsRoot = path.join(process.cwd(), 'uploads')
const mediaTypeByMime = {
  'image/gif': { extension: 'gif', type: 'image' },
  'image/jpeg': { extension: 'jpg', type: 'image' },
  'image/png': { extension: 'png', type: 'image' },
  'image/webp': { extension: 'webp', type: 'image' },
  'video/mp4': { extension: 'mp4', type: 'video' },
  'video/quicktime': { extension: 'mov', type: 'video' },
  'video/webm': { extension: 'webm', type: 'video' },
}

function sellerReference(uid) {
  return firestore().collection('sellers').doc(uid)
}

function itemReference(uid, itemId) {
  return sellerReference(uid).collection('items').doc(itemId)
}

async function requireAdminUser(request, response) {
  const snapshot = await firestore().collection('users').doc(request.user.uid).get()
  if (snapshot.data()?.isAdmin) return true

  response.status(403).json({ message: 'Admin access required.' })
  return false
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '')
  if (!match) return null

  const mediaConfig = mediaTypeByMime[match[1]]
  if (!mediaConfig) return null

  return {
    ...mediaConfig,
    buffer: Buffer.from(match[2], 'base64'),
    mimeType: match[1],
  }
}

function parseList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  return String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseSpecifications(value) {
  if (Array.isArray(value)) {
    return value
      .map((specification) => ({
        label: String(specification.label || '').trim(),
        value: String(specification.value || '').trim(),
      }))
      .filter((specification) => specification.label && specification.value)
  }

  return String(value || '')
    .split('\n')
    .map((line) => {
      const [label, ...rest] = line.split(':')
      return { label: label?.trim() || '', value: rest.join(':').trim() }
    })
    .filter((specification) => specification.label && specification.value)
}

function normalizeProductPayload(body) {
  const stock = Number(body.stock)
  const price = Number(body.price)

  return {
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim(),
    description: String(body.description || '').trim(),
    price,
    stock,
    colors: parseList(body.colors).map((name) => ({ name, hex: '#e2e8f0' })),
    sizes: parseList(body.sizes),
    features: parseList(body.features),
    howToUse: String(body.howToUse || '').trim(),
    careInstructions: String(body.careInstructions || '').trim(),
    specifications: parseSpecifications(body.specifications),
  }
}

async function saveMediaFiles(uid, itemId, files = []) {
  const mediaDirectory = path.join(uploadsRoot, 'sellers', uid, itemId)
  await mkdir(mediaDirectory, { recursive: true })

  const savedFiles = []
  for (const file of files) {
    const parsed = parseDataUrl(file.url)
    if (!parsed) continue

    const id = randomUUID()
    const filename = `${id}.${parsed.extension}`
    await writeFile(path.join(mediaDirectory, filename), parsed.buffer)
    savedFiles.push({
      id,
      name: String(file.name || filename).slice(0, 160),
      type: parsed.type,
      mimeType: parsed.mimeType,
      url: `/uploads/sellers/${uid}/${itemId}/${filename}`,
    })
  }

  return savedFiles
}

async function normalizeMedia(uid, itemId, files = []) {
  const existingFiles = files
    .filter((file) => typeof file.url === 'string' && file.url.startsWith('/uploads/'))
    .map((file) => ({
      id: String(file.id || randomUUID()),
      name: String(file.name || 'Media').slice(0, 160),
      type: file.type === 'video' ? 'video' : 'image',
      mimeType: String(file.mimeType || ''),
      url: file.url,
    }))
  const newFiles = await saveMediaFiles(
    uid,
    itemId,
    files.filter((file) => typeof file.url === 'string' && file.url.startsWith('data:')),
  )

  return [...existingFiles, ...newFiles]
}

sellerRouter.get('/workspace', requireAuth, async (request, response, next) => {
  try {
    const [sellerSnapshot, itemsSnapshot] = await Promise.all([
      sellerReference(request.user.uid).get(),
      sellerReference(request.user.uid).collection('items').get(),
    ])

    const items = itemsSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis?.() || 0
        const secondTime = second.createdAt?.toMillis?.() || 0
        return secondTime - firstTime
      })

    return response.json({
      shop: sellerSnapshot.exists ? sellerSnapshot.data().shop || {} : {},
      items,
    })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.put('/shop', requireAuth, async (request, response, next) => {
  try {
    const shop = {
      name: String(request.body.name || '').trim(),
      category: String(request.body.category || '').trim(),
      city: String(request.body.city || '').trim(),
      description: String(request.body.description || '').trim(),
    }

    if (!shop.name || !shop.category) {
      return response.status(400).json({ message: 'Shop name and selling category are required.' })
    }

    await sellerReference(request.user.uid).set(
      {
        shop,
        uid: request.user.uid,
        email: request.user.email,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return response.json({ shop })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.get('/public/:sellerId', async (request, response, next) => {
  try {
    const [sellerSnapshot, productsSnapshot] = await Promise.all([
      sellerReference(request.params.sellerId).get(),
      firestore()
        .collection('products')
        .where('sellerId', '==', request.params.sellerId)
        .get(),
    ])

    if (!sellerSnapshot.exists) {
      return response.status(404).json({ message: 'Shop not found.' })
    }

    const shop = sellerSnapshot.data().shop || {}
    const products = productsSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((product) => !product.approvalStatus || product.approvalStatus === 'approved')
      .sort((first, second) => first.name.localeCompare(second.name))

    return response.json({ shop, products })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.post('/items', requireAuth, async (request, response, next) => {
  try {
    const itemId = randomUUID()
    const productFields = normalizeProductPayload(request.body)

    if (!productFields.name || !Number.isFinite(productFields.price) || !Number.isInteger(productFields.stock)) {
      return response.status(400).json({ message: 'Item name, price, and stock are required.' })
    }

    const media = await normalizeMedia(request.user.uid, itemId, request.body.media)
    const item = {
      id: itemId,
      sellerId: request.user.uid,
      sellerEmail: request.user.email,
      ...productFields,
      media,
      approvalStatus: 'pending_review',
      status: 'pending_review',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    await itemReference(request.user.uid, itemId).set(item)

    return response.status(201).json({ item: { ...item, createdAt: null, updatedAt: null } })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.get('/items/:itemId', requireAuth, async (request, response, next) => {
  try {
    const snapshot = await itemReference(request.user.uid, request.params.itemId).get()
    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Item not found.' })
    }

    return response.json({ item: { id: snapshot.id, ...snapshot.data() } })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.put('/items/:itemId', requireAuth, async (request, response, next) => {
  try {
    const reference = itemReference(request.user.uid, request.params.itemId)
    const snapshot = await reference.get()
    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Item not found.' })
    }

    const productFields = normalizeProductPayload(request.body)
    if (!productFields.name || !Number.isFinite(productFields.price) || !Number.isInteger(productFields.stock)) {
      return response.status(400).json({ message: 'Item name, price, and stock are required.' })
    }

    const media = await normalizeMedia(request.user.uid, request.params.itemId, request.body.media)
    const updates = {
      ...productFields,
      media,
      approvalStatus: 'pending_review',
      status: 'pending_review',
      updatedAt: FieldValue.serverTimestamp(),
    }

    await reference.set(updates, { merge: true })
    return response.json({ item: { id: snapshot.id, ...snapshot.data(), ...updates, updatedAt: null } })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.patch('/items/:itemId/status', requireAuth, async (request, response, next) => {
  try {
    const status = String(request.body.status || '').trim()
    if (!['draft', 'pending_review'].includes(status)) {
      return response.status(400).json({ message: 'Choose a valid item status.' })
    }

    const reference = itemReference(request.user.uid, request.params.itemId)
    const snapshot = await reference.get()
    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Item not found.' })
    }

    await reference.set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return response.json({ item: { id: snapshot.id, ...snapshot.data(), status } })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.get('/admin/items', requireAuth, async (request, response, next) => {
  try {
    if (!(await requireAdminUser(request, response))) return

    const sellerSnapshots = await firestore().collection('sellers').get()
    const itemSnapshots = await Promise.all(
      sellerSnapshots.docs.map(async (sellerDocument) => {
        const itemsSnapshot = await sellerDocument.ref.collection('items').get()
        const seller = sellerDocument.data()
        return itemsSnapshot.docs.map((itemDocument) => ({
          id: itemDocument.id,
          sellerId: sellerDocument.id,
          shop: seller.shop || {},
          ...itemDocument.data(),
        }))
      }),
    )
    const items = itemSnapshots
      .flat()
      .filter((item) => item.approvalStatus === 'pending_review')
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis?.() || 0
        const secondTime = second.createdAt?.toMillis?.() || 0
        return secondTime - firstTime
      })

    return response.json({ items })
  } catch (error) {
    return next(error)
  }
})

sellerRouter.patch('/admin/items/:sellerId/:itemId/approve', requireAuth, async (request, response, next) => {
  try {
    if (!(await requireAdminUser(request, response))) return

    const database = firestore()
    const sellerSnapshot = await sellerReference(request.params.sellerId).get()
    const reference = itemReference(request.params.sellerId, request.params.itemId)
    const snapshot = await reference.get()

    if (!snapshot.exists) {
      return response.status(404).json({ message: 'Seller item not found.' })
    }

    const item = snapshot.data()
    const shop = sellerSnapshot.data()?.shop || {}
    const productReference = database.collection('products').doc(item.productId || request.params.itemId)
    const product = {
      name: item.name,
      category: item.category || shop.category || 'Marketplace',
      description: item.description || '',
      price: Number(item.price),
      stock: Number(item.stock),
      media: item.media || [],
      colors: item.colors || [],
      sizes: item.sizes || [],
      features: item.features || [],
      howToUse: item.howToUse || '',
      careInstructions: item.careInstructions || '',
      specifications: item.specifications || [],
      sellerId: request.params.sellerId,
      sellerItemId: request.params.itemId,
      shopName: shop.name || '',
      approvalStatus: 'approved',
      rating: Number(item.rating) || 0,
      reviews: Number(item.reviews) || 0,
      sold: Number(item.sold) || 0,
      updatedAt: FieldValue.serverTimestamp(),
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: request.user.uid,
    }

    await Promise.all([
      productReference.set(product, { merge: true }),
      reference.set(
        {
          approvalStatus: 'approved',
          status: 'approved',
          productId: productReference.id,
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: request.user.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    ])

    return response.json({
      item: {
        id: snapshot.id,
        ...item,
        approvalStatus: 'approved',
        status: 'approved',
        productId: productReference.id,
      },
    })
  } catch (error) {
    return next(error)
  }
})

export default sellerRouter
