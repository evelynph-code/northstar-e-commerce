let socketServer

export function setSocketServer(server) {
  socketServer = server
}

export function broadcastStockUpdate(payload) {
  socketServer?.emit('product:stock', payload)
}
