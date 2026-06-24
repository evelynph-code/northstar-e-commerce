import { useEffect, useState } from 'react'
import {
  ChevronDown,
  CircleUserRound,
  CreditCard,
  House,
  KeyRound,
  LogOut,
  Package,
  Save,
  ShieldCheck,
  ShoppingBag,
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
  const [savedCards, setSavedCards] = useState([])
  const [cardForm, setCardForm] = useState({
    nickname: '',
    cardholder: '',
    brand: 'Visa',
    number: '',
    expiry: '',
  })

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

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
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
              <button className="mt-2 flex w-full items-center gap-3 border-t border-slate-100 px-4 py-4 text-left text-sm font-semibold text-rose-700" onClick={logout} type="button">
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
                  <Field label="Postal code" name="postalCode" onChange={updateField} value={form.postalCode} />
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
                    <Field label="Card nickname" onChange={(event) => setCardForm((current) => ({ ...current, nickname: event.target.value }))} placeholder="Personal card" value={cardForm.nickname} />
                    <Field label="Cardholder name" onChange={(event) => setCardForm((current) => ({ ...current, cardholder: event.target.value }))} value={cardForm.cardholder} />
                    <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Type</span><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none" onChange={(event) => setCardForm((current) => ({ ...current, brand: event.target.value }))} value={cardForm.brand}><option>Visa</option><option>Mastercard</option><option>American Express</option><option>Other</option></select></label>
                    <Field label="Expiry" onChange={(event) => setCardForm((current) => ({ ...current, expiry: event.target.value }))} placeholder="MM / YY" value={cardForm.expiry} />
                    <div className="sm:col-span-2"><Field label="Mock card number" onChange={(event) => setCardForm((current) => ({ ...current, number: event.target.value }))} placeholder="**** **** **** ****" value={cardForm.number} /></div>
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
                  <div className="space-y-4">
                    {orders.map((order) => <OrderCard key={order.id} order={order} />)}
                  </div>
                )}
              </div>
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

function OrderCard({ order }) {
  const createdAt = order.createdAt?._seconds ? new Date(order.createdAt._seconds * 1000) : null
  return (
    <article className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order {order.id}</p><p className="mt-1 text-sm text-slate-500">{createdAt ? createdAt.toLocaleDateString() : 'Processing date'}</p></div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">{order.status}</span>
      </div>
      <div className="mt-4 space-y-2">{order.items?.map((item, index) => <div className="flex justify-between gap-4 text-sm" key={`${item.productId}-${index}`}><span className="text-slate-600">{item.quantity}× {item.name}</span><span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span></div>)}</div>
      <div className="mt-4 flex justify-between border-t border-slate-100 pt-4"><span className="font-semibold text-[#11243e]">Total</span><span className="font-semibold text-[#11243e]">${order.totals?.total?.toFixed(2)}</span></div>
    </article>
  )
}

function sectionDescription(section) {
  return { information: 'Manage personal and delivery details.', orders: 'Review your purchase history.', payment: 'Manage mock saved payment methods.', security: 'Protect and recover your account.' }[section]
}

export default AccountPage
