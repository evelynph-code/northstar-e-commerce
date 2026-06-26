import { useEffect, useState } from 'react'
import { ArrowLeft, Image, Package, Star, Store, Video } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

const emptyShop = { name: '', category: '', description: '', city: '' }

function PublicSellerShopPage() {
  const { sellerId } = useParams()
  const [shop, setShop] = useState(emptyShop)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadShop() {
      try {
        const response = await fetch(`/api/seller/public/${sellerId}`, { signal: controller.signal })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load shop.')

        setShop({ ...emptyShop, ...(body.shop || {}) })
        setProducts(body.products || [])
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadShop()
    return () => controller.abort()
  }, [sellerId])

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#11243e]">{error}</h1>
          <Link className="mt-5 inline-flex items-center gap-2 font-semibold text-blue-700" to="/"><ArrowLeft size={18} /> Back to products</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="page-container flex items-center py-5">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700" to="/">
            <ArrowLeft size={17} /> Products
          </Link>
          <Link className="ml-auto text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
        </div>
      </header>

      <div className="page-container py-10 sm:py-14">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Store size={17} /> {shop.category || 'Seller shop'}</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[#11243e]">{shop.name || 'Shop'}</h1>
              {shop.description && <p className="mt-3 max-w-2xl leading-7 text-slate-600">{shop.description}</p>}
              {shop.city && <p className="mt-3 text-sm font-semibold text-slate-500">{shop.city}</p>}
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
              <Package size={17} /> {products.length} product{products.length === 1 ? '' : 's'}
            </span>
          </div>
        </section>

        {products.length === 0 ? (
          <div className="mt-8 grid min-h-64 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
            <div>
              <Package className="mx-auto text-slate-400" size={30} />
              <h2 className="mt-4 font-semibold text-[#11243e]">No products available</h2>
            </div>
          </div>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link className="overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10" key={product.id} to={`/products/${product.id}`}>
                <div className="aspect-[4/3] bg-slate-100">
                  <ProductMedia product={product} />
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{product.category || shop.category}</p>
                  <h2 className="mt-1 font-semibold text-[#11243e]">{product.name}</h2>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <Star className="fill-blue-600 text-blue-600" size={15} />
                    <span>{Number(product.rating || 0).toFixed(1)}</span>
                    <span>({Number(product.reviews || 0)})</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#11243e]">${Number(product.price || 0).toFixed(2)}</span>
                    <span className="text-xs font-semibold text-slate-500">{Number(product.sold || 0).toLocaleString()} sold</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function ProductMedia({ product }) {
  const media = product.media?.[0]

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
    return <img alt={`${product.name} product media`} className="size-full object-cover" src={media.url} />
  }

  return <div className="grid size-full place-items-center text-slate-400"><Image size={28} /></div>
}

export default PublicSellerShopPage
