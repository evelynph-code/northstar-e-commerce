import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ClipboardList,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const statusStyles = {
  confirmed: 'bg-blue-50 text-blue-700',
  packing: 'bg-amber-50 text-amber-700',
  shipped: 'bg-indigo-50 text-indigo-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
  returned: 'bg-slate-100 text-slate-700',
}

function AdminPage() {
  const { authLoading, profile, user } = useAuth()
  const [orders, setOrders] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [products, setProducts] = useState([])
  const [statuses, setStatuses] = useState([])
  const [activeTab, setActiveTab] = useState('orders')
  const [loading, setLoading] = useState(true)
  const [savingOrderId, setSavingOrderId] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [error, setError] = useState('')

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase()
    if (!query) return orders

    return orders.filter((order) => order.id.toLowerCase().includes(query))
  }, [orderSearch, orders])

  const orderCounts = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: filteredOrders.filter((order) => order.status === status).length,
      })),
    [filteredOrders, statuses],
  )
  const lowStockProducts = useMemo(
    () => products.filter((product) => Number(product.stock) <= 5),
    [products],
  )
  const pendingReturnCount = useMemo(
    () => orders.filter((order) => order.returnRequest?.status === 'pending_review').length,
    [orders],
  )

  useEffect(() => {
    if (!user || !profile?.isAdmin) return
    const controller = new AbortController()

    async function loadOrders() {
      setError('')
      setLoading(true)

      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/orders/admin', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load orders.')

        const pendingResponse = await fetch('/api/seller/admin/items', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const pendingBody = await pendingResponse.json().catch(() => ({}))
        if (!pendingResponse.ok) throw new Error(pendingBody.message || 'Unable to load seller submissions.')

        const productsResponse = await fetch('/api/products', { signal: controller.signal })
        const productsBody = await productsResponse.json().catch(() => ({}))
        if (!productsResponse.ok) throw new Error(productsBody.message || 'Unable to load marketplace products.')

        setOrders(body.orders || [])
        setPendingItems(pendingBody.items || [])
        setProducts(productsBody.products || [])
        setStatuses(body.statuses || [])
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadOrders()
    return () => controller.abort()
  }, [profile?.isAdmin, user])

  const updateStatus = async (orderId, status) => {
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
    } catch (caughtError) {
      setOrders(currentOrders)
      setError(caughtError.message)
    } finally {
      setSavingOrderId('')
    }
  }

  const approveItem = async (item) => {
    setError('')

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/seller/admin/items/${item.sellerId}/${item.id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to approve product.')

      setPendingItems((current) => current.filter((candidate) => candidate.id !== item.id))
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  const reviewReturnRequest = async (orderId, status, adminNotes) => {
    const currentOrders = orders
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
        body: JSON.stringify({ adminNotes, status }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to update the return request.')

      setOrders((existingOrders) =>
        existingOrders.map((order) => (order.id === body.order.id ? body.order : order)),
      )
    } catch (caughtError) {
      setOrders(currentOrders)
      setError(caughtError.message)
    } finally {
      setSavingOrderId('')
    }
  }

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (!user) return <Navigate replace state={{ from: '/admin' }} to="/login" />
  if (!profile?.isAdmin) return <Navigate replace to="/account" />

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="page-container flex items-center py-5">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700" to="/account">
            <ArrowLeft size={17} /> Account
          </Link>
          <Link className="ml-auto text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
        </div>
      </header>

      <div className="page-container py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-blue-700">Admin</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#11243e] sm:text-4xl">Management board</h1>
            <p className="mt-2 text-sm text-slate-500">Review seller products, orders, and fulfillment status.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            <ClipboardList size={17} /> {activeTab === 'orders' ? `${filteredOrders.length} orders` : `${pendingItems.length} pending`}
          </span>
        </div>

        <div className="mt-8 inline-flex rounded-2xl border border-slate-200 bg-white p-1">
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'orders' ? 'bg-[#11243e] text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[#11243e]'}`}
            onClick={() => setActiveTab('orders')}
            type="button"
          >
            Order management
          </button>
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'shops' ? 'bg-[#11243e] text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[#11243e]'}`}
            onClick={() => setActiveTab('shops')}
            type="button"
          >
            Shop management
          </button>
        </div>

        {error && <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">{error}</p>}

        {activeTab === 'orders' && (
          <>
            <label className="relative mt-8 block max-w-xl">
              <span className="sr-only">Search orders by order number</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm font-medium text-[#11243e] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Search by order number"
                type="search"
                value={orderSearch}
              />
              {orderSearch && (
                <button
                  aria-label="Clear order search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setOrderSearch('')}
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </label>

            {orderCounts.length > 0 && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {orderCounts.map(({ count, status }) => (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4" key={status}>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{status}</p>
                    <p className="mt-2 text-2xl font-semibold text-[#11243e]">{count}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Return review</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-900">{pendingReturnCount}</p>
                </div>
              </div>
            )}
          </>
        )}

        {loading ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-slate-200 bg-white">
            <span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
          </div>
        ) : activeTab === 'shops' ? (
          <ShopManagement
            lowStockProducts={lowStockProducts}
            onApprove={approveItem}
            pendingItems={pendingItems}
            products={products}
          />
        ) : orders.length === 0 ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
            <div>
              <PackageCheck className="mx-auto text-slate-400" size={34} />
              <h2 className="mt-4 font-semibold text-[#11243e]">No orders yet</h2>
              <p className="mt-1 text-sm text-slate-500">New orders will appear here.</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
            <div>
              <Search className="mx-auto text-slate-400" size={34} />
              <h2 className="mt-4 font-semibold text-[#11243e]">No matching orders</h2>
              <p className="mt-1 text-sm text-slate-500">Try a different order number.</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-5">
            {filteredOrders.map((order) => (
              <OrderBoardCard
                key={order.id}
                onStatusChange={updateStatus}
                onReturnReview={reviewReturnRequest}
                order={order}
                saving={savingOrderId === order.id}
                statuses={statuses}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function OrderBoardCard({ onReturnReview, onStatusChange, order, saving, statuses }) {
  const [adminNotes, setAdminNotes] = useState('')
  const createdAt = order.createdAt?._seconds ? new Date(order.createdAt._seconds * 1000) : null
  const delivery = order.delivery || {}
  const total = Number(order.totals?.total || 0)
  const returnRequest = order.returnRequest
  const returnPending = returnRequest?.status === 'pending_review'

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order {order.id}</p>
          <h2 className="mt-1 text-xl font-semibold text-[#11243e]">{delivery.fullName || order.customerEmail}</h2>
          <p className="mt-1 text-sm text-slate-500">{createdAt ? createdAt.toLocaleString() : 'Processing date'}</p>
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

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
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
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </aside>
      </div>
      {returnRequest && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900">Return request: {formatReturnStatus(returnRequest.status)}</p>
              {returnRequest.items?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Items requested</p>
                  {returnRequest.items.map((item) => (
                    <p className="text-amber-800" key={`${item.productId}-${item.itemIndex}`}>
                      {item.quantity}x {item.name}{[item.color, item.size].filter(Boolean).length > 0 ? ` (${[item.color, item.size].filter(Boolean).join(' / ')})` : ''}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-1 text-amber-800">{returnRequest.reasonLabel}</p>
              {returnRequest.notes && <p className="mt-2 leading-6 text-amber-800">{returnRequest.notes}</p>}
              {returnRequest.adminNotes && <p className="mt-2 border-t border-amber-200 pt-2 text-amber-800">Admin note: {returnRequest.adminNotes}</p>}
            </div>
            {returnPending && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">Refund eligibility review</span>}
          </div>

          {returnPending && (
            <div className="mt-4 border-t border-amber-200 pt-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-800">Admin notes</span>
                <textarea
                  className="min-h-24 w-full resize-none rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-[#11243e] outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder="Record refund eligibility notes."
                  value={adminNotes}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                  onClick={() => onReturnReview(order.id, 'approved', adminNotes)}
                  type="button"
                >
                  Approve refund review
                </button>
                <button
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
                  disabled={saving}
                  onClick={() => onReturnReview(order.id, 'declined', adminNotes)}
                  type="button"
                >
                  Decline request
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
    approved: 'Approved for refund review',
    declined: 'Not eligible for refund',
    pending_review: 'Pending admin review',
  }[status] || 'Pending admin review'
}

function ShopManagement({ lowStockProducts, onApprove, pendingItems, products }) {
  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0)

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Marketplace products</p>
          <p className="mt-2 text-2xl font-semibold text-[#11243e]">{products.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending approval</p>
          <p className="mt-2 text-2xl font-semibold text-[#11243e]">{pendingItems.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Units in stock</p>
          <p className="mt-2 text-2xl font-semibold text-[#11243e]">{totalStock}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-xl font-semibold text-[#11243e]">Product approvals</h2>
            <p className="mt-1 text-sm text-slate-500">{pendingItems.length} pending seller submission{pendingItems.length === 1 ? '' : 's'}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            <ShieldCheck size={15} /> Review required
          </span>
        </div>

        {pendingItems.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <PackageCheck className="mx-auto text-slate-400" size={30} />
              <p className="mt-3 text-sm font-semibold text-[#11243e]">No products waiting for approval</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {pendingItems.map((item) => (
              <ProductApprovalCard item={item} key={`${item.sellerId}-${item.id}`} onApprove={onApprove} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h2 className="text-xl font-semibold text-[#11243e]">Stock overview</h2>
          <p className="mt-1 text-sm text-slate-500">Approved marketplace products and current units available.</p>
        </div>
        {products.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center">
            <p className="text-sm font-semibold text-slate-500">No approved marketplace products yet.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {products.map((product) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm" key={product.id}>
                <div className="min-w-0">
                  <p className="font-semibold text-[#11243e]">{product.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{product.category} {product.shopName ? `· ${product.shopName}` : ''}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${Number(product.stock) <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {Number(product.stock || 0)} left
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {lowStockProducts.length > 0 && (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-rose-800">Low stock</h2>
          <p className="mt-1 text-sm text-rose-700">{lowStockProducts.length} product{lowStockProducts.length === 1 ? '' : 's'} at 5 units or fewer.</p>
        </section>
      )}
    </div>
  )
}

function ProductApprovalCard({ item, onApprove }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
        <ApprovalMediaPreview item={item} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{item.category || item.shop?.category || 'Marketplace'}</p>
        <h3 className="mt-1 text-lg font-semibold text-[#11243e]">{item.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{item.shop?.name || item.sellerEmail} · {item.stock} in stock · ${Number(item.price).toFixed(2)}</p>
        {item.media?.length > 0 && <p className="mt-1 text-xs font-semibold text-slate-400">{item.media.length} media file{item.media.length === 1 ? '' : 's'}</p>}
      </div>
      <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900" onClick={() => onApprove(item)} type="button">
        <ShieldCheck size={17} /> Approve product
      </button>
    </article>
  )
}

function ApprovalMediaPreview({ item }) {
  const media = item.media?.[0]

  if (media?.type === 'video') {
    return (
      <div className="relative size-full">
        <video className="size-full object-cover" muted src={media.url} />
        <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-full bg-slate-950/70 text-white">
          <Video size={14} />
        </span>
      </div>
    )
  }

  if (media?.url) {
    return <img alt="" className="size-full object-cover" src={media.url} />
  }

  return <PackageCheck size={26} />
}

export default AdminPage
