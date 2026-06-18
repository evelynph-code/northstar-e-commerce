function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-slate-950 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <a className="text-2xl font-bold tracking-tight" href="/">
            Market<span className="text-amber-400">Nest</span>
          </a>
          <input
            aria-label="Search products"
            className="hidden w-full max-w-2xl rounded-lg bg-white px-4 py-2 text-slate-900 outline-none ring-amber-400 focus:ring-2 md:block"
            placeholder="Search products"
            type="search"
          />
          <button className="whitespace-nowrap rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300">
            Cart (0)
          </button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-3 font-semibold uppercase tracking-widest text-amber-600">
            Everything you need
          </p>
          <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
            Your next favorite find is here.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            A full-stack e-commerce starter powered by React, Tailwind CSS,
            Node.js, and Express.
          </p>
          <button className="mt-8 rounded-lg bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800">
            Start shopping
          </button>
        </div>
        <div className="grid aspect-video place-items-center rounded-3xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 p-10 shadow-xl">
          <div className="rounded-2xl bg-white/90 px-10 py-8 text-center shadow-lg backdrop-blur">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
              Today&apos;s deal
            </p>
            <p className="mt-2 text-4xl font-black">Up to 40% off</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
