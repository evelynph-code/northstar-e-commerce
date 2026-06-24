import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Image,
  PackagePlus,
  Save,
  Store,
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

function readSellerWorkspace(storageKey) {
  try {
    const savedWorkspace = JSON.parse(localStorage.getItem(storageKey) || '{}')
    return {
      shop: { ...emptyShop, ...(savedWorkspace.shop || {}) },
      items: Array.isArray(savedWorkspace.items) ? savedWorkspace.items : [],
    }
  } catch {
    return { shop: emptyShop, items: [] }
  }
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
  const storageKey = `northstar-seller-${user.uid}`
  const initialWorkspace = useMemo(() => readSellerWorkspace(storageKey), [storageKey])
  const [shop, setShop] = useState(initialWorkspace.shop)
  const [items, setItems] = useState(initialWorkspace.items)
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    imageUrl: '',
  })
  const [message, setMessage] = useState('')

  const shopReady = Boolean(shop.name.trim())
  const inventoryValue = useMemo(
    () => items.reduce((total, item) => total + Number(item.price) * Number(item.stock), 0),
    [items],
  )

  const persistWorkspace = (nextShop, nextItems) => {
    localStorage.setItem(storageKey, JSON.stringify({ shop: nextShop, items: nextItems }))
  }

  const updateShopField = (event) => {
    const nextShop = { ...shop, [event.target.name]: event.target.value }
    setShop(nextShop)
    persistWorkspace(nextShop, items)
  }

  const updateItemField = (event) => {
    setItemForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const saveShop = (event) => {
    event.preventDefault()
    persistWorkspace(shop, items)
    setMessage('Shop profile saved.')
  }

  const addItem = (event) => {
    event.preventDefault()
    const nextItems = [
      {
        id: crypto.randomUUID(),
        name: itemForm.name.trim(),
        price: Number(itemForm.price),
        stock: Number(itemForm.stock),
        category: itemForm.category.trim(),
        imageUrl: itemForm.imageUrl.trim(),
        status: 'draft',
      },
      ...items,
    ]
    setItems(nextItems)
    persistWorkspace(shop, nextItems)
    setItemForm({ name: '', price: '', stock: '', category: '', imageUrl: '' })
    setMessage('Item added to your shop.')
  }

  const publishItem = (itemId) => {
    const nextItems = items.map((item) =>
      item.id === itemId ? { ...item, status: item.status === 'published' ? 'draft' : 'published' } : item,
    )
    setItems(nextItems)
    persistWorkspace(shop, nextItems)
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
          <Stat icon={PackagePlus} label="Published" value={items.filter((item) => item.status === 'published').length} />
          <Stat icon={BadgeDollarSign} label="Inventory value" value={`$${inventoryValue.toFixed(2)}`} />
        </div>

        {message && <p className="mt-6 rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-700" role="status">{message}</p>}

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
              <button className="inline-flex items-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white" type="submit">
                <Save size={17} /> Save shop
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><PackagePlus size={20} /></span>
              <h2 className="text-xl font-semibold text-[#11243e]">Post items</h2>
            </div>
            <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={addItem}>
              <Field label="Item name" name="name" onChange={updateItemField} value={itemForm.name} />
              <Field label="Category" name="category" onChange={updateItemField} value={itemForm.category} />
              <Field label="Price" min="0" name="price" onChange={updateItemField} step="0.01" type="number" value={itemForm.price} />
              <Field label="Stock" min="0" name="stock" onChange={updateItemField} step="1" type="number" value={itemForm.stock} />
              <div className="sm:col-span-2"><Field label="Image URL" name="imageUrl" onChange={updateItemField} required={false} value={itemForm.imageUrl} /></div>
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white sm:col-span-2" type="submit">
                <PackagePlus size={17} /> Add item
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
                      {item.imageUrl ? <img alt="" className="size-full object-cover" src={item.imageUrl} /> : <Image size={24} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#11243e]">{item.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.category || 'Uncategorized'} · {item.stock} in stock</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                      <p className="font-semibold text-[#11243e]">${Number(item.price).toFixed(2)}</p>
                      <button className="mt-0 text-sm font-semibold text-blue-700 hover:text-blue-900 sm:mt-2" onClick={() => publishItem(item.id)} type="button">
                        {item.status === 'published' ? 'Move to draft' : 'Publish'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function Field({ label, type = 'text', ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" required type={type} {...props} /></label>
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
