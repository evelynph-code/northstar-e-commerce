import { io } from 'socket.io-client'

export const inventorySocket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
})
