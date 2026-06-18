import cors from 'cors'
import express from 'express'

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  }),
)
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    message: 'E-commerce API is running',
  })
})

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' })
})

export default app
