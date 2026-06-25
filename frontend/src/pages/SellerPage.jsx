import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Image,
  PackagePlus,
  Save,
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
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const shopReady = Boolean(shop.name.trim())
  const inventoryValue = useMemo(
    () => items.reduce((total, item) => total + Number(item.price) * Number(item.stock), 0),
    [items],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadWorkspace() {
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/seller/workspace', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load seller workspace.')

        setShop({ ...emptyShop, ...(body.shop || {}) })
        setItems(body.items || [])
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
            <p className="text-sm font-semibold text-blue-700">Seller workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#11243e] sm:text-4xl">
              {shopReady ? shop.name : `${profile?.userName || profile?.displayName || 'Your'} shop`}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{profile?.email}</p>
            {shop.category && <p className="mt-1 text-sm font-semibold text-emerald-700">{shop.category}</p>}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            <Store size={17} /> {shopReady ? 'Shop active' : 'Shop draft'}
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat icon={Boxes} label="Items" value={items.length} />
          <Stat icon={PackagePlus} label="Approved" value={items.filter((item) => item.approvalStatus === 'approved').length} />
          <Stat icon={BadgeDollarSign} label="Inventory value" value={`$${inventoryValue.toFixed(2)}`} />
        </div>

        {workspaceLoading && <div className="mt-8 grid min-h-40 place-items-center rounded-3xl border border-slate-200 bg-white"><span className="size-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></div>}
        {message && <p className="mt-6 rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-700" role="status">{message}</p>}
        {error && <p className="mt-6 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">{error}</p>}

        {!workspaceLoading && (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
                <span className="grid size-10 place-items-center rounded-full bg-blue-50 text-blue-700"><Store size={20} /></span>
                <h2 className="text-xl font-semibold text-[#11243e]">Shop profile</h2>
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

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
                <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><PackagePlus size={20} /></span>
                <h2 className="text-xl font-semibold text-[#11243e]">Products</h2>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white" to="/seller/products/new">
                  <PackagePlus size={17} /> Create product
                </Link>
                <Link className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-[#11243e] hover:border-blue-300 hover:text-blue-700" to="/seller/shop">
                  <Store size={17} /> View my shop
                </Link>
              </div>

              <div className="mt-8 grid gap-4">
                {items.length === 0 ? (
                  <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
                    <div>
                      <PackagePlus className="mx-auto text-slate-400" size={28} />
                      <h3 className="mt-3 font-semibold text-[#11243e]">No products yet</h3>
                      <Link className="mt-3 inline-flex text-sm font-semibold text-blue-700" to="/seller/products/new">Create your first product</Link>
                    </div>
                  </div>
                ) : (
                  items.map((item) => (
                    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center" key={item.id}>
                      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
                        <ItemMediaPreview item={item} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#11243e]">{item.name}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.approvalStatus || item.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{item.category || 'Uncategorized'} · {item.stock} in stock · {Number(item.sold || 0).toLocaleString()} sold</p>
                        {item.media?.length > 0 && <p className="mt-1 text-xs font-semibold text-slate-400">{item.media.length} media file{item.media.length === 1 ? '' : 's'}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                        <p className="font-semibold text-[#11243e]">${Number(item.price).toFixed(2)}</p>
                        <Link className="mt-0 text-sm font-semibold text-blue-700 hover:text-blue-900 sm:mt-2" to={`/seller/products/${item.id}/edit`}>Edit details</Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
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

export default SellerPage
