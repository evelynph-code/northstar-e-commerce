import 'dotenv/config'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import app from './app.js'
import { setSocketServer } from './socket.js'

const port = process.env.PORT || 5000
const httpServer = createServer(app)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      const isLocalOrigin =
        process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

      callback(null, !origin || allowedOrigins.includes(origin) || isLocalOrigin)
    },
    methods: ['GET', 'POST'],
  },
})

setSocketServer(io)

io.on('connection', (socket) => {
  socket.emit('inventory:connected', { connected: true })

  socket.on('product:watch', async (productId) => {
    if (typeof productId !== 'string' || !productId) return

    const previousProduct = socket.data.productId
    if (previousProduct) {
      socket.leave(`product:${previousProduct}`)
      const previousRoom = io.sockets.adapter.rooms.get(`product:${previousProduct}`)
      io.to(`product:${previousProduct}`).emit('product:viewers', {
        productId: previousProduct,
        viewers: previousRoom?.size || 0,
      })
    }

    socket.data.productId = productId
    await socket.join(`product:${productId}`)
    const room = io.sockets.adapter.rooms.get(`product:${productId}`)
    io.to(`product:${productId}`).emit('product:viewers', {
      productId,
      viewers: room?.size || 0,
    })
  })

  socket.on('disconnecting', () => {
    const productId = socket.data.productId
    if (!productId) return

    const room = io.sockets.adapter.rooms.get(`product:${productId}`)
    socket.to(`product:${productId}`).emit('product:viewers', {
      productId,
      viewers: Math.max(0, (room?.size || 1) - 1),
    })
  })
})

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
