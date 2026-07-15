import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  PackageCheck,
  Search,
  Store,
  X,
  XCircle,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const orderStatuses = ['confirmed', 'packing', 'shipped', 'delivered', 'cancelled', 'returned']

function AdminPage() {
  const { authLoading, profile, user } = useAuth()
  const [shops, setShops] = useState([])
  const [reviewItems, setReviewItems] = useState([])
  const [selectedShopId, setSelectedShopId] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reviewingItemId, setReviewingItemId] = useState('')

  const filteredShops = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return shops

    return shops.filter((shop) =>
      [
        shop.shop?.name,
        shop.shop?.category,
        shop.shop?.city,
        shop.email,
      ].some((value) => String(value || '').toLowerCase().includes(query)),
    )
  }, [searchQuery, shops])
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) || filteredShops[0] || null
  const totalProducts = shops.reduce((sum, shop) => sum + Number(shop.stats?.products || 0), 0)
  const totalRevenue = shops.reduce((sum, shop) => sum + Number(shop.stats?.revenue || 0), 0)

  useEffect(() => {
    if (!user || !profile?.isAdmin) return
    const controller = new AbortController()

    async function loadShops() {
      setError('')
      setLoading(true)

      try {
        const token = await user.getIdToken()
        const [response, reviewResponse] = await Promise.all([
          fetch('/api/seller/admin/shops', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }),
          fetch('/api/seller/admin/items', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }),
        ])
        const body = await response.json().catch(() => ({}))
        const reviewBody = await reviewResponse.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load shops.')
        if (!reviewResponse.ok) throw new Error(reviewBody.message || 'Unable to load product reviews.')

        setShops(body.shops || [])
        setReviewItems(reviewBody.items || [])
        setSelectedShopId((current) => current || body.shops?.[0]?.id || '')
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadShops()
    return () => controller.abort()
  }, [profile?.isAdmin, user])

  const reviewProduct = async (item, decision, reviewNotes = '') => {
    if (decision === 'decline' && !reviewNotes.trim()) {
      setError('Add a reason before declining a product.')
      return
    }

    setReviewingItemId(item.id)
    setError('')
    setMessage('')

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/seller/admin/items/${item.sellerId}/${item.id}/${decision === 'approve' ? 'approve' : 'decline'}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewNotes }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || `Unable to ${decision} this product.`)

      setReviewItems((current) => current.filter((reviewItem) => reviewItem.id !== item.id))
      setShops((current) =>
        current.map((shop) => {
          if (shop.id !== item.sellerId) return shop
          return {
            ...shop,
            products: (shop.products || []).map((product) =>
              product.id === item.id
                ? { ...product, approvalStatus: decision === 'approve' ? 'approved' : 'declined', status: decision === 'approve' ? 'approved' : 'declined' }
                : product,
            ),
          }
        }),
      )
      setMessage(decision === 'approve' ? 'Product approved and published.' : 'Product declined.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setReviewingItemId('')
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
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#11243e] sm:text-4xl">Shop overview</h1>
            <p className="mt-2 text-sm text-slate-500">View seller shops and fulfillment performance. Order actions are handled by sellers.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            <Store size={17} /> {filteredShops.length} shop{filteredShops.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat icon={Store} label="Shops" value={shops.length} />
          <Stat icon={PackageCheck} label="Pending reviews" value={reviewItems.length} />
          <Stat icon={BadgeDollarSign} label="Seller revenue" value={`$${totalRevenue.toFixed(2)}`} />
        </div>

        {message && <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700" role="status">{message}</p>}
        {error && <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">{error}</p>}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-sm font-semibold text-blue-700">Product review queue</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#11243e]">Approve seller submissions</h2>
              <p className="mt-1 text-sm text-slate-500">Products stay hidden from customers until an admin approves them.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {reviewItems.length} pending
            </span>
          </div>

          {loading ? (
            <div className="grid min-h-32 place-items-center">
              <span className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
            </div>
          ) : reviewItems.length === 0 ? (
            <div className="mt-5 grid min-h-36 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
              <div>
                <PackageCheck className="mx-auto text-slate-400" size={30} />
                <h3 className="mt-3 font-semibold text-[#11243e]">No products waiting for review</h3>
                <p className="mt-1 text-sm text-slate-500">New seller submissions will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {reviewItems.map((item) => (
                <ProductReviewCard
                  item={item}
                  key={`${item.sellerId}-${item.id}`}
                  onReview={reviewProduct}
                  saving={reviewingItemId === item.id}
                />
              ))}
            </div>
          )}
        </section>

        <label className="relative mt-8 block max-w-xl">
          <span className="sr-only">Search shops</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm font-medium text-[#11243e] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search shops by name, category, city, or email"
            type="search"
            value={searchQuery}
          />
          {searchQuery && (
            <button
              aria-label="Clear shop search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setSearchQuery('')}
              type="button"
            >
              <X size={16} />
            </button>
          )}
        </label>

        {loading ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-slate-200 bg-white">
            <span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
          </div>
        ) : shops.length === 0 ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
            <div>
              <Store className="mx-auto text-slate-400" size={34} />
              <h2 className="mt-4 font-semibold text-[#11243e]">No seller shops yet</h2>
            </div>
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
            <div>
              <Search className="mx-auto text-slate-400" size={34} />
              <h2 className="mt-4 font-semibold text-[#11243e]">No matching shops</h2>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="space-y-2">
                {filteredShops.map((shop) => (
                  <button
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedShop?.id === shop.id
                        ? 'bg-[#11243e] text-white'
                        : 'hover:bg-slate-50'
                    }`}
                    key={shop.id}
                    onClick={() => setSelectedShopId(shop.id)}
                    type="button"
                  >
                    <p className="font-semibold">{shop.shop?.name || shop.email || 'Seller shop'}</p>
                    <p className={`mt-1 text-xs ${selectedShop?.id === shop.id ? 'text-slate-200' : 'text-slate-500'}`}>{shop.shop?.category || 'Uncategorized'} · {shop.stats?.orders || 0} orders</p>
                  </button>
                ))}
              </div>
            </section>

            {selectedShop && <ShopStats shop={selectedShop} totalProducts={totalProducts} />}
          </div>
        )}
      </div>
    </main>
  )
}

function ShopStats({ shop }) {
  const statusCounts = shop.stats?.statusCounts || {}
  const products = shop.products || []

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-semibold text-blue-700">{shop.shop?.category || 'Seller shop'}</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#11243e]">{shop.shop?.name || shop.email}</h2>
          <p className="mt-1 text-sm text-slate-500">{shop.email}</p>
          {shop.shop?.city && <p className="mt-1 text-sm font-semibold text-slate-500">{shop.shop.city}</p>}
        </div>
        <Link className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200" to={`/shops/${shop.id}`}>
          View public shop
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={Boxes} label="Orders" value={shop.stats?.orders || 0} />
        <Stat icon={PackageCheck} label="Products" value={shop.stats?.products || 0} />
        <Stat icon={BadgeDollarSign} label="Revenue" value={`$${Number(shop.stats?.revenue || 0).toFixed(2)}`} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orderStatuses.map((status) => (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={status}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{status}</p>
            <p className="mt-2 text-2xl font-semibold text-[#11243e]">{statusCounts[status] || 0}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="font-semibold text-[#11243e]">Products</h3>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">This shop has not submitted products yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {products.map((product) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm" key={product.id}>
                <div>
                  <p className="font-semibold text-[#11243e]">{product.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{product.approvalStatus || product.status || 'draft'} · {Number(product.sold || 0).toLocaleString()} sold</p>
                </div>
                <span className="font-semibold text-[#11243e]">${Number(product.price || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ProductReviewCard({ item, onReview, saving }) {
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const image = item.media?.find((media) => media.type !== 'video')?.url || item.imageUrl
  const mediaCount = item.media?.length || 0

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)_auto] lg:items-start">
        <div className="grid size-24 place-items-center overflow-hidden rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200">
          {image ? <img alt="" className="size-full object-cover" src={image} /> : <PackageCheck size={28} />}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[#11243e]">{item.name}</h3>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending review</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {item.shop?.name || 'Seller shop'} · {item.category || item.shop?.category || 'Uncategorized'}
          </p>
          {item.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">${Number(item.price || 0).toFixed(2)}</span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{Number(item.stock || 0)} in stock</span>
            {Number(item.purchaseLimit) > 0 && <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">Limit {item.purchaseLimit} per account</span>}
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{mediaCount} media file{mediaCount === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            disabled={saving}
            onClick={() => onReview(item, 'approve')}
            type="button"
          >
            <CheckCircle2 size={16} /> Approve
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
            disabled={saving}
            onClick={() => setDeclineOpen((open) => !open)}
            type="button"
          >
            <XCircle size={16} /> Decline
          </button>
        </div>
      </div>

      {declineOpen && (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-white p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Decline reason</span>
            <textarea
              className="min-h-24 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50"
              onChange={(event) => setReviewNotes(event.target.value)}
              placeholder="Example: missing product photos, unclear description, unsupported item, etc."
              value={reviewNotes}
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" disabled={saving} onClick={() => setDeclineOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
              disabled={saving || !reviewNotes.trim()}
              onClick={() => onReview(item, 'decline', reviewNotes)}
              type="button"
            >
              Confirm decline
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-600"><Icon size={19} /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-[#11243e]">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default AdminPage
