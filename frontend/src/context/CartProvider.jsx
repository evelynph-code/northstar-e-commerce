import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ShoppingBag, X } from 'lucide-react'
import { CartContext } from './cart-context.js'
import { inventorySocket } from '../lib/socket.js'

// Versioned because inventory reservations were introduced after the original
// client-only cart. Old line items must not be released into live stock.
const storageKey = 'northstar-cart-v3'
const cartIdKey = 'northstar-cart-id-v3'

function getInitialCart() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || []
  } catch {
    return []
  }
}

function getLineId(productId, color, size) {
  return [productId, color || 'default', size || 'default'].join(':')
}

function getCartId() {
  const existing = localStorage.getItem(cartIdKey)
  if (existing) return existing

  const id = crypto.randomUUID()
  localStorage.setItem(cartIdKey, id)
  return id
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(getInitialCart)
  const [cartId, setCartId] = useState(getCartId)
  const [notification, setNotification] = useState(null)
  const notificationId = useRef(0)
  const notificationTimer = useRef(null)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items))
  }, [items])

  useEffect(
    () => () => {
      window.clearTimeout(notificationTimer.current)
    },
    [],
  )

  useEffect(() => {
    const handleStockUpdate = ({ productId, stock }) => {
      setItems((current) =>
        current.map((item) =>
          item.productId === productId
            ? { ...item, stock: stock + item.quantity }
            : item,
        ),
      )
    }

    inventorySocket.on('product:stock', handleStockUpdate)
    return () => inventorySocket.off('product:stock', handleStockUpdate)
  }, [])

  const adjustInventory = async (productId, delta) => {
    const response = await fetch(`/api/products/${productId}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId, delta }),
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(body.message || 'Unable to update inventory.')
    }

    return body
  }

  const addItem = async (product, options = {}) => {
    const color = options.color || product.colors?.[0]?.name || ''
    const size = options.size || product.sizes?.[0] || ''
    const quantity = Math.max(1, Number(options.quantity) || 1)
    const lineId = getLineId(product.id, color, size)
    const requestedQuantity = Math.min(
      quantity,
      Math.max(0, product.stock),
    )

    if (requestedQuantity === 0) {
      throw new Error('No more stock is available for this item.')
    }

    const inventory = await adjustInventory(product.id, requestedQuantity)

    setItems((current) => {
      const currentItem = current.find((item) => item.lineId === lineId)

      if (currentItem) {
        return current.map((item) =>
          item.lineId === lineId
            ? {
                ...item,
                quantity: item.quantity + requestedQuantity,
                stock: inventory.stock + item.quantity + requestedQuantity,
              }
            : item,
        )
      }

      return [
        ...current,
        {
          lineId,
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          originalPrice: product.originalPrice || null,
          stock: inventory.stock + requestedQuantity,
          color,
          size,
          galleryColors: product.galleryColors || [],
          quantity: requestedQuantity,
        },
      ]
    })

    window.clearTimeout(notificationTimer.current)
    notificationId.current += 1
    setNotification({
      id: notificationId.current,
      name: product.name,
      quantity: requestedQuantity,
    })
    notificationTimer.current = window.setTimeout(() => {
      setNotification(null)
    }, 3200)
  }

  const updateQuantity = async (lineId, quantity) => {
    const item = items.find((candidate) => candidate.lineId === lineId)
    if (!item) return

    const nextQuantity = Math.max(1, Math.min(quantity, item.stock))
    const delta = nextQuantity - item.quantity
    if (delta === 0) return

    const inventory = await adjustInventory(item.productId, delta)
    setItems((current) =>
      current.map((candidate) =>
        candidate.lineId === lineId
          ? { ...candidate, quantity: nextQuantity, stock: inventory.stock + nextQuantity }
          : candidate,
      ),
    )
  }

  const removeItem = async (lineId) => {
    const item = items.find((candidate) => candidate.lineId === lineId)
    if (!item) return

    await adjustInventory(item.productId, -item.quantity)
    setItems((current) => current.filter((item) => item.lineId !== lineId))
  }

  const completeOrder = () => {
    setItems([])
    const nextCartId = crypto.randomUUID()
    localStorage.setItem(cartIdKey, nextCartId)
    setCartId(nextCartId)
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const originalSubtotal = items.reduce(
    (sum, item) => sum + (item.originalPrice || item.price) * item.quantity,
    0,
  )
  const value = {
    addItem,
    cartId,
    completeOrder,
    itemCount,
    items,
    originalSubtotal,
    removeItem,
    subtotal,
    updateQuantity,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
      {notification && (
        <div
          aria-atomic="true"
          aria-live="polite"
          className="cart-toast fixed inset-x-4 top-4 z-[100] ml-auto overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl shadow-slate-900/15 sm:left-auto sm:right-6 sm:top-6 sm:w-[380px]"
          key={notification.id}
          role="status"
        >
          <div className="flex items-center gap-3 p-4 pr-12">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={23} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[#11243e]">Added to your cart</p>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {notification.quantity} × {notification.name}
              </p>
            </div>
            <ShoppingBag className="ml-auto shrink-0 text-slate-300" size={20} />
          </div>
          <button
            aria-label="Dismiss notification"
            className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setNotification(null)}
            type="button"
          >
            <X size={16} />
          </button>
          <div className="cart-toast-progress h-1 origin-left bg-emerald-500" />
        </div>
      )}
    </CartContext.Provider>
  )
}
