import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  LogOut,
  Store,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useCart } from '../context/useCart.js'
import { inventorySocket } from '../lib/socket.js'

const productsPerPage = 12
const sellerCategoryFallbacks = ['Apparel', 'Accessories', 'Footwear', 'Home goods', 'Electronics', 'Beauty']

function formatSold(value) {
  if (value < 1000) return value.toString()
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}k`
}

function RatingStars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          className={star <= Math.round(rating) ? 'fill-blue-600 text-blue-600' : 'fill-slate-200 text-slate-200'}
          key={star}
          size={14}
        />
      ))}
    </span>
  )
}

function ProductMediaPreview({ product }) {
  const media = product.media?.[0]

  if (media?.type === 'video') {
    return <video className="size-full object-cover transition duration-500 group-hover:scale-105" muted src={media.url} />
  }

  if (media?.url) {
    return <img alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" src={media.url} />
  }

  return <div className="absolute inset-x-[24%] inset-y-[18%] rounded-[2rem] border border-white/80 bg-white/45 shadow-xl backdrop-blur" />
}

function FilterPanel({
  maxPrice,
  minRating,
  selectedCategories,
  categoryOptions,
  onCategoryChange,
  onPriceChange,
  onRatingChange,
  onClear,
}) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <h2 className="text-lg font-semibold text-[#11243e]">Filters</h2>
        <button className="text-sm font-semibold text-blue-700 hover:text-blue-900" onClick={onClear} type="button">
          Clear all
        </button>
      </div>

      <fieldset className="border-b border-slate-200 py-6">
        <legend className="mb-4 font-semibold text-[#11243e]">Category</legend>
        <div className="space-y-3">
          {categoryOptions.map(({ name, count }) => (
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600" key={name}>
              <input
                checked={selectedCategories.includes(name)}
                className="size-4 rounded border-slate-300 accent-blue-700"
                onChange={() => onCategoryChange(name)}
                type="checkbox"
              />
              <span>{name}</span>
              <span className="ml-auto text-xs text-slate-400">{count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-b border-slate-200 py-6">
        <legend className="font-semibold text-[#11243e]">Price range</legend>
        <div className="mt-5 flex items-center justify-between text-sm font-medium text-slate-600">
          <span>$0</span>
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-blue-700">Up to ${maxPrice}</span>
        </div>
        <input
          aria-label="Maximum price"
          className="mt-4 w-full accent-blue-700"
          max="300"
          min="25"
          onChange={(event) => onPriceChange(Number(event.target.value))}
          step="5"
          type="range"
          value={maxPrice}
        />
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>$25</span>
          <span>$300+</span>
        </div>
      </fieldset>

      <fieldset className="py-6">
        <legend className="mb-4 font-semibold text-[#11243e]">Rating</legend>
        <div className="space-y-3">
          {[4, 3, 2].map((rating) => (
            <label className="flex cursor-pointer items-center gap-3" key={rating}>
              <input
                checked={minRating === rating}
                className="size-4 accent-blue-700"
                name="rating"
                onChange={() => onRatingChange(rating)}
                type="radio"
              />
              <RatingStars rating={rating} />
              <span className="text-xs text-slate-500">& up</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

function App() {
  const { authLoading, logout, profile, updateProfileState, user } = useAuth()
  const { addItem, itemCount } = useCart()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryFromUrl = searchParams.get('category')
  const offersFromUrl = searchParams.get('offers') === 'true'
  const queryFromUrl = searchParams.get('q') || ''
  const [selectedCategories, setSelectedCategories] = useState(
    categoryFromUrl ? [categoryFromUrl] : [],
  )
  const [maxPrice, setMaxPrice] = useState(300)
  const [minRating, setMinRating] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inventory, setInventory] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [adminConfirmed, setAdminConfirmed] = useState(false)
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [sellerModalOpen, setSellerModalOpen] = useState(false)
  const [sellerStep, setSellerStep] = useState('confirm')
  const [sellerShop, setSellerShop] = useState({ name: '', category: '' })
  const [sellerError, setSellerError] = useState('')
  const [hasSellerShop, setHasSellerShop] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [offersOnly, setOffersOnly] = useState(offersFromUrl)
  const [searchQuery, setSearchQuery] = useState(queryFromUrl)
  const catalogRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProducts() {
      try {
        const response = await fetch('/api/products', { signal: controller.signal })
        if (!response.ok) throw new Error('Unable to load products.')
        const body = await response.json()
        setInventory(body.products)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setProductsError(error.message)
        }
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false)
      }
    }

    loadProducts()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const handleStockUpdate = ({ productId, stock }) => {
      setInventory((current) =>
        current.map((product) =>
          product.id === productId ? { ...product, stock } : product,
        ),
      )
    }

    inventorySocket.on('product:stock', handleStockUpdate)
    return () => inventorySocket.off('product:stock', handleStockUpdate)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCurrentPage(1)
      setSelectedCategories(categoryFromUrl ? [categoryFromUrl] : [])
      setOffersOnly(offersFromUrl)
      setSearchQuery(queryFromUrl)

      if (categoryFromUrl || offersFromUrl || queryFromUrl) {
        catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [categoryFromUrl, offersFromUrl, queryFromUrl])

  useEffect(() => {
    if (!user) return

    const controller = new AbortController()

    async function loadSellerStatus() {
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/seller/workspace', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (response.ok) setHasSellerShop(Boolean(body.shop?.name?.trim()))
      } catch {
        if (!controller.signal.aborted) setHasSellerShop(false)
      }
    }

    loadSellerStatus()
    return () => controller.abort()
  }, [user])

  const categoryOptions = useMemo(() => {
    const counts = inventory.reduce((result, product) => {
      result[product.category] = (result[product.category] || 0) + 1
      return result
    }, {})

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((first, second) => first.name.localeCompare(second.name))
  }, [inventory])

  const sellerCategoryOptions = categoryOptions.length > 0
    ? categoryOptions.map(({ name }) => name)
    : sellerCategoryFallbacks

  const filteredProducts = useMemo(
    () => {
      const normalizedQuery = searchQuery.trim().toLowerCase()

      return inventory.filter(
        (product) => {
          const matchesKeyword =
            normalizedQuery.length === 0 ||
            [product.name, product.category, product.description]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(normalizedQuery))

          return (
          (selectedCategories.length === 0 || selectedCategories.includes(product.category)) &&
          product.price <= maxPrice &&
          product.rating >= minRating &&
          (!offersOnly || Boolean(product.originalPrice)) &&
          matchesKeyword
          )
        },
      )
    },
    [inventory, maxPrice, minRating, offersOnly, searchQuery, selectedCategories],
  )

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage))
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage,
  )

  const changePage = (page) => {
    setCurrentPage(page)
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const addToCart = async (productId) => {
    const product = inventory.find((item) => item.id === productId)
    if (!product || product.stock === 0) return

    try {
      await addItem(product)
    } catch (error) {
      console.error(error)
    }
  }

  const toggleCategory = (category) => {
    const nextCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category]

    setCurrentPage(1)
    setOffersOnly(false)
    setSelectedCategories(nextCategories)
    setSearchParams(nextCategories.length === 1 ? { category: nextCategories[0] } : {})
  }

  const clearFilters = () => {
    setCurrentPage(1)
    setSelectedCategories([])
    setMaxPrice(300)
    setMinRating(0)
    setOffersOnly(false)
    setSearchQuery('')
    setSearchParams({})
  }

  const submitSearch = (event) => {
    event.preventDefault()
    const query = searchQuery.trim()
    setCurrentPage(1)
    setSelectedCategories([])
    setOffersOnly(false)
    setSearchParams(query ? { q: query } : {})
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const clearSearch = () => {
    setCurrentPage(1)
    setSearchQuery('')
    setSearchParams({})
  }

  const filterByCategory = (category) => {
    setCurrentPage(1)
    setOffersOnly(false)
    setSelectedCategories([category])
    setSearchParams({ category })
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const showAllProducts = () => {
    clearFilters()
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const requestAdminAccess = async (event) => {
    event.preventDefault()
    if (!adminConfirmed) return

    setAdminSaving(true)
    setAdminError('')

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/auth/me/admin-access', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmAdmin: true }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to enable management access.')

      updateProfileState(body.user)
      setAdminModalOpen(false)
      setAdminConfirmed(false)
      navigate('/admin')
    } catch (caughtError) {
      setAdminError(caughtError.message)
    } finally {
      setAdminSaving(false)
    }
  }

  const openSellerOnboarding = () => {
    setProfileOpen(false)
    setSellerModalOpen(true)
    setSellerStep('confirm')
    setSellerShop({ name: '', category: sellerCategoryOptions[0] || '' })
    setSellerError('')
  }

  const createSellerShop = async (event) => {
    event.preventDefault()
    setSellerError('')

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/seller/shop', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sellerShop),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to create your shop.')

      setHasSellerShop(true)
      setSellerModalOpen(false)
      navigate('/seller')
    } catch (caughtError) {
      setSellerError(caughtError.message)
    }
  }

  const showOffers = () => {
    setCurrentPage(1)
    setSelectedCategories([])
    setOffersOnly(true)
    setSearchParams({ offers: 'true' })
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const filterProps = {
    maxPrice,
    minRating,
    categoryOptions,
    selectedCategories,
    onCategoryChange: toggleCategory,
    onPriceChange: (price) => {
      setCurrentPage(1)
      setMaxPrice(price)
    },
    onRatingChange: (rating) => {
      setCurrentPage(1)
      setMinRating(rating)
    },
    onClear: clearFilters,
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="bg-[#11243e] px-6 py-2.5 text-center text-xs font-medium tracking-wide text-slate-200">
        Complimentary delivery on orders over $75
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-5 sm:px-8">
          <a className="shrink-0 text-2xl font-bold tracking-[-0.06em] text-[#11243e]" href="/">NORTHSTAR</a>
          <form className="relative mx-auto hidden w-full max-w-xl md:block" onSubmit={submitSearch}>
            <label>
              <span className="sr-only">Search products</span>
              <input
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-5 pr-20 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products and categories"
                type="search"
                value={searchQuery}
              />
            </label>
            {searchQuery && (
              <button
                aria-label="Clear search"
                className="absolute right-11 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                onClick={clearSearch}
                type="button"
              >
                <X size={16} />
              </button>
            )}
            <button
              aria-label="Search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:text-blue-700"
              type="submit"
            >
              <Search size={20} />
            </button>
          </form>
          <div className="ml-auto flex items-center gap-1">
            {!authLoading && user ? (
              <div className="relative">
                <button
                  aria-expanded={profileOpen}
                  aria-label="Open account menu"
                  className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-left transition hover:bg-slate-100"
                  onClick={() => setProfileOpen((current) => !current)}
                  type="button"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                    {(profile?.userName || profile?.displayName || profile?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 sm:block">
                    <span className="block truncate text-sm font-semibold text-[#11243e]">
                      {profile?.userName || profile?.displayName || 'My account'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{profile?.email}</span>
                  </span>
                  <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-3 sm:hidden">
                      <p className="truncate text-sm font-semibold text-[#11243e]">{profile?.userName || profile?.displayName || 'My account'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{profile?.email}</p>
                    </div>
                    <Link
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                      onClick={() => setProfileOpen(false)}
                      to="/account"
                    >
                      <UserRound size={17} /> Account information
                    </Link>
                    <Link
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                      onClick={() => setProfileOpen(false)}
                      to="/account?section=orders"
                    >
                      <ShoppingBag size={17} /> My orders
                    </Link>
                    {hasSellerShop ? (
                      <Link
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                        onClick={() => setProfileOpen(false)}
                        to="/seller"
                      >
                        <Store size={17} /> My shop
                      </Link>
                    ) : (
                      <button
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                        onClick={openSellerOnboarding}
                        type="button"
                      >
                        <Store size={17} /> Become a seller
                      </button>
                    )}
                    {profile?.isAdmin && (
                      <Link
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                        onClick={() => setProfileOpen(false)}
                        to="/admin"
                      >
                        <ClipboardList size={17} /> Management console
                      </Link>
                    )}
                    {!profile?.isAdmin && (
                      <button
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                        onClick={() => {
                          setProfileOpen(false)
                          setAdminModalOpen(true)
                          setAdminError('')
                        }}
                        type="button"
                      >
                        <ClipboardList size={17} /> Management access
                      </button>
                    )}
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-rose-700"
                      onClick={logout}
                      type="button"
                    >
                      <LogOut size={17} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              !authLoading && (
                <Link aria-label="Sign in" className="rounded-full p-3 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" to="/login">
                  <UserRound size={20} />
                </Link>
              )
            )}
            <Link aria-label={`Shopping bag with ${itemCount} items`} className="relative rounded-full p-3 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" to="/cart">
              <ShoppingBag size={20} />
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{itemCount}</span>
            </Link>
          </div>
        </div>
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center gap-7 overflow-x-auto px-5 pb-4 text-sm font-medium text-slate-600 sm:px-8">
          <button
            className={`whitespace-nowrap transition hover:text-blue-700 ${
              selectedCategories.length === 0 && !offersOnly ? 'font-semibold text-blue-700' : ''
            }`}
            onClick={showAllProducts}
            type="button"
          >
            All products
          </button>
          {categoryOptions.map(({ name }) => (
            <button
              aria-pressed={selectedCategories.length === 1 && selectedCategories[0] === name}
              className={`whitespace-nowrap transition hover:text-blue-700 ${
                selectedCategories.length === 1 && selectedCategories[0] === name
                  ? 'font-semibold text-blue-700'
                  : ''
              }`}
              key={name}
              onClick={() => filterByCategory(name)}
              type="button"
            >
              {name}
            </button>
          ))}
          <button
            aria-pressed={offersOnly}
            className={`ml-auto whitespace-nowrap font-semibold ${
              offersOnly ? 'text-blue-900 underline decoration-2 underline-offset-4' : 'text-blue-700'
            }`}
            onClick={showOffers}
            type="button"
          >
            Offers
          </button>
        </nav>
      </header>

      <section className="bg-[#edf4fb]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">The Northstar Edit</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-[#11243e] sm:text-5xl">Products made for better everyday living.</h1>
          <p className="mt-4 max-w-xl leading-7 text-slate-600">Explore our thoughtfully selected collection of modern essentials.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl scroll-mt-6 px-5 py-10 sm:px-8" ref={catalogRef}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm text-slate-500">Home / All products</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#11243e]">
              {queryFromUrl ? `Results for “${queryFromUrl}”` : 'All products'}{' '}
              <span className="text-base font-normal text-slate-400">({filteredProducts.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#11243e] lg:hidden" onClick={() => setFiltersOpen(true)} type="button">
              <SlidersHorizontal size={17} /> Filters
            </button>
            <button className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#11243e]" type="button">
              Featured <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-6"><FilterPanel {...filterProps} /></div>
          </aside>

          <div>
            {productsLoading ? (
              <div className="grid min-h-80 place-items-center rounded-2xl bg-slate-50">
                <div className="text-center">
                  <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
                  <p className="mt-4 text-sm font-medium text-slate-500">Loading products…</p>
                </div>
              </div>
            ) : productsError ? (
              <div className="grid min-h-80 place-items-center rounded-2xl border border-rose-200 bg-rose-50 text-center">
                <div>
                  <h3 className="font-semibold text-rose-800">Products could not be loaded</h3>
                  <p className="mt-1 text-sm text-rose-600">{productsError}</p>
                </div>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedProducts.map((product) => (
                  <article className="group flex flex-col" key={product.id}>
                    <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br ${product.color || 'from-slate-100 to-blue-100'}`}>
                      <Link aria-label={`View ${product.name}`} className="absolute inset-0 z-10" to={`/products/${product.id}`} />
                      <ProductMediaPreview product={product} />
                      {product.originalPrice && (
                        <span className="absolute left-4 top-4 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                          {Math.round((1 - product.price / product.originalPrice) * 100)}% off
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{product.category}</p>
                      <h3 className="mt-1 font-semibold text-[#11243e]">
                        <Link className="hover:text-blue-700" to={`/products/${product.id}`}>{product.name}</Link>
                      </h3>
                      <div className="mt-2 flex items-center gap-2">
                        <RatingStars rating={product.rating} />
                        <span className="text-xs text-slate-400">({product.reviews})</span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <p className="font-semibold text-[#11243e]">${product.price.toFixed(2)}</p>
                        {product.originalPrice && (
                          <p className="text-sm text-slate-400 line-through">
                            ${product.originalPrice.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-500">{formatSold(product.sold)} sold</span>
                        {product.stock === 0 ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500">Out of stock</span>
                        ) : product.stock <= 5 ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">Only {product.stock} left!</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">In stock</span>
                        )}
                      </div>
                      <button
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#11243e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                        disabled={product.stock === 0}
                        onClick={() => addToCart(product.id)}
                        type="button"
                      >
                        <ShoppingCart size={17} />
                        {product.stock === 0 ? 'Out of stock' : 'Add to cart'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
                <div>
                  <Search className="mx-auto text-slate-400" size={28} />
                  <h3 className="mt-4 font-semibold text-[#11243e]">No products found</h3>
                  <p className="mt-1 text-sm text-slate-500">Try adjusting or clearing your filters.</p>
                  <button className="mt-5 text-sm font-semibold text-blue-700" onClick={clearFilters} type="button">Clear all filters</button>
                </div>
              </div>
            )}
            {!productsLoading && !productsError && filteredProducts.length > 0 && totalPages > 1 && (
              <nav aria-label="Product pages" className="mt-12 flex flex-wrap items-center justify-center gap-2">
                <button
                  className="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={currentPage === 1}
                  onClick={() => changePage(currentPage - 1)}
                  type="button"
                >
                  <ChevronLeft size={18} />
                  <span className="sr-only">Previous page</span>
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    aria-current={currentPage === page ? 'page' : undefined}
                    className={`size-10 rounded-full text-sm font-semibold transition ${
                      currentPage === page
                        ? 'bg-[#11243e] text-white'
                        : 'border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700'
                    }`}
                    key={page}
                    onClick={() => changePage(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={currentPage === totalPages}
                  onClick={() => changePage(currentPage + 1)}
                  type="button"
                >
                  <ChevronRight size={18} />
                  <span className="sr-only">Next page</span>
                </button>
              </nav>
            )}
          </div>
        </div>
      </section>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close filters" className="absolute inset-0 bg-slate-950/35" onClick={() => setFiltersOpen(false)} type="button" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-5 flex justify-end">
              <button aria-label="Close filters" className="rounded-full bg-slate-100 p-2 text-slate-600" onClick={() => setFiltersOpen(false)} type="button"><X size={20} /></button>
            </div>
            <FilterPanel {...filterProps} />
            <button className="mt-3 w-full rounded-full bg-[#11243e] px-5 py-3 text-sm font-semibold text-white" onClick={() => setFiltersOpen(false)} type="button">
              Show {filteredProducts.length} products
            </button>
          </aside>
        </div>
      )}

      {sellerModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-5">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Store size={21} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-[#11243e]">
                  {sellerStep === 'confirm' ? 'Become a seller' : 'Create your shop'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {sellerStep === 'confirm'
                    ? 'Are you sure you want to be a seller?'
                    : 'Start with a shop name and the main category of items you plan to sell.'}
                </p>
              </div>
            </div>

            {sellerStep === 'confirm' ? (
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => setSellerModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-[#11243e] px-5 py-2.5 text-sm font-semibold text-white"
                  onClick={() => setSellerStep('create')}
                  type="button"
                >
                  Yes, continue
                </button>
              </div>
            ) : (
              <form className="mt-6 space-y-5" onSubmit={createSellerShop}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Shop name</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    onChange={(event) => setSellerShop((current) => ({ ...current, name: event.target.value }))}
                    required
                    value={sellerShop.name}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Selling category</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    onChange={(event) => setSellerShop((current) => ({ ...current, category: event.target.value }))}
                    required
                    value={sellerShop.category}
                  >
                    {sellerCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                {sellerError && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{sellerError}</p>}
                <div className="flex flex-wrap justify-end gap-3 pt-1">
                  <button
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    onClick={() => setSellerStep('confirm')}
                    type="button"
                  >
                    Back
                  </button>
                  <button className="rounded-full bg-[#11243e] px-5 py-2.5 text-sm font-semibold text-white" type="submit">
                    Create shop
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {adminModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-5">
          <form className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7" onSubmit={requestAdminAccess}>
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
                <ClipboardList size={21} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-[#11243e]">Management access</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Confirm your administrative access to continue to the management console.</p>
              </div>
            </div>

            <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-700">
              <input
                checked={adminConfirmed}
                className="size-4 accent-blue-700"
                onChange={(event) => setAdminConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>Confirm I am an admin</span>
            </label>

            {adminError && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{adminError}</p>}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setAdminModalOpen(false)
                  setAdminConfirmed(false)
                  setAdminError('')
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#11243e] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!adminConfirmed || adminSaving}
                type="submit"
              >
                <ClipboardList size={17} /> {adminSaving ? 'Confirming...' : 'Open console'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

export default App
