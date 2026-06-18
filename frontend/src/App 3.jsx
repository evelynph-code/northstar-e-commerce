const categories = ['New arrivals', 'Electronics', 'Home', 'Fashion', 'Beauty']

const products = [
  { name: 'Audio', label: 'Studio sound', color: 'from-sky-100 to-blue-200' },
  { name: 'Workspace', label: 'Work beautifully', color: 'from-slate-100 to-indigo-100' },
  { name: 'Everyday', label: 'Modern essentials', color: 'from-cyan-50 to-teal-100' },
]

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M19 20a7 7 0 0 0-14 0m11-12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M6.5 8h11l1 12h-13l1-12Zm3 1V6a2.5 2.5 0 0 1 5 0v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function App() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="bg-[#11243e] px-6 py-2.5 text-center text-xs font-medium tracking-wide text-slate-200">
        Complimentary delivery on orders over $75
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-5 sm:px-8">
          <a className="shrink-0 text-2xl font-bold tracking-[-0.06em] text-[#11243e]" href="/">
            NORTHSTAR
          </a>

          <label className="relative mx-auto hidden w-full max-w-xl md:block">
            <span className="sr-only">Search products</span>
            <input
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-5 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              placeholder="Search products and categories"
              type="search"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
              <SearchIcon />
            </span>
          </label>

          <div className="ml-auto flex items-center gap-1">
            <button aria-label="Your account" className="rounded-full p-3 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              <UserIcon />
            </button>
            <button aria-label="Shopping bag with 0 items" className="relative rounded-full p-3 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              <BagIcon />
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] font-bold text-white">0</span>
            </button>
          </div>
        </div>

        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center gap-7 overflow-x-auto px-5 pb-4 text-sm font-medium text-slate-600 sm:px-8">
          {categories.map((category) => (
            <a className="whitespace-nowrap transition hover:text-blue-700" href="#" key={category}>
              {category}
            </a>
          ))}
          <a className="ml-auto whitespace-nowrap font-semibold text-blue-700" href="#">Offers</a>
        </nav>
      </header>

      <section className="px-5 py-6 sm:px-8">
        <div className="relative mx-auto grid min-h-[560px] max-w-7xl overflow-hidden rounded-[2rem] bg-[#edf4fb] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 flex flex-col justify-center px-8 py-16 sm:px-14 lg:px-20">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              The summer edit
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-[#11243e] sm:text-6xl lg:text-7xl">
              Better essentials for everyday living.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Thoughtfully selected products for your home, work, and everything in between.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button className="rounded-full bg-[#11243e] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-900">
                Shop new arrivals
              </button>
              <button className="rounded-full border border-slate-300 bg-white/70 px-6 py-3.5 text-sm font-semibold text-[#11243e] transition hover:bg-white">
                Explore collections
              </button>
            </div>
          </div>

          <div className="relative min-h-80 overflow-hidden lg:min-h-full">
            <div className="absolute -right-16 top-1/2 size-[420px] -translate-y-1/2 rounded-full bg-blue-200/70 sm:size-[520px]" />
            <div className="absolute left-[16%] top-[18%] h-[64%] w-[62%] rotate-6 rounded-[2.5rem] bg-gradient-to-br from-[#183b68] to-[#69a2cf] shadow-2xl shadow-blue-900/20" />
            <div className="absolute left-[24%] top-[27%] h-[54%] w-[54%] -rotate-6 rounded-[2rem] border border-white/60 bg-white/75 shadow-xl backdrop-blur-md">
              <div className="flex h-full flex-col justify-between p-7">
                <span className="size-10 rounded-full bg-blue-600" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Northstar select</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-[#11243e]">Designed for the way you live.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Curated for you</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#11243e]">Shop by collection</h2>
          </div>
          <a className="hidden text-sm font-semibold text-slate-600 hover:text-blue-700 sm:block" href="#">View all →</a>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {products.map((product, index) => (
            <a className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg" href="#" key={product.name}>
              <div className={`relative aspect-[4/3] bg-gradient-to-br ${product.color}`}>
                <div className={`absolute rounded-full border border-white/80 bg-white/45 shadow-xl backdrop-blur ${index === 1 ? 'inset-16' : 'inset-x-20 inset-y-12'}`} />
              </div>
              <div className="flex items-center justify-between p-5">
                <div>
                  <p className="text-lg font-semibold text-[#11243e]">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{product.label}</p>
                </div>
                <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition group-hover:bg-blue-600 group-hover:text-white">→</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
