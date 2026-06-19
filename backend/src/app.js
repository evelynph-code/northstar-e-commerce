import cors from 'cors'
import express from 'express'
import authRouter from './routes/authRoutes.js'

const app = express()

const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

app.use(
  cors({
    origin(origin, callback) {
      const isLocalViteOrigin =
        process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

      if (!origin || configuredOrigins.includes(origin) || isLocalViteOrigin) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`))
    },
  }),
)
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    message: 'E-commerce API is running',
  })
})

app.use('/api/auth', authRouter)

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ message: 'Internal server error.' })
})

export default app
