import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const fallbackGallery = [
  { start: '#dbeafe', end: '#93c5fd' },
  { start: '#e2e8f0', end: '#bfdbfe' },
  { start: '#eff6ff', end: '#cbd5e1' },
]

function RatingStars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          className={star <= Math.round(rating) ? 'fill-blue-600 text-blue-600' : 'fill-slate-200 text-slate-200'}
          key={star}
          size={17}
        />
      ))}
    </span>
  )
}

function ProductArtwork({ colors, name }) {
  return (
    <div
      aria-label={`${name} product image`}
      className="relative grid h-full w-full place-items-center overflow-hidden"
      role="img"
      style={{ background: `linear-gradient(135deg, ${colors.start}, ${colors.end})` }}
    >
      <div className="absolute -right-[12%] -top-[16%] size-[58%] rounded-full bg-white/35" />
      <div className="absolute -bottom-[18%] -left-[10%] size-[55%] rounded-full bg-white/25" />
      <div className="relative aspect-square w-[48%] rotate-6 rounded-[28%] border border-white/70 bg-white/45 shadow-2xl backdrop-blur-md">
        <div className="absolute inset-[18%] -rotate-12 rounded-full border border-white/80 bg-white/35" />
      </div>
    </div>
  )
}

function ProductDetailPage() {
  const { productId } = useParams()
  const { authLoading, profile, user } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [cartCount, setCartCount] = useState(0)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProduct() {
      try {
        const response = await fetch(`/api/products/${productId}`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Product not found.' : 'Unable to load product.')
        const body = await response.json()
        setProduct(body.product)
        setSelectedColor(body.product.colors?.[0]?.name || '')
        setSelectedSize(body.product.sizes?.[0] || '')
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadProduct()
    return () => controller.abort()
  }, [productId])

  const gallery = useMemo(
    () => product?.galleryColors?.length ? product.galleryColors : fallbackGallery,
    [product],
  )

  const addToCart = () => {
    if (!product || product.stock === 0) return
    setCartCount((count) => count + quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (error || !product) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#11243e]">{error || 'Product not found.'}</h1>
          <Link className="mt-5 inline-flex items-center gap-2 font-semibold text-blue-700" to="/"><ArrowLeft size={18} /> Back to products</Link>
        </div>
      </main>
    )
  }

  const maximumQuantity = Math.min(product.stock, 10)

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <div className="bg-[#11243e] px-6 py-2.5 text-center text-xs font-medium tracking-wide text-slate-200">
        Complimentary delivery on orders over $75
      </div>
      <header className="border-b border-slate-200">
        <div className="page-container flex min-w-0 items-center gap-3 py-5">
          <Link className="shrink-0 text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {!authLoading && (user ? (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-[#11243e]">{profile?.displayName || 'My account'}</p>
                <p className="max-w-44 truncate text-xs text-slate-500">{profile?.email}</p>
              </div>
            ) : (
              <Link aria-label="Sign in" className="rounded-full p-3 text-slate-600 hover:bg-slate-100" to="/login"><UserRound size={20} /></Link>
            ))}
            <button aria-label={`Shopping bag with ${cartCount} items`} className="relative rounded-full p-3 text-slate-600 hover:bg-slate-100" type="button">
              <ShoppingBag size={20} />
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="page-container min-w-0 py-5 sm:py-6">
        <nav className="flex min-w-0 items-center gap-2 overflow-hidden text-sm text-slate-500">
          <Link className="shrink-0 hover:text-blue-700" to="/">Products</Link><span>/</span><span className="shrink-0">{product.category}</span><span>/</span><span className="min-w-0 truncate text-slate-700">{product.name}</span>
        </nav>
      </div>

      <section className="page-container grid min-w-0 gap-10 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-12">
        <div className="grid min-w-0 max-w-full gap-4 sm:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[88px_minmax(0,1fr)]">
          <div className="order-2 flex min-w-0 max-w-full gap-3 overflow-x-auto pb-1 sm:order-1 sm:flex-col sm:overflow-visible">
            {gallery.map((colors, index) => (
              <button
                aria-label={`View product image ${index + 1}`}
                className={`aspect-square w-[72px] shrink-0 overflow-hidden rounded-xl border-2 transition xl:w-20 ${selectedImage === index ? 'border-blue-600' : 'border-transparent hover:border-slate-300'}`}
                key={`${colors.start}-${index}`}
                onClick={() => setSelectedImage(index)}
                type="button"
              >
                <ProductArtwork colors={colors} name={product.name} />
              </button>
            ))}
          </div>
          <div className="order-1 aspect-square w-full min-w-0 max-w-full overflow-hidden rounded-3xl bg-slate-100 sm:order-2 xl:rounded-[2rem]">
            <ProductArtwork colors={gallery[selectedImage]} name={product.name} />
          </div>
        </div>

        <div className="min-w-0 max-w-full lg:py-3">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">{product.category}</p>
          <h1 className="mt-3 break-words text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#11243e] sm:text-5xl">{product.name}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <RatingStars rating={product.rating} />
            <span className="font-semibold text-slate-700">{product.rating}</span>
            <span className="text-sm text-slate-400">({product.reviews} reviews)</span>
            <span className="text-sm text-slate-500">{product.sold.toLocaleString()} sold</span>
          </div>
          <div className="mt-7 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold text-[#11243e]">${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <>
                <span className="text-lg text-slate-400 line-through">${product.originalPrice.toFixed(2)}</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{Math.round((1 - product.price / product.originalPrice) * 100)}% off</span>
              </>
            )}
          </div>
          <p className="mt-6 max-w-full break-words leading-7 text-slate-600">{product.description || `A thoughtfully selected ${product.category.toLowerCase()} essential, designed for reliable everyday use and a clean modern feel.`}</p>

          {product.colors?.length > 0 && (
            <fieldset className="mt-8">
              <legend className="font-semibold text-[#11243e]">Color: <span className="font-normal text-slate-500">{selectedColor}</span></legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {product.colors.map((color) => (
                  <button aria-label={`Select ${color.name}`} className={`grid size-10 place-items-center rounded-full border-2 p-1 ${selectedColor === color.name ? 'border-blue-600' : 'border-slate-200'}`} key={color.name} onClick={() => setSelectedColor(color.name)} type="button">
                    <span className="grid size-full place-items-center rounded-full" style={{ backgroundColor: color.hex }}>
                      {selectedColor === color.name && <Check className={color.hex === '#ffffff' ? 'text-slate-800' : 'text-white'} size={15} />}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {product.sizes?.length > 0 && (
            <fieldset className="mt-8">
              <legend className="font-semibold text-[#11243e]">Size</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button className={`min-w-12 rounded-xl border px-4 py-2.5 text-sm font-semibold ${selectedSize === size ? 'border-[#11243e] bg-[#11243e] text-white' : 'border-slate-200 text-slate-600'}`} key={size} onClick={() => setSelectedSize(size)} type="button">{size}</button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-8">
            <p className="font-semibold text-[#11243e]">Quantity</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-full border border-slate-200">
                <button aria-label="Decrease quantity" className="grid size-11 place-items-center text-slate-600 disabled:opacity-30" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)} type="button"><Minus size={17} /></button>
                <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                <button aria-label="Increase quantity" className="grid size-11 place-items-center text-slate-600 disabled:opacity-30" disabled={quantity >= maximumQuantity} onClick={() => setQuantity((value) => value + 1)} type="button"><Plus size={17} /></button>
              </div>
              {product.stock === 0 ? <span className="text-sm font-semibold text-slate-500">Out of stock</span> : product.stock <= 5 ? <span className="text-sm font-semibold text-rose-700">Only {product.stock} left!</span> : <span className="text-sm font-semibold text-emerald-700">In stock</span>}
            </div>
          </div>

          <div className="mt-8 flex min-w-0 gap-3">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#11243e] px-6 py-4 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" disabled={product.stock === 0} onClick={addToCart} type="button">
              {added ? <Check size={19} /> : <ShoppingCart size={19} />}
              {product.stock === 0 ? 'Out of stock' : added ? `Added ${quantity} to cart` : 'Add to cart'}
            </button>
            <button aria-label="Add to favorites" className="grid size-14 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600 hover:text-blue-700" type="button"><Heart size={20} /></button>
          </div>

          <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 px-5">
            <InfoRow icon={Truck} title="Free delivery over $75" detail="Estimated delivery in 3–5 business days" />
            <InfoRow icon={RotateCcw} title="30-day returns" detail="Simple returns on unused items" />
            <InfoRow icon={ShieldCheck} title="Secure checkout" detail="Your payment information stays protected" />
          </div>
        </div>
      </section>
    </main>
  )
}

function InfoRow({ icon: Icon, title, detail }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Icon className="text-blue-700" size={20} />
      <div><p className="text-sm font-semibold text-[#11243e]">{title}</p><p className="text-xs text-slate-500">{detail}</p></div>
    </div>
  )
}

export default ProductDetailPage
