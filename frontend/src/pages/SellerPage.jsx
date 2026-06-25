import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Image,
  PackagePlus,
  Save,
  Store,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const emptyShop = {
  name: '',
  category: '',
  description: '',
  city: '',
}
const sellerCategories = ['Apparel', 'Accessories', 'Footwear', 'Home goods', 'Electronics', 'Beauty']

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url: reader.result,
    })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

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
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    media: [],
  })
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

  const updateShopField = (event) => {
    const nextShop = { ...shop, [event.target.name]: event.target.value }
    setShop(nextShop)
  }

  const updateItemField = (event) => {
    setItemForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const addMediaFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const media = await Promise.all(files.map(readFileAsDataUrl))
    setItemForm((current) => ({ ...current, media: [...current.media, ...media] }))
    event.target.value = ''
  }

  const removeMediaFile = (mediaId) => {
    setItemForm((current) => ({
      ...current,
      media: current.media.filter((media) => media.id !== mediaId),
    }))
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

  const addItem = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/seller/items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemForm),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to add item.')

      setItems((current) => [body.item, ...current])
      setItemForm({ name: '', price: '', stock: '', category: '', media: [] })
      setMessage('Item submitted for admin review.')
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

        {!workspaceLoading && <div className="mt-8 grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
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
              <h2 className="text-xl font-semibold text-[#11243e]">Submit products</h2>
            </div>
            <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={addItem}>
              <Field label="Item name" name="name" onChange={updateItemField} value={itemForm.name} />
              <Field label="Category" name="category" onChange={updateItemField} value={itemForm.category} />
              <Field label="Price" min="0" name="price" onChange={updateItemField} step="0.01" type="number" value={itemForm.price} />
              <Field label="Stock" min="0" name="stock" onChange={updateItemField} step="1" type="number" value={itemForm.stock} />
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Photos and videos</span>
                  <span className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    <Upload size={18} /> Upload media
                    <input accept="image/*,video/*" className="sr-only" multiple onChange={addMediaFiles} type="file" />
                  </span>
                </label>
                {itemForm.media.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {itemForm.media.map((media) => (
                      <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100" key={media.id}>
                        {media.type === 'video' ? (
                          <video className="size-full object-cover" muted src={media.url} />
                        ) : (
                          <img alt="" className="size-full object-cover" src={media.url} />
                        )}
                        <button
                          aria-label={`Remove ${media.name}`}
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:text-rose-700"
                          onClick={() => removeMediaFile(media.id)}
                          type="button"
                        >
                          <X size={15} />
                        </button>
                        {media.type === 'video' && (
                          <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-white">Video</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2" disabled={saving} type="submit">
                <PackagePlus size={17} /> Submit for review
              </button>
            </form>

            <div className="mt-8 grid gap-4">
              {items.length === 0 ? (
                <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
                  <div>
                    <PackagePlus className="mx-auto text-slate-400" size={28} />
                    <h3 className="mt-3 font-semibold text-[#11243e]">No items yet</h3>
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
                      <p className="mt-1 text-sm text-slate-500">{item.category || 'Uncategorized'} · {item.stock} in stock</p>
                      {item.media?.length > 0 && <p className="mt-1 text-xs font-semibold text-slate-400">{item.media.length} media file{item.media.length === 1 ? '' : 's'}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                      <p className="font-semibold text-[#11243e]">${Number(item.price).toFixed(2)}</p>
                      {item.productId && <Link className="mt-0 text-sm font-semibold text-blue-700 hover:text-blue-900 sm:mt-2" to={`/products/${item.productId}`}>View product</Link>}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>}
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
