import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  LogOut,
  UserRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const productsPerPage = 12

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
  const { authLoading, logout, profile, user } = useAuth()
  const [selectedCategories, setSelectedCategories] = useState([])
  const [maxPrice, setMaxPrice] = useState(300)
  const [minRating, setMinRating] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inventory, setInventory] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
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

  const categoryOptions = useMemo(() => {
    const counts = inventory.reduce((result, product) => {
      result[product.category] = (result[product.category] || 0) + 1
      return result
    }, {})

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((first, second) => first.name.localeCompare(second.name))
  }, [inventory])

  const filteredProducts = useMemo(
    () =>
      inventory.filter(
        (product) =>
          (selectedCategories.length === 0 || selectedCategories.includes(product.category)) &&
          product.price <= maxPrice &&
          product.rating >= minRating,
      ),
    [inventory, maxPrice, minRating, selectedCategories],
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

  const addToCart = (productId) => {
    const product = inventory.find((item) => item.id === productId)
    if (!product || product.stock === 0) return

    setInventory((current) =>
      current.map((item) =>
        item.id === productId
          ? { ...item, stock: item.stock - 1, sold: item.sold + 1 }
          : item,
      ),
    )
    setCartCount((current) => current + 1)
  }

  const toggleCategory = (category) => {
    setCurrentPage(1)
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    )
  }

  const clearFilters = () => {
    setCurrentPage(1)
    setSelectedCategories([])
    setMaxPrice(300)
    setMinRating(0)
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
          <label className="relative mx-auto hidden w-full max-w-xl md:block">
            <span className="sr-only">Search products</span>
            <input className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-5 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="Search products and categories" type="search" />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          </label>
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
                    {(profile?.displayName || profile?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 sm:block">
                    <span className="block truncate text-sm font-semibold text-[#11243e]">
                      {profile?.displayName || 'My account'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{profile?.email}</span>
                  </span>
                  <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-3 sm:hidden">
                      <p className="truncate text-sm font-semibold text-[#11243e]">{profile?.displayName || 'My account'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{profile?.email}</p>
                    </div>
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
            <button aria-label={`Shopping bag with ${cartCount} items`} className="relative rounded-full p-3 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              <ShoppingBag size={20} />
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{cartCount}</span>
            </button>
          </div>
        </div>
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center gap-7 overflow-x-auto px-5 pb-4 text-sm font-medium text-slate-600 sm:px-8">
          <a className="whitespace-nowrap transition hover:text-blue-700" href="#">New arrivals</a>
          {categoryOptions.map(({ name }) => <a className="whitespace-nowrap transition hover:text-blue-700" href="#" key={name}>{name}</a>)}
          <a className="ml-auto whitespace-nowrap font-semibold text-blue-700" href="#">Offers</a>
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
              All products <span className="text-base font-normal text-slate-400">({filteredProducts.length})</span>
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
                    <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br ${product.color}`}>
                      <Link aria-label={`View ${product.name}`} className="absolute inset-0 z-10" to={`/products/${product.id}`} />
                      <div className="absolute inset-x-[24%] inset-y-[18%] rounded-[2rem] border border-white/80 bg-white/45 shadow-xl backdrop-blur" />
                      {product.originalPrice && (
                        <span className="absolute left-4 top-4 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                          {Math.round((1 - product.price / product.originalPrice) * 100)}% off
                        </span>
                      )}
                      <button aria-label={`Add ${product.name} to favorites`} className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:text-blue-700" type="button">
                        <Heart size={18} />
                      </button>
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
    </main>
  )
}

export default App
