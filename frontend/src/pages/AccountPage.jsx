import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  House,
  KeyRound,
  LogOut,
  Package,
  PackageCheck,
  Save,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  XCircle,
} from 'lucide-react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { auth } from '../lib/firebase.js'
import { useAuth } from '../context/useAuth.js'

const sections = [
  { id: 'information', label: 'Information', icon: CircleUserRound },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'security', label: 'Security', icon: ShieldCheck },
]

const orderGroups = [
  { id: 'active', title: 'Confirmed / Packing', statuses: ['confirmed', 'packing'] },
  { id: 'inTransit', title: 'Shipped / Delivered', statuses: ['shipped', 'delivered'] },
  { id: 'closed', title: 'Cancelled / Returned', statuses: ['cancelled', 'returned'] },
  { id: 'reviewed', title: 'Reviewed', statuses: [] },
]
const returnReasons = [
  { label: 'Item arrived damaged or defective', value: 'damaged_or_defective' },
  { label: 'Incorrect item, size, or color received', value: 'incorrect_item_details' },
  { label: 'Delivery address issue', value: 'delivery_address_issue' },
  { label: 'Item is no longer needed', value: 'no_longer_needed' },
  { label: 'Other', value: 'other' },
]

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`
}

function AccountPage() {
  const { authLoading, logout, profile, updateProfileState, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSection = searchParams.get('section')
  const activeSection = sections.some((section) => section.id === requestedSection)
    ? requestedSection
    : 'information'
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [form, setForm] = useState({
    displayName: '',
    userName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [hasSellerShop, setHasSellerShop] = useState(false)
  const [savedCards, setSavedCards] = useState([])
  const [cardForm, setCardForm] = useState({
    nickname: '',
    cardholder: '',
    brand: 'Visa',
    number: '',
    expiry: '',
  })
  const [activeOrderTab, setActiveOrderTab] = useState(orderGroups[0].id)
  const [reviewingItem, setReviewingItem] = useState(null)
  const [reviewForm, setReviewForm] = useState({ body: '', rating: 5, title: '' })
  const [returningOrder, setReturningOrder] = useState(null)
  const [returnForm, setReturnForm] = useState({ itemIndexes: [], notes: '', reason: returnReasons[0].value })

  const groupedOrders = useMemo(() => {
    const reviewed = orders.filter((order) => order.reviewed && !['cancelled', 'returned'].includes(order.status))
    return orderGroups.map((group) => ({
      ...group,
      orders: group.id === 'reviewed'
        ? reviewed
        : orders.filter((order) => group.statuses.includes(order.status) && (group.id === 'closed' || !order.reviewed)),
    }))
  }, [orders])
  const activeOrderGroup = groupedOrders.find((group) => group.id === activeOrderTab) || groupedOrders[0]

  useEffect(() => {
    if (!profile) return
    const frame = requestAnimationFrame(() => {
      setForm({
        displayName: profile.displayName || '',
        userName: profile.userName || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        postalCode: profile.postalCode || '',
        country: profile.country || '',
      })
      setSavedCards(Array.isArray(profile.savedCards) ? profile.savedCards : [])
    })

    return () => cancelAnimationFrame(frame)
  }, [profile])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()

    async function loadOrders() {
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Unable to load orders.')
        const body = await response.json()
        setOrders(body.orders)
      } catch (caughtError) {
        if (caughtError.name !== 'AbortError') setError(caughtError.message)
      } finally {
        if (!controller.signal.aborted) setOrdersLoading(false)
      }
    }

    loadOrders()
    return () => controller.abort()
  }, [user])

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

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const updateCardField = (event) => {
    const { name, value } = event.target
    const nextValue =
      name === 'number'
        ? formatCardNumber(value)
        : name === 'expiry'
          ? formatExpiry(value)
          : value

    setCardForm((current) => ({ ...current, [name]: nextValue }))
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...form, savedCards }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to save your profile.')

      updateProfileState(body.user)
      setMessage('Your account details have been saved.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const persistCards = async (cards) => {
    const token = await user.getIdToken()
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...form, savedCards: cards }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Unable to save payment methods.')
    setSavedCards(cards)
    updateProfileState(body.user)
  }

  const addCard = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const last4 = cardForm.number.replace(/\D/g, '').slice(-4)
      if (last4.length !== 4) throw new Error('Enter at least four card-number digits.')
      const cards = [
        ...savedCards,
        {
          id: crypto.randomUUID(),
          nickname: cardForm.nickname.trim() || 'Payment card',
          cardholder: cardForm.cardholder.trim(),
          brand: cardForm.brand,
          last4,
          expiry: cardForm.expiry.trim(),
        },
      ]
      await persistCards(cards)
      setCardForm({ nickname: '', cardholder: '', brand: 'Visa', number: '', expiry: '' })
      setMessage('Payment method saved.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const removeCard = async (cardId) => {
    setError('')
    setMessage('')
    try {
      await persistCards(savedCards.filter((card) => card.id !== cardId))
      setMessage('Payment method removed.')
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  const cancelOrder = async (orderId) => {
    setError('')
    setMessage('')

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to cancel this order.')

      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === orderId ? { ...order, status: 'cancelled' } : order)),
      )
      setMessage('Your order has been cancelled.')
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  const startReview = (order, item) => {
    setError('')
    setMessage('')
    setReviewingItem({ item, orderId: order.id })
    setReviewForm({ body: '', rating: 5, title: '' })
  }

  const submitReview = async (event) => {
    event.preventDefault()
    if (!reviewingItem) return

    setError('')
    setMessage('')
    setSaving(true)

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/orders/${reviewingItem.orderId}/items/${reviewingItem.item.productId}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewForm),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to save your review.')

      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === body.order.id ? body.order : order)),
      )
      setReviewingItem(null)
      setReviewForm({ body: '', rating: 5, title: '' })
      setMessage('Thanks for reviewing your order.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const startReturn = (order) => {
    setError('')
    setMessage('')
    setReturningOrder(order)
    setReturnForm({ itemIndexes: [], notes: '', reason: returnReasons[0].value })
  }

  const submitReturnRequest = async (event) => {
    event.preventDefault()
    if (!returningOrder) return

    setError('')
    setMessage('')
    setSaving(true)

    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/orders/${returningOrder.id}/return`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(returnForm),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to submit the return request.')

      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === body.order.id ? body.order : order)),
      )
      setReturningOrder(null)
      setReturnForm({ itemIndexes: [], notes: '', reason: returnReasons[0].value })
      setMessage('Your return request has been sent to the admin team for refund review.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const sendReset = async () => {
    setError('')
    try {
      await sendPasswordResetEmail(auth, user.email)
      setResetSent(true)
    } catch (caughtError) {
      setError(caughtError.message || 'Unable to send the reset email.')
    }
  }

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><span className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></main>
  }

  if (!user) return <Navigate replace state={{ from: '/account' }} to="/login" />

  const currentSection = sections.find((section) => section.id === activeSection)
  const CurrentSectionIcon = currentSection.icon

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="page-container flex items-center py-5">
          <Link className="text-xl font-bold tracking-[-0.06em] text-[#11243e] sm:text-2xl" to="/">NORTHSTAR</Link>
          <div className="ml-auto flex items-center gap-2">
            <Link className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-700" to="/">
              <House size={18} /> <span className="hidden sm:inline">Home</span>
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-700" to="/cart">
            <ShoppingBag size={18} /> Cart
            </Link>
          </div>
        </div>
      </header>

      <div className="page-container py-10 sm:py-14">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-blue-100 text-xl font-bold text-blue-800">
            {(profile?.userName || profile?.displayName || profile?.email || 'U').charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold text-blue-700">My account</p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#11243e]">{profile?.userName || profile?.displayName || 'Your profile'}</h1>
            <p className="text-sm text-slate-500">{profile?.email}</p>
          </div>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-12">
          <aside className="lg:sticky lg:top-6">
            <label className="relative block lg:hidden">
              <span className="sr-only">Account section</span>
              <select
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-11 font-semibold text-[#11243e] outline-none"
                onChange={(event) => setSearchParams({ section: event.target.value })}
                value={activeSection}
              >
                {sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </label>
            {profile?.isAdmin && (
              <Link className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-blue-700 lg:hidden" to="/admin">
                <ClipboardList size={18} /> Admin board
              </Link>
            )}
            {hasSellerShop && (
              <Link className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-emerald-700 lg:hidden" to="/seller">
                <Store size={18} /> My shop
              </Link>
            )}

            <nav className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 lg:block">
              {sections.map(({ id, icon: Icon, label }) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === id ? 'bg-[#11243e] text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[#11243e]'
                  }`}
                  key={id}
                  onClick={() => setSearchParams({ section: id })}
                  type="button"
                >
                  <Icon size={18} /> {label}
                </button>
              ))}
              {profile?.isAdmin && (
                <Link className="mt-2 flex w-full items-center gap-3 border-t border-slate-100 px-4 py-4 text-left text-sm font-semibold text-blue-700" to="/admin">
                  <ClipboardList size={18} /> Admin board
                </Link>
              )}
              {hasSellerShop && (
                <Link className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-4 text-left text-sm font-semibold text-emerald-700" to="/seller">
                  <Store size={18} /> My shop
                </Link>
              )}
              <button className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-4 text-left text-sm font-semibold text-rose-700" onClick={logout} type="button">
                <LogOut size={18} /> Sign out
              </button>
            </nav>
          </aside>

          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-6">
              <span className="grid size-11 place-items-center rounded-full bg-blue-50 text-blue-700"><CurrentSectionIcon size={21} /></span>
              <div><h2 className="text-2xl font-semibold text-[#11243e]">{currentSection.label}</h2><p className="text-sm text-slate-500">{sectionDescription(activeSection)}</p></div>
            </div>

            {activeSection === 'information' && (
              <form className="mt-7" onSubmit={saveProfile}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" name="displayName" onChange={updateField} value={form.displayName} />
                  <Field
                    label="Preferred name"
                    name="userName"
                    onChange={updateField}
                    required={false}
                    value={form.userName}
                  />
                  <Field disabled label="Email" name="email" value={profile?.email || ''} />
                  <Field label="Phone" name="phone" onChange={updateField} value={form.phone} />
                  <div className="sm:col-span-2 mt-2 flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800"><House size={19} /><span>Save your address for future orders.</span></div>
                  <div className="sm:col-span-2"><Field label="Street address" name="address" onChange={updateField} value={form.address} /></div>
                  <Field label="City / Province" name="city" onChange={updateField} value={form.city} />
                  <Field label="Postal code" name="postalCode" onChange={updateField} required={false} value={form.postalCode} />
                  <div className="sm:col-span-2"><Field label="Country" name="country" onChange={updateField} value={form.country} /></div>
                </div>
                <SaveButton saving={saving} />
              </form>
            )}

            {activeSection === 'payment' && (
              <div className="mt-7">
                <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Mock payment methods only. Full card numbers and security codes are never stored.
                </div>
                {savedCards.length > 0 && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {savedCards.map((card) => (
                      <article className="rounded-2xl bg-[#11243e] p-5 text-white shadow-sm" key={card.id}>
                        <div className="flex items-start justify-between gap-4">
                          <div><p className="text-xs uppercase tracking-wider text-blue-200">{card.nickname}</p><p className="mt-5 text-xl tracking-[0.18em]">•••• {card.last4}</p></div>
                          <CreditCard size={23} />
                        </div>
                        <div className="mt-7 flex justify-between gap-4 text-xs">
                          <div><p className="text-blue-200">Cardholder</p><p className="mt-1 font-semibold">{card.cardholder}</p></div>
                          <div className="text-right"><p className="text-blue-200">{card.brand}</p><p className="mt-1 font-semibold">{card.expiry}</p></div>
                        </div>
                        <button className="mt-5 text-xs font-semibold text-rose-200 hover:text-white" onClick={() => removeCard(card.id)} type="button">Remove card</button>
                      </article>
                    ))}
                  </div>
                )}
                <form className="mt-8 border-t border-slate-200 pt-7" onSubmit={addCard}>
                  <h3 className="font-semibold text-[#11243e]">Add a card</h3>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Field label="Card nickname" name="nickname" onChange={updateCardField} placeholder="Personal card" value={cardForm.nickname} />
                    <Field label="Cardholder name" name="cardholder" onChange={updateCardField} value={cardForm.cardholder} />
                    <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Type</span><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none" onChange={(event) => setCardForm((current) => ({ ...current, brand: event.target.value }))} value={cardForm.brand}><option>Visa</option><option>Mastercard</option><option>American Express</option><option>Other</option></select></label>
                    <Field inputMode="numeric" label="Expiry" name="expiry" onChange={updateCardField} placeholder="MM / YY" value={cardForm.expiry} />
                    <div className="sm:col-span-2"><Field inputMode="numeric" label="Mock card number" name="number" onChange={updateCardField} placeholder="4242 4242 4242 4242" value={cardForm.number} /></div>
                  </div>
                  <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#11243e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit"><CreditCard size={17} />Save card</button>
                </form>
              </div>
            )}

            {activeSection === 'orders' && (
              <div className="mt-7">
                {ordersLoading ? (
                  <div className="grid min-h-56 place-items-center"><span className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" /></div>
                ) : orders.length === 0 ? (
                  <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
                    <div><Package className="mx-auto text-slate-400" size={30} /><h3 className="mt-4 font-semibold text-[#11243e]">No orders yet</h3><p className="mt-1 text-sm text-slate-500">Completed orders will appear here.</p><Link className="mt-5 inline-flex font-semibold text-blue-700" to="/">Start shopping</Link></div>
                  </div>
                ) : (
                  <OrdersTabs
                    activeGroup={activeOrderGroup}
                    groups={groupedOrders}
                    onCancel={cancelOrder}
                    onReturn={startReturn}
                    onReview={startReview}
                    onTabChange={setActiveOrderTab}
                  />
                )}
              </div>
            )}

            {reviewingItem && (
              <ReviewDialog
                form={reviewForm}
                item={reviewingItem.item}
                onChange={setReviewForm}
                onClose={() => setReviewingItem(null)}
                onSubmit={submitReview}
                saving={saving}
              />
            )}

            {returningOrder && (
              <ReturnRequestDialog
                form={returnForm}
                onChange={setReturnForm}
                onClose={() => setReturningOrder(null)}
                onSubmit={submitReturnRequest}
                order={returningOrder}
                saving={saving}
              />
            )}

            {activeSection === 'security' && (
              <div className="mt-7">
                <div className="flex items-start gap-4 rounded-2xl border border-slate-200 p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><KeyRound size={20} /></span>
                  <div className="min-w-0 flex-1"><h3 className="font-semibold text-[#11243e]">Password</h3><p className="mt-1 text-sm leading-6 text-slate-500">Firebase will email a secure password-reset link to {user.email}.</p><button className="mt-4 rounded-full bg-[#11243e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={resetSent} onClick={sendReset} type="button">{resetSent ? 'Reset email sent' : 'Send reset email'}</button></div>
                </div>
                <div className="mt-5 flex items-start gap-4 rounded-2xl border border-slate-200 p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck size={20} /></span>
                  <div><h3 className="font-semibold text-[#11243e]">Account protection</h3><p className="mt-1 text-sm leading-6 text-slate-500">Your session and API requests are protected using Firebase ID tokens.</p></div>
                </div>
              </div>
            )}

            {(message || error) && <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`} role="status">{error || message}</p>}
          </section>
        </div>
      </div>
    </main>
  )
}

function Field({ label, ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-500" required {...props} /></label>
}

function SaveButton({ saving }) {
  return <button className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#11243e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit"><Save size={17} />{saving ? 'Saving…' : 'Save changes'}</button>
}

function OrdersTabs({ activeGroup, groups, onCancel, onReturn, onReview, onTabChange }) {
  return (
    <section>
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl bg-slate-100 p-1">
          {groups.map((group) => (
            <button
              className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeGroup.id === group.id
                  ? 'bg-white text-[#11243e] shadow-sm'
                  : 'text-slate-500 hover:bg-white/70 hover:text-[#11243e]'
              }`}
              key={group.id}
              onClick={() => onTabChange(group.id)}
              type="button"
            >
              {group.title}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                activeGroup.id === group.id ? 'bg-blue-50 text-blue-700' : 'bg-white text-slate-500'
              }`}>
                {group.orders.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeGroup.orders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No orders in this status.</div>
      ) : (
        <div className="mt-5 space-y-4">
          {activeGroup.orders.map((order) => <OrderCard key={order.id} onCancel={onCancel} onReturn={onReturn} onReview={onReview} order={order} />)}
        </div>
      )}
    </section>
  )
}

function OrderCard({ onCancel, onReturn, onReview, order }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const createdAt = order.createdAt?._seconds ? new Date(order.createdAt._seconds * 1000) : null
  const canCancel = ['confirmed', 'packing'].includes(order.status)
  const canReview = order.status === 'delivered'
  const canRequestReturn = order.status === 'delivered' && !order.returnRequest
  const totals = order.totals || {}
  return (
    <article className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order {order.id}</p><p className="mt-1 text-sm text-slate-500">{createdAt ? createdAt.toLocaleDateString() : 'Processing date'}</p></div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">{order.status}</span>
      </div>
      <div className="mt-4 space-y-3">
        {order.items?.map((item, index) => (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm" key={`${item.productId}-${index}`}>
            <span className="text-slate-600">
              {item.quantity}x{' '}
              <Link className="font-semibold text-[#11243e] hover:text-blue-700" to={`/products/${item.productId}`}>
                {item.name}
              </Link>
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              {canReview && (
                item.reviewed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Star className="fill-emerald-600" size={13} /> Reviewed
                  </span>
                ) : (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    onClick={() => onReview(order, item)}
                    type="button"
                  >
                    <Star size={13} /> Rate item
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="font-semibold text-[#11243e]">Total</span>
        <span className="font-semibold text-[#11243e]">${Number(totals.total || 0).toFixed(2)}</span>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          onClick={() => setDetailsOpen((open) => !open)}
          type="button"
        >
          <ChevronDown className={`transition ${detailsOpen ? 'rotate-180' : ''}`} size={16} />
          {detailsOpen ? 'Hide details' : 'Details'}
        </button>
        {canCancel && (
          <button className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100" onClick={() => onCancel(order.id)} type="button">
            <XCircle size={16} /> Cancel order
          </button>
        )}
        {canRequestReturn && (
          <button className="inline-flex items-center gap-2 rounded-full bg-[#11243e] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900" onClick={() => onReturn(order)} type="button">
            Request return
          </button>
        )}
      </div>
      {order.returnRequest && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-[#11243e]">Return request</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${returnStatusStyle(order.returnRequest.status)}`}>
              {formatReturnStatus(order.returnRequest.status)}
            </span>
          </div>
          <p className={`mt-3 rounded-xl px-4 py-3 font-medium ${returnOutcomeStyle(order.returnRequest.status)}`}>
            {returnOutcomeMessage(order.returnRequest.status)}
          </p>
          {order.returnRequest.items?.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Requested items</p>
              {order.returnRequest.items.map((item) => (
                <p className="text-slate-600" key={`${item.productId}-${item.itemIndex}`}>
                  {item.quantity}x {item.name}{[item.color, item.size].filter(Boolean).length > 0 ? ` (${[item.color, item.size].filter(Boolean).join(' / ')})` : ''}
                </p>
              ))}
            </div>
          )}
          <p className="mt-3 font-medium text-[#11243e]">{order.returnRequest.reasonLabel}</p>
          {order.returnRequest.notes && <p className="mt-2 leading-6 text-slate-600">{order.returnRequest.notes}</p>}
          {order.returnRequest.adminNotes && <p className="mt-3 border-t border-slate-200 pt-3 leading-6 text-slate-600">Review note: {order.returnRequest.adminNotes}</p>}
        </div>
      )}
      {detailsOpen && (
        <dl className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
          <OrderTotalRow label="Subtotal" value={totals.subtotal} />
          <OrderTotalRow label="Discount" negative value={totals.couponDiscount || 0} />
          <OrderTotalRow label="Shipping fee" value={totals.shipping} />
          <OrderTotalRow label="Tax" value={totals.tax} />
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-semibold text-[#11243e]">
            <dt>Total</dt>
            <dd>${Number(totals.total || 0).toFixed(2)}</dd>
          </div>
        </dl>
      )}
    </article>
  )
}

function OrderTotalRow({ label, negative, value }) {
  const amount = Number(value || 0)
  const display = negative && amount > 0 ? `-$${amount.toFixed(2)}` : `$${amount.toFixed(2)}`

  return (
    <div className="flex justify-between gap-4 text-slate-600">
      <dt>{label}</dt>
      <dd className={negative && amount > 0 ? 'font-medium text-emerald-700' : 'font-medium'}>{display}</dd>
    </div>
  )
}

function ReturnRequestDialog({ form, onChange, onClose, onSubmit, order, saving }) {
  const toggleItem = (itemIndex) => {
    onChange((current) => ({
      ...current,
      itemIndexes: current.itemIndexes.includes(itemIndex)
        ? current.itemIndexes.filter((index) => index !== itemIndex)
        : [...current.itemIndexes, itemIndex],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 px-5 py-8">
      <form className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-7" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Returns center</p>
            <h3 className="mt-1 text-2xl font-semibold text-[#11243e]">Request a return</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Select the item or items you want reviewed. An admin will confirm eligibility before any refund is processed.</p>
          </div>
          <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button">
            <XCircle size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 sm:grid-cols-[auto_1fr]">
          <span className="grid size-10 place-items-center rounded-full bg-white text-blue-700">
            <PackageCheck size={19} />
          </span>
          <div>
            <p className="font-semibold">Order {order.id}</p>
            <p className="mt-1 leading-6 text-blue-800">Return approval depends on item condition, reason, and order history.</p>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 block text-sm font-semibold text-slate-700">Select items for return review</legend>
          <div className="space-y-2">
            {order.items?.map((item, index) => (
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition ${form.itemIndexes.includes(index) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`} key={`${item.productId}-${index}`}>
                <input
                  checked={form.itemIndexes.includes(index)}
                  className="mt-1 size-4 accent-blue-700"
                  onChange={() => toggleItem(index)}
                  type="checkbox"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[#11243e]">{item.quantity}x {item.name}</span>
                  {(item.color || item.size) && <span className="mt-1 block text-xs text-slate-500">{[item.color, item.size].filter(Boolean).join(' / ')}</span>}
                </span>
                <span className="shrink-0 font-semibold text-[#11243e]">${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Return reason</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            onChange={(event) => onChange((current) => ({ ...current, reason: event.target.value }))}
            value={form.reason}
          >
            {returnReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
          </select>
        </label>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Notes for review</span>
          <textarea
            className="min-h-32 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Include condition, packaging, photos available, or anything else the admin should know."
            required={form.reason === 'other'}
            value={form.notes}
          />
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose} type="button">Cancel</button>
          <button className="rounded-full bg-[#11243e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || form.itemIndexes.length === 0} type="submit">
            {saving ? 'Submitting...' : 'Send for review'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ReviewDialog({ form, item, onChange, onClose, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-5">
      <form className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Rate your item</p>
            <h3 className="mt-1 text-2xl font-semibold text-[#11243e]">{item.name}</h3>
          </div>
          <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button">
            <XCircle size={20} />
          </button>
        </div>

        <div className="mt-6">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Rating</span>
          <StarRating
            onChange={(rating) => onChange((current) => ({ ...current, rating }))}
            value={form.rating}
          />
        </div>

        <div className="mt-5">
          <Field
            label="Review title"
            onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
            value={form.title}
          />
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Your review</span>
          <textarea
            className="min-h-32 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            onChange={(event) => onChange((current) => ({ ...current, body: event.target.value }))}
            required
            value={form.body}
          />
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose} type="button">Cancel</button>
          <button className="inline-flex items-center gap-2 rounded-full bg-[#11243e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">
            <Star size={16} /> {saving ? 'Saving...' : 'Submit review'}
          </button>
        </div>
      </form>
    </div>
  )
}

function StarRating({ onChange, value }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          className="rounded-full p-1 text-blue-600 hover:bg-blue-50"
          key={rating}
          onClick={() => onChange(rating)}
          type="button"
        >
          <Star className={rating <= value ? 'fill-blue-600' : 'fill-slate-200 text-slate-200'} size={28} />
        </button>
      ))}
    </div>
  )
}

function formatReturnStatus(status) {
  return {
    approved: 'Refund initialized',
    declined: 'Refund not approved',
    pending_review: 'Under review',
  }[status] || 'Under review'
}

function returnStatusStyle(status) {
  return {
    approved: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-rose-50 text-rose-700',
    pending_review: 'bg-blue-50 text-blue-700',
  }[status] || 'bg-blue-50 text-blue-700'
}

function returnOutcomeMessage(status) {
  return {
    approved: 'Your return was approved. A refund has been initialized and will be processed according to the payment method used for this order.',
    declined: "Your return isn't qualified for a refund.",
    pending_review: 'Your return request is under admin review.',
  }[status] || 'Your return request is under admin review.'
}

function returnOutcomeStyle(status) {
  return {
    approved: 'bg-emerald-50 text-emerald-800',
    declined: 'bg-rose-50 text-rose-700',
    pending_review: 'bg-blue-50 text-blue-800',
  }[status] || 'bg-blue-50 text-blue-800'
}

function sectionDescription(section) {
  return { information: 'Manage personal and delivery details.', orders: 'Review your purchase history.', payment: 'Manage mock saved payment methods.', security: 'Protect and recover your account.' }[section]
}

export default AccountPage
