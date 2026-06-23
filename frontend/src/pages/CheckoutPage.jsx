import { useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  MapPin,
  PackageCheck,
} from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useCart } from '../context/useCart.js'

const coupons = {
  NORTHSTAR10: { type: 'percent', value: 10 },
  SAVE20: { type: 'fixed', value: 20, minimum: 100 },
  FREESHIP: { type: 'shipping' },
}

function CheckoutPage() {
  const { authLoading, profile, user } = useAuth()
  const { cartId, completeOrder, items, subtotal } = useCart()
  const [searchParams] = useSearchParams()
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedOrder, setCompletedOrder] = useState(null)

  const couponCode = searchParams.get('coupon')?.toUpperCase() || ''
  const coupon = coupons[couponCode]
  const couponDiscount =
    coupon?.type === 'percent'
      ? subtotal * (coupon.value / 100)
      : coupon?.type === 'fixed' && subtotal >= coupon.minimum
        ? coupon.value
        : 0
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount)
  const shipping = subtotal >= 75 || coupon?.type === 'shipping' ? 0 : 8.99
  const tax = discountedSubtotal * 0.08
  const total = discountedSubtotal + shipping + tax

  const placeOrder = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const form = new FormData(event.currentTarget)
      const cardNumber = String(form.get('cardNumber') || '').replace(/\s/g, '')

      if (paymentMethod === 'card' && cardNumber.length < 12) {
        throw new Error('Enter a valid placeholder card number.')
      }

      const token = await user.getIdToken()
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartId,
          couponCode,
          paymentMethod,
          cardLast4: paymentMethod === 'card' ? cardNumber.slice(-4) : null,
          delivery: {
            fullName: form.get('fullName'),
            email: form.get('email'),
            phone: form.get('phone'),
            address: form.get('address'),
            city: form.get('city'),
            postalCode: form.get('postalCode'),
          },
          items,
        }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body.message || 'Unable to place your order.')
      }

      setCompletedOrder(body.order)
      completeOrder()
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (!user) {
    return <Navigate replace state={{ from: '/checkout' }} to="/login" />
  }

  if (completedOrder) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <PackageCheck size={30} />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#11243e]">Order confirmed</h1>
          <p className="mt-3 text-slate-500">Your order has been created successfully.</p>
          <div className="mt-7 rounded-2xl bg-slate-50 p-5 text-left text-sm">
            <div className="flex justify-between gap-4"><span className="text-slate-500">Order ID</span><span className="font-semibold text-[#11243e]">{completedOrder.id}</span></div>
            <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Total</span><span className="font-semibold text-[#11243e]">${completedOrder.total.toFixed(2)}</span></div>
            <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Payment</span><span className="font-semibold text-[#11243e]">{completedOrder.paymentStatus === 'pending_on_delivery' ? 'Pay on delivery' : 'Card authorized (placeholder)'}</span></div>
          </div>
          <Link className="mt-7 inline-flex rounded-full bg-[#11243e] px-6 py-3 text-sm font-semibold text-white" to="/">Continue shopping</Link>
        </div>
      </main>
    )
  }

  if (items.length === 0) return <Navigate replace to="/cart" />

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="page-container flex items-center py-5">
          <Link className="text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
          <span className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><LockKeyhole size={17} /> Secure checkout</span>
        </div>
      </header>

      <form className="page-container grid items-start gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-14 xl:gap-12" onSubmit={placeOrder}>
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700" to="/cart"><ArrowLeft size={17} /> Back to cart</Link>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-[#11243e] sm:text-5xl">Checkout</h1>

          <section className="mt-9 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-blue-50 text-blue-700"><MapPin size={20} /></span>
              <div><h2 className="text-xl font-semibold text-[#11243e]">Delivery details</h2><p className="text-sm text-slate-500">We’ll use these details for this order.</p></div>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Field defaultValue={profile?.displayName || ''} label="Full name" name="fullName" />
              <Field defaultValue={profile?.email || user.email || ''} label="Email" name="email" type="email" />
              <Field defaultValue={profile?.phone || ''} label="Phone" name="phone" type="tel" />
              <Field defaultValue={profile?.postalCode || ''} label="Postal code" name="postalCode" />
              <div className="sm:col-span-2"><Field defaultValue={profile?.address || ''} label="Street address" name="address" /></div>
              <div className="sm:col-span-2"><Field defaultValue={profile?.city || ''} label="City / Province" name="city" /></div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[#11243e]">Payment method</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PaymentOption active={paymentMethod === 'card'} icon={CreditCard} label="Pay by card" onClick={() => setPaymentMethod('card')} />
              <PaymentOption active={paymentMethod === 'delivery'} icon={Banknote} label="Pay on delivery" onClick={() => setPaymentMethod('delivery')} />
            </div>
            {paymentMethod === 'card' && (
              <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Placeholder card form — no payment is processed</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label="Card number" name="cardNumber" placeholder="4242 4242 4242 4242" /></div>
                  <Field label="Expiry" name="expiry" placeholder="MM / YY" />
                  <Field label="Security code" name="cvc" placeholder="CVC" />
                </div>
              </div>
            )}
          </section>

          {error && <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">{error}</p>}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-[#11243e]">Order summary</h2>
          <div className="mt-5 space-y-4 border-b border-slate-200 pb-5">
            {items.map((item) => (
              <div className="flex justify-between gap-4 text-sm" key={item.lineId}>
                <span className="min-w-0 text-slate-600"><span className="font-medium text-[#11243e]">{item.quantity}×</span> {item.name}</span>
                <span className="shrink-0 font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            {couponDiscount > 0 && <SummaryRow accent label={`Coupon (${couponCode})`} value={`-$${couponDiscount.toFixed(2)}`} />}
            <SummaryRow label="Shipping" value={shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`} />
            <SummaryRow label="Estimated tax" value={`$${tax.toFixed(2)}`} />
          </dl>
          <div className="mt-5 flex items-end justify-between border-t border-slate-200 pt-5">
            <span className="font-semibold text-[#11243e]">Total</span>
            <span className="text-2xl font-semibold text-[#11243e]">${total.toFixed(2)}</span>
          </div>
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#11243e] px-6 py-4 font-semibold text-white hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60" disabled={submitting} type="submit">
            {submitting ? 'Checking inventory…' : <><CheckCircle2 size={19} /> Place order</>}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-400">Inventory is verified securely before your order is created.</p>
        </aside>
      </form>
    </main>
  )
}

function Field({ label, name, type = 'text', ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" name={name} required type={type} {...props} /></label>
}

function PaymentOption({ active, icon: Icon, label, onClick }) {
  return <button className={`flex items-center gap-3 rounded-2xl border p-4 text-left font-semibold transition ${active ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`} onClick={onClick} type="button"><span className={`grid size-10 place-items-center rounded-full ${active ? 'bg-white' : 'bg-slate-100'}`}><Icon size={20} /></span>{label}</button>
}

function SummaryRow({ accent, label, value }) {
  return <div className={`flex justify-between gap-4 ${accent ? 'text-emerald-700' : 'text-slate-600'}`}><dt>{label}</dt><dd className="font-medium">{value}</dd></div>
}

export default CheckoutPage
