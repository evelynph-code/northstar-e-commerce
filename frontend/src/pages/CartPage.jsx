import {
  ArrowLeft,
  Check,
  CircleX,
  Gift,
  LockKeyhole,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/useCart.js'

const fallbackColors = { start: '#dbeafe', end: '#93c5fd' }
const coupons = {
  NORTHSTAR10: { type: 'percent', value: 10, label: '10% off your order' },
  SAVE20: { type: 'fixed', value: 20, label: '$20 off orders over $100', minimum: 100 },
  FREESHIP: { type: 'shipping', value: 0, label: 'Free delivery' },
}

function CartArtwork({ colors, name }) {
  const palette = colors?.[0] || fallbackColors

  return (
    <div
      aria-label={`${name} product image`}
      className="relative grid h-full w-full place-items-center overflow-hidden"
      role="img"
      style={{ background: `linear-gradient(135deg, ${palette.start}, ${palette.end})` }}
    >
      <div className="absolute -right-5 -top-5 size-20 rounded-full bg-white/35" />
      <div className="aspect-square w-[46%] rotate-6 rounded-[28%] border border-white/70 bg-white/50 shadow-lg backdrop-blur" />
    </div>
  )
}

function CartPage() {
  const {
    itemCount,
    items,
    originalSubtotal,
    refreshStock,
    removeItem,
    subtotal,
    updateQuantity,
  } = useCart()
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponMessage, setCouponMessage] = useState('')

  useEffect(() => {
    refreshStock().catch(console.error)
  }, [refreshStock])

  const savings = originalSubtotal - subtotal
  const couponDiscount = appliedCoupon?.type === 'percent'
    ? subtotal * (appliedCoupon.value / 100)
    : appliedCoupon?.type === 'fixed'
      ? appliedCoupon.value
      : 0
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount)
  const shipping = subtotal === 0 || subtotal >= 75 || appliedCoupon?.type === 'shipping' ? 0 : 8.99
  const estimatedTax = discountedSubtotal * 0.08
  const total = discountedSubtotal + shipping + estimatedTax

  const applyCoupon = (event) => {
    event.preventDefault()
    const code = couponInput.trim().toUpperCase()
    const coupon = coupons[code]

    if (!coupon) {
      setAppliedCoupon(null)
      setCouponMessage('That coupon code is not valid.')
      return
    }

    if (coupon.minimum && subtotal < coupon.minimum) {
      setAppliedCoupon(null)
      setCouponMessage(`This coupon requires a minimum order of $${coupon.minimum}.`)
      return
    }

    setAppliedCoupon({ ...coupon, code })
    setCouponInput(code)
    setCouponMessage(coupon.label)
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponMessage('')
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="bg-[#11243e] px-6 py-2.5 text-center text-xs font-medium tracking-wide text-slate-200">
        Complimentary delivery on orders over $75
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="page-container flex items-center py-5">
          <Link className="text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
          <div className="ml-auto flex items-center gap-2 text-sm font-semibold text-slate-600">
            <ShoppingBag size={19} />
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </div>
        </div>
      </header>

      <div className="page-container py-10 sm:py-14">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700" to="/">
          <ArrowLeft size={17} /> Continue shopping
        </Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-[#11243e] sm:text-5xl">Your cart</h1>

        {items.length === 0 ? (
          <section className="mt-10 grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-blue-50 text-blue-700">
                <ShoppingBag size={27} />
              </span>
              <h2 className="mt-5 text-2xl font-semibold text-[#11243e]">Your cart is empty</h2>
              <p className="mt-2 text-slate-500">There are plenty of good things waiting in the catalog.</p>
              <Link className="mt-7 inline-flex rounded-full bg-[#11243e] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-900" to="/">
                Browse products
              </Link>
            </div>
          </section>
        ) : (
          <div className="mt-10 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-12">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4 sm:px-7">
                <h2 className="font-semibold text-[#11243e]">Cart items ({itemCount})</h2>
              </div>

              <div className="divide-y divide-slate-200">
                {items.map((item) => (
                  <article className="flex items-start gap-4 p-5 sm:gap-5 sm:p-7" key={item.lineId}>
                    <Link
                      className="h-24 w-24 flex-none overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28 sm:rounded-2xl"
                      to={`/products/${item.productId}`}
                    >
                      <CartArtwork colors={item.galleryColors} name={item.name} />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">{item.category}</p>
                          <h3 className="mt-1 text-lg font-semibold text-[#11243e]">
                            <Link className="hover:text-blue-700" to={`/products/${item.productId}`}>{item.name}</Link>
                          </h3>
                          {(item.color || item.size) && (
                            <p className="mt-2 text-sm text-slate-500">
                              {[item.color && `Color: ${item.color}`, item.size && `Size: ${item.size}`].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <button
                          aria-label={`Remove ${item.name}`}
                          className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => removeItem(item.lineId)}
                          type="button"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                        <div className="flex items-center rounded-full border border-slate-200">
                          <button
                            aria-label={`Decrease ${item.name} quantity`}
                            className="grid size-10 place-items-center text-slate-600 disabled:opacity-30"
                            disabled={item.quantity === 1}
                            onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                            type="button"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-9 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            aria-label={`Increase ${item.name} quantity`}
                            className="grid size-10 place-items-center text-slate-600 disabled:opacity-30"
                            disabled={item.quantity >= item.stock}
                            onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                            type="button"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-semibold text-[#11243e]">${(item.price * item.quantity).toFixed(2)}</p>
                          {item.originalPrice && (
                            <p className="text-sm text-slate-400 line-through">${(item.originalPrice * item.quantity).toFixed(2)}</p>
                          )}
                        </div>
                      </div>

                      {item.stock <= 5 && (
                        <p className="mt-3 text-xs font-semibold text-rose-700">Only {item.stock} available</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:sticky md:top-6">
              <h2 className="text-xl font-semibold text-[#11243e]">Order summary</h2>

              <div className="mt-6 border-y border-slate-200 py-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#11243e]" htmlFor="coupon">
                  <Gift size={17} className="text-blue-700" /> Coupon code
                </label>
                <form className="mt-3 flex gap-2" onSubmit={applyCoupon}>
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    disabled={Boolean(appliedCoupon)}
                    id="coupon"
                    onChange={(event) => {
                      setCouponInput(event.target.value)
                      setCouponMessage('')
                    }}
                    placeholder="Enter code"
                    type="text"
                    value={couponInput}
                  />
                  {appliedCoupon ? (
                    <button
                      aria-label="Remove coupon"
                      className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={removeCoupon}
                      type="button"
                    >
                      <CircleX size={18} />
                    </button>
                  ) : (
                    <button
                      className="shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-[#11243e] hover:bg-slate-200"
                      type="submit"
                    >
                      Apply
                    </button>
                  )}
                </form>
                {couponMessage && (
                  <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                    appliedCoupon ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {appliedCoupon && <Check size={14} />}
                    {couponMessage}
                  </p>
                )}
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-4 text-slate-600">
                  <dt>Subtotal</dt><dd className="font-medium text-[#11243e]">${subtotal.toFixed(2)}</dd>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between gap-4 text-emerald-700">
                    <dt>You save</dt><dd className="font-semibold">-${savings.toFixed(2)}</dd>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between gap-4 text-emerald-700">
                    <dt>Coupon ({appliedCoupon.code})</dt><dd className="font-semibold">-${couponDiscount.toFixed(2)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 text-slate-600">
                  <dt>Shipping</dt><dd className="font-medium text-[#11243e]">{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</dd>
                </div>
                <div className="flex justify-between gap-4 text-slate-600">
                  <dt>Estimated tax</dt><dd className="font-medium text-[#11243e]">${estimatedTax.toFixed(2)}</dd>
                </div>
              </dl>

              {subtotal < 75 && (
                <div className="mt-6 rounded-2xl bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <Truck size={17} /> ${(75 - subtotal).toFixed(2)} away from free delivery
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min((subtotal / 75) * 100, 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-6">
                <div><p className="font-semibold text-[#11243e]">Estimated total</p><p className="text-xs text-slate-400">USD</p></div>
                <p className="text-2xl font-semibold text-[#11243e]">${total.toFixed(2)}</p>
              </div>

              <Link
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#11243e] px-6 py-4 font-semibold text-white hover:bg-blue-900"
                to={`/checkout${appliedCoupon ? `?coupon=${appliedCoupon.code}` : ''}`}
              >
                <LockKeyhole size={18} /> Proceed to checkout
              </Link>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">Taxes and shipping are finalized during checkout.</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

export default CartPage
