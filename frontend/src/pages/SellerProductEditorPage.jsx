import { useEffect, useState } from 'react'
import { ArrowLeft, Image, PackagePlus, Save, Upload, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { productCategories } from '../lib/categories.js'

const emptyForm = {
  name: '',
  category: '',
  price: '',
  stock: '',
  purchaseLimit: '',
  description: '',
  hasColors: false,
  colors: '',
  hasSizes: false,
  sizes: '',
  features: '',
  howToUse: '',
  careInstructions: '',
  specifications: '',
  media: [],
}

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

function listToText(value) {
  if (!Array.isArray(value)) return ''
  return value.map((item) => (typeof item === 'string' ? item : item.name)).filter(Boolean).join(', ')
}

function specificationsToText(value) {
  if (!Array.isArray(value)) return ''
  return value.map((specification) => `${specification.label}: ${specification.value}`).join('\n')
}

function SellerProductEditorPage() {
  const { authLoading, user } = useAuth()
  const { itemId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(itemId)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user || !itemId) return
    const controller = new AbortController()

    async function loadItem() {
      try {
        const token = await user.getIdToken()
        const response = await fetch(`/api/seller/items/${itemId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load product draft.')

        setForm({
          name: body.item.name || '',
          category: body.item.category || '',
          price: String(body.item.price || ''),
          stock: String(body.item.stock || ''),
          purchaseLimit: body.item.purchaseLimit ? String(body.item.purchaseLimit) : '',
          description: body.item.description || '',
          hasColors: Boolean(body.item.colors?.length),
          colors: listToText(body.item.colors),
          hasSizes: Boolean(body.item.sizes?.length),
          sizes: listToText(body.item.sizes),
          features: listToText(body.item.features),
          howToUse: body.item.howToUse || '',
          careInstructions: body.item.careInstructions || '',
          specifications: specificationsToText(body.item.specifications),
          media: body.item.media || [],
        })
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadItem()
    return () => controller.abort()
  }, [itemId, user])

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const updateToggle = (event) => {
    const { checked, name } = event.target
    setForm((current) => ({
      ...current,
      [name]: checked,
      ...(name === 'hasColors' && !checked ? { colors: '' } : {}),
      ...(name === 'hasSizes' && !checked ? { sizes: '' } : {}),
    }))
  }

  const addMediaFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const media = await Promise.all(files.map(readFileAsDataUrl))
    setForm((current) => ({ ...current, media: [...current.media, ...media] }))
    event.target.value = ''
  }

  const removeMediaFile = (mediaId) => {
    setForm((current) => ({
      ...current,
      media: current.media.filter((media) => media.id !== mediaId),
    }))
  }

  const saveProduct = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const token = await user.getIdToken()
      const payload = {
        ...form,
        colors: form.hasColors ? form.colors : '',
        sizes: form.hasSizes ? form.sizes : '',
      }
      const response = await fetch(editing ? `/api/seller/items/${itemId}` : '/api/seller/items', {
        method: editing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to submit product.')

      setMessage('Product submitted for admin review.')
      if (!editing) navigate(`/seller/products/${body.item.id}/edit`, { replace: true })
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (!user) return <Navigate replace state={{ from: '/seller/products/new' }} to="/login" />

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
        <div>
          <p className="text-sm font-semibold text-blue-700">Product editor</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#11243e] sm:text-4xl">{editing ? 'Edit product details' : 'Create product listing'}</h1>
          <p className="mt-2 text-sm text-slate-500">Add the details customers need before this product is submitted for admin approval.</p>
        </div>

        {loading ? (
          <div className="mt-8 grid min-h-80 place-items-center rounded-3xl border border-slate-200 bg-white">
            <span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
          </div>
        ) : (
          <form className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={saveProduct}>
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-[#11243e]">Customer-facing information</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Item name" name="name" onChange={updateField} value={form.name} />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Category</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    name="category"
                    onChange={updateField}
                    required
                    value={form.category}
                  >
                    <option value="">Choose a category</option>
                    {productCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <Field label="Price" min="0" name="price" onChange={updateField} step="0.01" type="number" value={form.price} />
                <Field label="Stock" min="0" name="stock" onChange={updateField} step="1" type="number" value={form.stock} />
                <Field label="Buying limit per account" min="0" name="purchaseLimit" onChange={updateField} placeholder="No limit" required={false} step="1" type="number" value={form.purchaseLimit} />
                <div className="sm:col-span-2"><TextArea label="Description" name="description" onChange={updateField} value={form.description} /></div>
                <VariantField
                  checked={form.hasColors}
                  helper="Customers will pick one of these before adding the item to cart."
                  label="Allow customers to choose color"
                  name="hasColors"
                  onChange={updateField}
                  onToggle={updateToggle}
                  placeholder="Black, White, Navy"
                  value={form.colors}
                  valueName="colors"
                />
                <VariantField
                  checked={form.hasSizes}
                  helper="Use clothing sizes, shoe sizes, storage sizes, or any option that fits this item."
                  label="Allow customers to choose size"
                  name="hasSizes"
                  onChange={updateField}
                  onToggle={updateToggle}
                  placeholder="S, M, L or 36, 37, 38"
                  value={form.sizes}
                  valueName="sizes"
                />
                <div className="sm:col-span-2"><TextArea label="Features" name="features" onChange={updateField} placeholder="One feature per line" value={form.features} /></div>
                <div className="sm:col-span-2"><TextArea label="How it is used" name="howToUse" onChange={updateField} value={form.howToUse} /></div>
                <div className="sm:col-span-2"><TextArea label="Washing and care" name="careInstructions" onChange={updateField} value={form.careInstructions} /></div>
                <div className="sm:col-span-2"><TextArea label="Specifications" name="specifications" onChange={updateField} placeholder="Material: Cotton\nOrigin: Vietnam" value={form.specifications} /></div>
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-200 bg-white p-6 lg:sticky lg:top-6">
              <h2 className="text-xl font-semibold text-[#11243e]">Media</h2>
              <label className="mt-5 block">
                <span className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                  <Upload size={18} /> Upload photos or videos
                  <input accept="image/*,video/*" className="sr-only" multiple onChange={addMediaFiles} type="file" />
                </span>
              </label>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {form.media.map((media) => (
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100" key={media.id}>
                    {media.type === 'video' ? <video className="size-full object-cover" muted src={media.url} /> : <img alt="" className="size-full object-cover" src={media.url} />}
                    <button aria-label={`Remove ${media.name}`} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:text-rose-700" onClick={() => removeMediaFile(media.id)} type="button"><X size={15} /></button>
                    {media.type === 'video' && <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-white">Video</span>}
                  </div>
                ))}
                {form.media.length === 0 && (
                  <div className="col-span-2 grid min-h-36 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                    <Image size={26} />
                  </div>
                )}
              </div>

              {message && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{message}</p>}
              {error && <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
              <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">
                {saving ? <Save size={17} /> : <PackagePlus size={17} />} {saving ? 'Saving...' : 'Submit for review'}
              </button>
            </aside>
          </form>
        )}
      </div>
    </main>
  )
}

function Field({ label, type = 'text', ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" required type={type} {...props} /></label>
}

function VariantField({ checked, helper, label, name, onChange, onToggle, placeholder, value, valueName }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          checked={checked}
          className="mt-1 size-4 rounded border-slate-300 accent-blue-700"
          name={name}
          onChange={onToggle}
          type="checkbox"
        />
        <span>
          <span className="block text-sm font-semibold text-[#11243e]">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{helper}</span>
        </span>
      </label>
      {checked && (
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Choices</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            name={valueName}
            onChange={onChange}
            placeholder={placeholder}
            required
            value={value}
          />
          <span className="mt-2 block text-xs text-slate-400">Separate choices with commas or new lines.</span>
        </label>
      )}
    </div>
  )
}

function TextArea({ label, ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><textarea className="min-h-28 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" {...props} /></label>
}

export default SellerProductEditorPage
