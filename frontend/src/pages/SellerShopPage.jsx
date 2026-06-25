import { useEffect, useState } from 'react'
import { ArrowLeft, Image, PackagePlus, Store, Video } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { inventorySocket } from '../lib/socket.js'

const emptyShop = { name: '', category: '', description: '', city: '' }

function SellerShopPage() {
  const { authLoading, user } = useAuth()
  const [shop, setShop] = useState(emptyShop)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()

    async function loadWorkspace() {
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/seller/workspace', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load shop.')

        setShop({ ...emptyShop, ...(body.shop || {}) })
        setItems(body.items || [])
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
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

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (!user) return <Navigate replace state={{ from: '/seller/shop' }} to="/login" />

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="page-container flex items-center py-5">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700" to="/seller">
            <ArrowLeft size={17} /> Seller workspace
          </Link>
          <Link className="ml-auto text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
        </div>
      </header>

      <div className="page-container py-10 sm:py-14">
        {loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-slate-200 bg-white">
            <span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
          </div>
        ) : error ? (
          <p className="rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">{error}</p>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold text-blue-700">{shop.category || 'Seller shop'}</p>
                  <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[#11243e]">{shop.name || 'Your shop'}</h1>
                  <p className="mt-3 max-w-2xl leading-7 text-slate-600">{shop.description || 'Add a shop description so customers understand what you sell.'}</p>
                  {shop.city && <p className="mt-3 text-sm font-semibold text-slate-500">{shop.city}</p>}
                </div>
                <Link className="inline-flex items-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white" to="/seller/products/new">
                  <PackagePlus size={17} /> Add product
                </Link>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-[#11243e]">Shop products</h2>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                  <Store size={17} /> {items.length} items
                </span>
              </div>

              {items.length === 0 ? (
                <div className="mt-6 grid min-h-64 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
                  <div>
                    <PackagePlus className="mx-auto text-slate-400" size={30} />
                    <h3 className="mt-4 font-semibold text-[#11243e]">No products yet</h3>
                    <Link className="mt-5 inline-flex font-semibold text-blue-700" to="/seller/products/new">Create your first product</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white" key={item.id}>
                      <div className="aspect-[4/3] bg-slate-100">
                        <ProductMedia item={item} />
                      </div>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{item.category || shop.category}</p>
                            <h3 className="mt-1 font-semibold text-[#11243e]">{item.name}</h3>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.approvalStatus || 'draft'}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-500">{item.stock} in stock · {Number(item.sold || 0).toLocaleString()} sold · ${Number(item.price).toFixed(2)}</p>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link className="text-sm font-semibold text-blue-700 hover:text-blue-900" to={`/seller/products/${item.id}/edit`}>Edit details</Link>
                          {item.productId && <Link className="text-sm font-semibold text-slate-600 hover:text-blue-700" to={`/products/${item.productId}`}>Customer view</Link>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function ProductMedia({ item }) {
  const media = item.media?.[0]
  if (media?.type === 'video') {
    return <video className="size-full object-cover" muted src={media.url} />
  }
  if (media?.url) {
    return <img alt="" className="size-full object-cover" src={media.url} />
  }
  return <div className="grid size-full place-items-center text-slate-400">{media?.type === 'video' ? <Video size={28} /> : <Image size={28} />}</div>
}

export default SellerShopPage
