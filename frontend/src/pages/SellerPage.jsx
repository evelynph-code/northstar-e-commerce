import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Home,
  Image,
  Mail,
  MapPin,
  PackagePlus,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShoppingBag,
  Store,
  Video,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { inventorySocket } from '../lib/socket.js'

const emptyShop = {
  name: '',
  category: '',
  description: '',
  city: '',
}
const sellerCategories = ['Apparel', 'Accessories', 'Footwear', 'Home goods', 'Electronics', 'Beauty']
const statusStyles = {
  confirmed: 'bg-blue-50 text-blue-700',
  packing: 'bg-amber-50 text-amber-700',
  shipped: 'bg-indigo-50 text-indigo-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
  returned: 'bg-slate-100 text-slate-700',
}
const orderViews = [
  { id: 'all', label: 'All orders', statuses: [] },
  { id: 'action', label: 'Needs action', statuses: ['confirmed', 'packing'] },
  { id: 'shipping', label: 'Shipping', statuses: ['shipped'] },
  { id: 'closed', label: 'Closed', statuses: ['delivered', 'cancelled', 'returned'] },
]

function SellerPage() {
  const { authLoading, profile, user } = useAuth()

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (!user) return <Navigate replace state={{ from: '/seller' }} to="/login" />

  return <SellerWorkspace key={user.uid} profile={profile} user={user} />
}

function SellerWorkspace({ profile, user }) {
  const [shop, setShop] = useState(emptyShop)
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [orderStatuses, setOrderStatuses] = useState([])
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingOrderId, setSavingOrderId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeOrderView, setActiveOrderView] = useState(orderViews[0].id)
  const [orderQuery, setOrderQuery] = useState('')

  const shopReady = Boolean(shop.name.trim())
  const inventoryValue = useMemo(
    () => items.reduce((total, item) => total + Number(item.price) * Number(item.stock), 0),
    [items],
  )
  const pendingReturns = useMemo(
    () => orders.filter((order) => order.returnRequest?.status === 'pending_review').length,
    [orders],
  )
  const activeOrders = useMemo(
    () => orders.filter((order) => ['confirmed', 'packing', 'shipped'].includes(order.status)).length,
    [orders],
  )
  const orderViewCounts = useMemo(
    () => orderViews.reduce((counts, view) => {
      counts[view.id] = view.statuses.length === 0
        ? orders.length
        : orders.filter((order) => view.statuses.includes(order.status)).length
      return counts
    }, {}),
    [orders],
  )
  const visibleOrders = useMemo(() => {
    const view = orderViews.find((orderView) => orderView.id === activeOrderView) || orderViews[0]
    const normalizedQuery = orderQuery.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesView = view.statuses.length === 0 || view.statuses.includes(order.status)
      if (!matchesView) return false
      if (!normalizedQuery) return true

      const delivery = order.delivery || {}
      const searchable = [
        order.id,
        order.customerEmail,
        delivery.fullName,
        delivery.email,
        delivery.phone,
        delivery.city,
        ...(order.items || []).map((item) => item.name),
      ].filter(Boolean).join(' ').toLowerCase()

      return searchable.includes(normalizedQuery)
    })
  }, [activeOrderView, orderQuery, orders])

  useEffect(() => {
    const controller = new AbortController()

    async function loadWorkspace() {
      try {
        const token = await user.getIdToken()
        const [workspaceResponse, ordersResponse] = await Promise.all([
          fetch('/api/seller/workspace', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }),
          fetch('/api/orders/seller', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }),
        ])
        const body = await workspaceResponse.json().catch(() => ({}))
        const ordersBody = await ordersResponse.json().catch(() => ({}))
        if (!workspaceResponse.ok) throw new Error(body.message || 'Unable to load seller workspace.')
        if (!ordersResponse.ok) throw new Error(ordersBody.message || 'Unable to load seller orders.')

        setShop({ ...emptyShop, ...(body.shop || {}) })
        setItems(body.items || [])
        setOrders(ordersBody.orders || [])
        setOrderStatuses(ordersBody.statuses || [])
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setWorkspaceLoading(false)
      }
    }

    loadWorkspace()
    return () => controller.abort()
  }, [user])

  useEffect(() => {
    const handleStockUpdate = ({ productId, sold, stock }) => {
      setItems((current) =>
        current.map((item) =>
          item.productId === productId
            ? {
                ...item,
                sold: typeof sold === 'number' ? sold : item.sold,
                stock,
              }
            : item,
        ),
      )
    }

    inventorySocket.on('product:stock', handleStockUpdate)
    return () => inventorySocket.off('product:stock', handleStockUpdate)
  }, [])

  const updateShopField = (event) => {
    setShop((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const saveShop = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/seller/shop', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shop),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to save shop profile.')

      setShop({ ...emptyShop, ...body.shop })
      setMessage('Shop profile saved.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const updateOrderStatus = async (orderId, status) => {
    const currentOrders = orders
    setSavingOrderId(orderId)
    setError('')
    setOrders((existingOrders) =>
      existingOrders.map((order) => (order.id === orderId ? { ...order, status } : order)),
    )

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to update order status.')
      setMessage('Order status updated.')
    } catch (caughtError) {
      setOrders(currentOrders)
      setError(caughtError.message)
    } finally {
      setSavingOrderId('')
    }
  }

  const reviewReturnRequest = async (orderId, status, sellerNotes) => {
    const currentOrders = orders
    if (status === 'declined' && !sellerNotes.trim()) {
      setError('Add a decision note before declining this return request.')
      return
    }

    setSavingOrderId(orderId)
    setError('')

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/orders/${orderId}/return`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminNotes: sellerNotes, status }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to update the return request.')

      setOrders((existingOrders) =>
        existingOrders.map((order) => (order.id === body.order.id ? body.order : order)),
      )
      setMessage(status === 'approved' ? 'Return approved and refund initialized.' : 'Return request declined.')
    } catch (caughtError) {
      setOrders(currentOrders)
      setError(caughtError.message)
    } finally {
      setSavingOrderId('')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="page-container flex flex-wrap items-center gap-3 py-4">
          <Link className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" to="/account">
            <ArrowLeft size={17} /> Account
          </Link>
          <Link className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" to="/">
            <Home size={17} /> Store
          </Link>
          <Link className="ml-auto text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
        </div>
      </header>

      <div className="page-container py-10 sm:py-14">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#11243e] text-white shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-blue-100">Seller workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {shopReady ? shop.name : `${profile?.userName || profile?.displayName || 'Your'} shop`}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Manage products, fulfill orders, and review return requests from one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-white ring-1 ring-white/15">{profile?.email}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-white ring-1 ring-white/15">{shop.category || 'Category not set'}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-white ring-1 ring-white/15">{shop.city || 'Location not set'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#11243e] hover:bg-blue-50" to="/seller/products/new">
                <PackagePlus size={17} /> Create product
              </Link>
              <Link className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10" to="/seller/shop">
                <ExternalLink size={17} /> View shop
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={ShoppingBag} label="Total orders" value={orders.length} />
          <Stat icon={Clock3} label="Active orders" value={activeOrders} />
          <Stat icon={RotateCcw} label="Returns" tone={pendingReturns > 0 ? 'blue' : 'slate'} value={pendingReturns} />
          <Stat icon={Boxes} label="Products" value={items.length} />
          <Stat icon={BadgeDollarSign} label="Inventory value" value={`$${inventoryValue.toFixed(2)}`} />
        </div>

        {workspaceLoading && <div className="mt-8 grid min-h-40 place-items-center rounded-3xl border border-slate-200 bg-white"><span className="size-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></div>}
        {message && <p className="mt-6 rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-700" role="status">{message}</p>}
        {error && <p className="mt-6 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">{error}</p>}

        {!workspaceLoading && (
          <div className="mt-8 grid items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-6 xl:sticky xl:top-24">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-blue-50 text-blue-700"><Store size={20} /></span>
                    <div>
                      <h2 className="font-semibold text-[#11243e]">Shop profile</h2>
                      <p className="text-xs text-slate-500">{shopReady ? 'Live storefront settings' : 'Finish setup to go live'}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${shopReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {shopReady ? 'Active' : 'Draft'}
                  </span>
                </div>
              <form className="mt-6 space-y-5" onSubmit={saveShop}>
                <Field label="Shop name" name="name" onChange={updateShopField} value={shop.name} />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Selling category</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    name="category"
                    onChange={updateShopField}
                    required
                    value={shop.category}
                  >
                    <option value="">Choose a category</option>
                    {sellerCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <Field label="City / Province" name="city" onChange={updateShopField} value={shop.city} />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Description</span>
                  <textarea
                    className="min-h-28 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    name="description"
                    onChange={updateShopField}
                    value={shop.description}
                  />
                </label>
                <button className="inline-flex items-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">
                  <Save size={17} /> Save shop
                </button>
              </form>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#11243e]">Product health</h2>
                    <p className="mt-1 text-sm text-slate-500">{items.filter((item) => item.approvalStatus === 'approved').length} approved products</p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={20} /></span>
                </div>
                <div className="mt-5 space-y-3">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                      <PackagePlus className="mx-auto text-slate-400" size={26} />
                      <h3 className="mt-3 font-semibold text-[#11243e]">No products yet</h3>
                      <Link className="mt-3 inline-flex text-sm font-semibold text-blue-700" to="/seller/products/new">Create your first product</Link>
                    </div>
                  ) : (
                    items.slice(0, 5).map((item) => (
                    <article className="flex gap-3 rounded-2xl border border-slate-200 p-3" key={item.id}>
                      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
                        <ItemMediaPreview item={item} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-[#11243e]">{item.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{item.category || 'Uncategorized'} · {item.stock} in stock · {Number(item.sold || 0).toLocaleString()} sold</p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.approvalStatus || item.status}</span>
                          <Link className="text-xs font-semibold text-blue-700 hover:text-blue-900" to={`/seller/products/${item.id}/edit`}>Edit</Link>
                        </div>
                      </div>
                    </article>
                  ))
                )}
                  {items.length > 5 && <Link className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900" to="/seller/shop">View all products</Link>}
                </div>
              </section>
            </aside>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-blue-50 text-blue-700"><Boxes size={21} /></span>
                  <div>
                    <h2 className="text-xl font-semibold text-[#11243e]">Order control</h2>
                    <p className="mt-1 text-sm text-slate-500">Update fulfillment status, find customers, and handle returns.</p>
                  </div>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    onChange={(event) => setOrderQuery(event.target.value)}
                    placeholder="Search orders..."
                    value={orderQuery}
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {orderViews.map((view) => (
                  <button
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${activeOrderView === view.id ? 'bg-[#11243e] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    key={view.id}
                    onClick={() => setActiveOrderView(view.id)}
                    type="button"
                  >
                    {view.label}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activeOrderView === view.id ? 'bg-white/15 text-white' : 'bg-white text-slate-500'}`}>{orderViewCounts[view.id] || 0}</span>
                  </button>
                ))}
              </div>
              {orders.length === 0 ? (
                <div className="mt-6 grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
                  <div>
                    <Boxes className="mx-auto text-slate-400" size={28} />
                    <h3 className="mt-3 font-semibold text-[#11243e]">No seller orders yet</h3>
                  </div>
                </div>
              ) : visibleOrders.length === 0 ? (
                <div className="mt-6 grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
                  <div>
                    <Search className="mx-auto text-slate-400" size={28} />
                    <h3 className="mt-3 font-semibold text-[#11243e]">No matching orders</h3>
                    <p className="mt-1 text-sm text-slate-500">Try another status tab or search keyword.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-4">
                  {visibleOrders.map((order) => (
                    <SellerOrderCard
                      key={order.id}
                      onReturnReview={reviewReturnRequest}
                      onStatusChange={updateOrderStatus}
                      order={order}
                      saving={savingOrderId === order.id}
                      statuses={orderStatuses}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function Field({ label, type = 'text', ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" required type={type} {...props} /></label>
}

function ItemMediaPreview({ item }) {
  const media = item.media?.[0]

  if (media?.type === 'video') {
    return (
      <div className="relative size-full">
        <video className="size-full object-cover" muted src={media.url} />
        <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-slate-950/70 text-white">
          <Video size={13} />
        </span>
      </div>
    )
  }

  if (media?.url || item.imageUrl) {
    return <img alt="" className="size-full object-cover" src={media?.url || item.imageUrl} />
  }

  return <Image size={24} />
}

function SellerOrderCard({ onReturnReview, onStatusChange, order, saving, statuses }) {
  const [sellerNotes, setSellerNotes] = useState('')
  const createdAt = order.createdAt?._seconds ? new Date(order.createdAt._seconds * 1000) : null
  const delivery = order.delivery || {}
  const returnRequest = order.returnRequest
  const returnPending = returnRequest?.status === 'pending_review'
  const total = (order.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)

  return (
    <article className={`rounded-2xl border p-5 ${returnPending ? 'border-blue-300 shadow-lg shadow-blue-950/5' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order {order.id}</p>
          <h3 className="mt-1 font-semibold text-[#11243e]">{delivery.fullName || order.customerEmail}</h3>
          <p className="mt-1 text-sm text-slate-500">{createdAt ? createdAt.toLocaleString() : 'Processing date'}</p>
          {returnPending && (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <RotateCcw size={14} /> Return review needed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saving && <RefreshCw className="animate-spin text-slate-400" size={17} />}
          <select
            className={`rounded-full border-0 px-4 py-2 text-sm font-semibold capitalize outline-none ring-1 ring-slate-200 ${statusStyles[order.status] || 'bg-slate-50 text-slate-700'}`}
            disabled={saving}
            onChange={(event) => onStatusChange(order.id, event.target.value)}
            value={order.status || 'confirmed'}
          >
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          {order.items?.map((item, index) => (
            <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm" key={`${item.productId}-${index}`}>
              <span className="min-w-0 text-slate-600">
                <span className="font-semibold text-[#11243e]">{item.quantity}x</span> {item.name}
                {(item.color || item.size) && <span className="block text-xs text-slate-400">{[item.color, item.size].filter(Boolean).join(' / ')}</span>}
              </span>
              <span className="shrink-0 font-semibold text-[#11243e]">${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <aside className="rounded-2xl bg-slate-50 p-4 text-sm">
          <div className="space-y-3 text-slate-600">
            <p className="flex gap-2"><Mail className="mt-0.5 shrink-0 text-slate-400" size={16} /> {delivery.email || order.customerEmail}</p>
            <p className="flex gap-2"><Phone className="mt-0.5 shrink-0 text-slate-400" size={16} /> {delivery.phone || 'No phone'}</p>
            <p className="flex gap-2"><MapPin className="mt-0.5 shrink-0 text-slate-400" size={16} /> {[delivery.address, delivery.city, delivery.postalCode].filter(Boolean).join(', ')}</p>
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold text-[#11243e]">
            <span>Seller total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </aside>
      </div>

      {returnRequest && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#11243e]">Return eligibility review</p>
              {returnRequest.items?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Requested items</p>
                  {returnRequest.items.map((item) => (
                    <p className="text-slate-600" key={`${item.productId}-${item.itemIndex}`}>
                      {item.quantity}x {item.name}{[item.color, item.size].filter(Boolean).length > 0 ? ` (${[item.color, item.size].filter(Boolean).join(' / ')})` : ''}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-3 font-medium text-[#11243e]">{returnRequest.reasonLabel}</p>
              {returnRequest.notes && <p className="mt-2 leading-6 text-slate-600">{returnRequest.notes}</p>}
              {returnRequest.adminNotes && <p className="mt-3 border-t border-slate-200 pt-3 leading-6 text-slate-600">Review note: {returnRequest.adminNotes}</p>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${returnStatusStyle(returnRequest.status)}`}>
              {formatReturnStatus(returnRequest.status)}
            </span>
          </div>

          {returnPending && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Decision notes</span>
                <textarea
                  className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#11243e] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  onChange={(event) => setSellerNotes(event.target.value)}
                  placeholder="For approvals, record refund instructions. For declines, explain why the return is not eligible."
                  value={sellerNotes}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={saving} onClick={() => onReturnReview(order.id, 'approved', sellerNotes)} type="button">
                  Approve return
                </button>
                <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:opacity-60" disabled={saving || !sellerNotes.trim()} onClick={() => onReturnReview(order.id, 'declined', sellerNotes)} type="button">
                  Decline return
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  )
}

function formatReturnStatus(status) {
  return {
    approved: 'Refund initialized',
    declined: 'Refund not approved',
    pending_review: 'Under review',
  }[status] || 'Under review'
}

function returnStatusStyle(status) {
  return {
    approved: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-rose-50 text-rose-700',
    pending_review: 'bg-blue-50 text-blue-700',
  }[status] || 'bg-blue-50 text-blue-700'
}

function Stat({ icon: Icon, label, tone = 'slate', value }) {
  const toneStyles = {
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-full ${toneStyles[tone] || toneStyles.slate}`}><Icon size={19} /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-[#11243e]">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default SellerPage
