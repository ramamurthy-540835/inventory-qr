import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronRight, Heart, Home, MapPin, Minus, PackageOpen, Plus, Search, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react';
import { endpoint, getCatalog } from './services/api';
import { payForCart } from './services/razorpay';
import type { CartLine, Customer, Product } from './types/commerce';

type Tab = 'home' | 'categories' | 'search' | 'orders' | 'account';
type LegalPage = 'privacy-policy' | 'terms-and-conditions' | 'shipping-policy' | 'refund-policy' | 'contact-us';
// Prices are stored in rupees and may include paise.  Showing the paise keeps
// the displayed line items and checkout total in agreement.
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const legalPages: Record<LegalPage, { title: string; sections: Array<{ heading: string; body: string }> }> = {
  'privacy-policy': { title: 'Privacy Policy', sections: [
    { heading: 'Information we collect', body: 'We collect the account, contact, delivery-address, order and payment-confirmation information needed to provide grocery ordering and delivery services. Payment card and UPI details are handled by Razorpay; Nelture does not store them.' },
    { heading: 'How we use information', body: 'We use your information to process orders, deliver purchases, provide customer support, prevent fraud and meet legal obligations. We do not sell personal information.' },
    { heading: 'Sharing and security', body: 'Information is shared only with service providers required to operate the service, including payment and delivery providers, or where required by law. We use reasonable safeguards to protect information.' },
    { heading: 'Your choices', body: 'You may ask to review, correct or delete your account information by contacting Nelture support, subject to legal record-keeping requirements.' },
  ] },
  'terms-and-conditions': { title: 'Terms and Conditions', sections: [
    { heading: 'Using Nelture', body: 'By using Nelture, you agree to provide accurate account and delivery information and to use the service only for lawful personal purchases.' },
    { heading: 'Products, prices and availability', body: 'Product availability, prices, delivery coverage and delivery charges may change. The final amount and applicable charges are shown before you complete payment.' },
    { heading: 'Orders and payments', body: 'An order is confirmed after successful payment and our acceptance of the order. Payments are processed securely by Razorpay using the payment method you choose.' },
    { heading: 'Changes to these terms', body: 'We may update these terms when the service changes. Continued use after an update means you accept the revised terms.' },
  ] },
  'shipping-policy': { title: 'Shipping and Delivery Policy', sections: [
    { heading: 'Delivery coverage', body: 'Nelture delivers only to serviceable locations shown during checkout. Please provide a complete, accurate delivery address and PIN code.' },
    { heading: 'Delivery charges and timing', body: 'Any delivery charge and the expected delivery schedule are shown at checkout before payment. Delivery times may vary because of product availability, weather, traffic and other operational conditions.' },
    { heading: 'Delivery of your order', body: 'Please be available to receive the order at the provided address. If an item is unavailable, Nelture may contact you about a substitute, partial fulfilment or refund.' },
  ] },
  'refund-policy': { title: 'Cancellation and Refund Policy', sections: [
    { heading: 'Cancellation', body: 'You may request cancellation before an order has been processed or dispatched. Contact support with your order details as soon as possible.' },
    { heading: 'Damaged, incorrect or missing items', body: 'If an item is damaged, incorrect or missing, contact Nelture support promptly with your order details and photographs where relevant. We will review the request and provide an appropriate replacement, credit or refund when eligible.' },
    { heading: 'Refund timing', body: 'Approved refunds are returned to the original payment method. The time taken for the credit to appear depends on your bank, card issuer or UPI provider.' },
    { heading: 'Non-returnable items', body: 'Perishable, opened or used products may not be eligible for return unless they were delivered damaged, incorrect or defective.' },
  ] },
  'contact-us': { title: 'Contact Us', sections: [
    { heading: 'Customer support', body: 'For help with an order, payment, delivery, cancellation or refund, email support@nelture.ai and include your name, registered mobile number and order details.' },
    { heading: 'Business name', body: 'Nelture.ai grocery service.' },
    { heading: 'Support hours', body: 'Our support team responds as soon as possible during normal business hours.' },
  ] },
};

function currentLegalPage(): LegalPage | null {
  const segment = window.location.pathname.replace(/^\/app\/?/, '').replace(/\/$/, '') as LegalPage;
  return segment in legalPages ? segment : null;
}

function App() {
  const legalPage = currentLegalPage();
  if (legalPage) return <LegalPageView page={legalPage} />;
  const [tab, setTab] = useState<Tab>('home');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>(() => JSON.parse(localStorage.getItem('nelture-cart') ?? '[]'));
  const [customer, setCustomer] = useState<Customer | null>(() => JSON.parse(localStorage.getItem('nelture-customer') ?? 'null'));
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);

  useEffect(() => { getCatalog().then(({ products: list }) => setProducts(list)).catch(() => setCatalogError('Your catalogue will appear here once it is configured.')).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (products.length) setCart(current => current.map(line => ({ ...line, imageUrl: products.find(product => product.id === line.id)?.imageUrl ?? line.imageUrl }))); }, [products]);
  useEffect(() => localStorage.setItem('nelture-cart', JSON.stringify(cart)), [cart]);
  const filtered = useMemo(() => products.filter(p => `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const add = (product: Product) => setCart(current => { const existing = current.find(line => line.id === product.id); return existing ? current.map(line => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { ...product, quantity: 1 }]; });
  const updateQuantity = (id: string, change: number) => setCart(current => current.flatMap(line => line.id === id ? (line.quantity + change > 0 ? [{ ...line, quantity: line.quantity + change }] : []) : [line]));
  const logout = async () => { await fetch(endpoint('/auth/logout'), { method: 'POST' }); localStorage.removeItem('nelture-customer'); window.location.assign('/grocery/'); };
  const chooseLocation = () => { if (!customer) window.location.assign('/grocery/register.html'); else setLocationOpen(true); };
  const saveLocation = (updated: Customer) => { setCustomer(updated); localStorage.setItem('nelture-customer', JSON.stringify(updated)); setLocationOpen(false); };

  return <div className="min-h-screen bg-[#f7faf6] pb-22 text-[#18251d]">
    <header className="sticky top-0 z-20 border-b border-[#e6ece2] bg-white/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <a className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight text-nelture-700" href="/grocery/"><img className="h-10 w-10 rounded-xl object-cover" src="/grocery/nelture-logo.png" alt="Nelture" /><span>Nelture<span className="text-[#9fc45f]">.ai</span></span></a>
        <button onClick={chooseLocation} className="hidden min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-nelture-50 sm:flex"><MapPin size={18} className="text-nelture-600" /><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivering to</span><span className="block truncate text-sm font-semibold">{customer?.city ? `${customer.city} · ${customer.postal_code}` : 'Choose your location'}</span></span></button>
        <label className="ml-auto flex h-11 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-xl bg-[#f4f7f2] px-3 focus-within:ring-2 focus-within:ring-nelture-500"><Search size={19} className="text-slate-500" /><input value={query} onFocus={() => setTab('search')} onChange={e => { setQuery(e.target.value); setTab('search'); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search groceries, brands and more" /></label>
        {customer ? <div className="hidden items-center gap-1 sm:flex"><button onClick={() => setTab('account')} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-nelture-700 hover:bg-nelture-50"><UserRound size={18}/><span className="max-w-24 truncate">Hi, {customer.customer_name.split(' ')[0]}</span></button><button onClick={logout} className="rounded-xl border border-nelture-600 px-3 py-2 text-xs font-bold text-nelture-700">Logout</button></div> : <a href="/grocery/login.html" className="hidden rounded-xl bg-nelture-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-nelture-700 sm:inline-flex">Sign in / Register</a>}
        <button aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-nelture-50"><Bell size={20}/></button>
        <button onClick={() => setTab('orders')} className="relative grid h-10 w-10 place-items-center rounded-xl bg-nelture-600 text-white"><ShoppingCart size={20}/>{cart.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#f59f2f] px-1 text-[10px] font-bold">{cart.reduce((count, line) => count + line.quantity, 0)}</span>}</button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-5 md:px-8">
      {tab === 'home' && <HomePage products={products} loading={loading} error={catalogError} onAdd={add} onBrowse={() => setTab('categories')} />}
      {tab === 'categories' && <Catalog products={products} loading={loading} onAdd={add} />}
      {tab === 'search' && <SearchResults products={filtered} query={query} onAdd={add} />}
      {tab === 'orders' && <Cart cart={cart} total={cartTotal} onChange={updateQuantity} onClear={() => setCart([])} />}
      {tab === 'account' && <Account customer={customer} />}
    </main>
    {locationOpen && customer && <LocationPicker customer={customer} onClose={() => setLocationOpen(false)} onSaved={saveLocation} />}
    <footer className="mx-auto mt-10 max-w-7xl border-t border-[#dce7d8] px-4 py-7 text-xs text-slate-600 md:px-8"><p className="font-bold text-nelture-700">Nelture.ai</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{(Object.keys(legalPages) as LegalPage[]).map(page => <a key={page} href={`/app/${page}`} className="underline decoration-slate-300 underline-offset-2 hover:text-nelture-700">{legalPages[page].title}</a>)}</div></footer>
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e6ece2] bg-white px-2 py-2 md:hidden"><div className="mx-auto flex max-w-lg justify-around">{([{ id: 'home', label: 'Home', icon: Home }, { id: 'categories', label: 'Categories', icon: PackageOpen }, { id: 'search', label: 'Search', icon: Search }, { id: 'orders', label: 'Cart', icon: ShoppingBag }, { id: 'account', label: 'Account', icon: UserRound }] as const).map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`grid min-w-14 place-items-center gap-1 text-[10px] font-semibold ${tab === item.id ? 'text-nelture-600' : 'text-slate-500'}`}><item.icon size={20}/>{item.label}</button>)}</div></nav>
  </div>;
}

function LegalPageView({ page }: { page: LegalPage }) {
  const content = legalPages[page];
  return <div className="min-h-screen bg-[#f7faf6] px-4 py-8 text-[#18251d] md:px-8"><main className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm md:p-10"><a href="/app/" className="text-sm font-bold text-nelture-700">← Back to Nelture.ai</a><p className="mt-7 text-xs font-bold uppercase tracking-[.16em] text-nelture-600">Nelture.ai grocery service</p><h1 className="mt-2 text-3xl font-black tracking-tight">{content.title}</h1><p className="mt-2 text-sm text-slate-500">Last updated: 3 September 2026</p><div className="mt-8 space-y-7">{content.sections.map(section => <section key={section.heading}><h2 className="text-lg font-black">{section.heading}</h2><p className="mt-2 text-sm leading-6 text-slate-700">{section.body}</p></section>)}</div></main></div>;
}

function HomePage({ products, loading, error, onAdd, onBrowse }: { products: Product[]; loading: boolean; error: string; onAdd: (p: Product) => void; onBrowse: () => void }) {
  return <div className="space-y-7"><section className="overflow-hidden rounded-3xl bg-gradient-to-br from-nelture-700 to-[#2b9953] p-6 text-white md:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#d7edbd]">Fresh groceries, thoughtfully delivered</p><h1 className="mt-3 max-w-xl text-3xl font-black tracking-tight md:text-5xl">Your everyday essentials, at your doorstep.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#e7f4de]">Set your location, explore the catalogue, and check out in a few easy steps.</p><button onClick={onBrowse} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-nelture-700">Explore groceries <ChevronRight size={17}/></button></section><SectionTitle title="Today’s essentials" action="Browse all" onAction={onBrowse}/><ProductStrip products={products.slice(0, 5)} loading={loading} emptyText={error || 'The catalogue is being prepared. Add products from the admin dashboard to start shopping.'} onAdd={onAdd}/><section className="rounded-3xl border border-[#dcedd6] bg-nelture-50 p-5"><div className="flex items-start gap-4"><div className="rounded-2xl bg-white p-3 text-nelture-600"><Heart size={23}/></div><div><p className="font-bold">Shopping that remembers you</p><p className="mt-1 text-sm text-slate-600">Sign in to save addresses, view orders and build your Buy Again list.</p><a href="/register" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-nelture-700">Create or access your account <ChevronRight size={16}/></a></div></div></section></div>;
}
function Catalog({ products, loading, onAdd }: { products: Product[]; loading: boolean; onAdd: (p: Product) => void }) { return <div><SectionTitle title="All groceries"/><ProductStrip products={products} loading={loading} emptyText="No products have been published yet. Your admin can add the catalogue, categories and prices when they are ready." onAdd={onAdd}/></div>; }
function SearchResults({ products, query, onAdd }: { products: Product[]; query: string; onAdd: (p: Product) => void }) { return <div><SectionTitle title={query ? `Results for “${query}”` : 'Search groceries'}/><ProductStrip products={products} emptyText={query ? 'No matching products yet.' : 'Start typing to find products, brands and categories.'} onAdd={onAdd}/></div>; }
function ProductStrip({ products, loading = false, emptyText, onAdd }: { products: Product[]; loading?: boolean; emptyText: string; onAdd: (p: Product) => void }) { if (loading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[1,2,3,4,5].map(x => <div key={x} className="h-72 animate-pulse rounded-2xl bg-white"/>)}</div>; if (!products.length) return <div className="rounded-3xl border border-dashed border-[#ccdbca] bg-white px-6 py-12 text-center"><PackageOpen className="mx-auto text-nelture-500" size={34}/><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">{emptyText}</p></div>; return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{products.map(product => <article key={product.id} className="rounded-2xl border border-[#e5ece2] bg-white p-3 shadow-sm"><div className="grid aspect-square place-items-center rounded-xl bg-[#f7faf6] text-xs text-slate-400">{product.imageUrl ? <img className="h-full w-full object-contain" src={product.imageUrl} alt={product.name}/> : 'Product image'}</div><p className="mt-3 truncate text-sm font-bold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.brand} · {product.unit}</p><div className="mt-3 flex items-end justify-between gap-2"><p className="text-sm font-black">{money.format(product.price)}</p><button onClick={() => onAdd(product)} className="rounded-lg border border-nelture-600 px-3 py-1.5 text-xs font-bold text-nelture-700">ADD</button></div></article>)}</div>; }
function Cart({ cart, total, onChange, onClear }: { cart: CartLine[]; total: number; onChange: (id: string, change: number) => void; onClear: () => void }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const checkout = async () => {
    const customer = JSON.parse(localStorage.getItem('nelture-customer') ?? 'null') as Customer | null;
    if (!customer) { window.location.assign('/grocery/login.html'); return; }
    setSubmitting(true); setMessage('');
    try {
      await payForCart(cart, async () => { const response = await fetch(endpoint('/checkout'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customer.customer_id, payment_status: 'PAID', items: cart.map(line => ({ productId: line.id, quantity: line.quantity })) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Payment was received but order creation failed.'); onClear(); setMessage(`Payment successful. ${result.orders.length} item(s) are being prepared.`); });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to place this order.'); }
    finally { setSubmitting(false); }
  };
  return <div><SectionTitle title="Your cart"/>{cart.length === 0 ? <div className="rounded-3xl bg-white p-12 text-center"><ShoppingBag className="mx-auto text-nelture-500" size={36}/><p className="mt-3 font-bold">Your cart is waiting</p><p className="mt-1 text-sm text-slate-500">{message || 'Add groceries from the catalogue to get started.'}</p></div> : <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="space-y-3">{cart.map(line => <div key={line.id} className="flex items-center gap-3 rounded-2xl bg-white p-4"><div className="grid h-15 w-15 shrink-0 place-items-center overflow-hidden rounded-xl bg-nelture-50 text-xs text-slate-400">{line.imageUrl ? <img src={line.imageUrl} alt={line.name} className="h-full w-full object-contain" /> : 'Item'}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{line.name}</p><p className="text-xs text-slate-500">{line.unit}</p><p className="mt-1 text-sm font-bold">{money.format(line.price)}</p></div><div className="flex items-center rounded-lg border border-nelture-600"><button onClick={() => onChange(line.id, -1)} className="p-2 text-nelture-700"><Minus size={15}/></button><span className="w-7 text-center text-sm font-bold">{line.quantity}</span><button onClick={() => onChange(line.id, 1)} className="p-2 text-nelture-700"><Plus size={15}/></button></div></div>)}</div><aside className="h-fit rounded-2xl bg-white p-5 shadow-sm"><p className="font-bold">Bill details</p><div className="mt-4 flex justify-between text-sm"><span>Item total</span><b>{money.format(total)}</b></div><div className="mt-2 flex justify-between text-sm"><span>Delivery</span><span className="text-nelture-600">Calculated at checkout</span></div><button onClick={checkout} disabled={submitting} className="mt-5 w-full rounded-xl bg-nelture-600 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? 'Placing order…' : 'Proceed to checkout'}</button>{message && <p className="mt-3 text-sm text-red-600">{message}</p>}</aside></div>}</div>;
}
function Account({ customer }: { customer: Customer | null }) { return <div className="mx-auto max-w-xl"><SectionTitle title="My account"/><div className="rounded-3xl bg-white p-6 shadow-sm"><UserRound className="text-nelture-600" size={32}/>{customer ? <><h2 className="mt-3 text-lg font-bold">{customer.customer_name}</h2><p className="mt-1 text-sm text-slate-600">Your unique Customer ID</p><p className="mt-2 inline-flex rounded-lg bg-nelture-50 px-3 py-2 font-mono text-sm font-black text-nelture-700">{customer.customer_id}</p><p className="mt-4 text-sm text-slate-600">Use this ID with your registered mobile number to sign in again.</p></> : <><h2 className="mt-3 text-lg font-bold">Welcome to Nelture</h2><p className="mt-1 text-sm text-slate-600">Create an account to save your delivery details, orders, addresses and preferences.</p><a href="/register" className="mt-5 inline-flex rounded-xl bg-nelture-600 px-4 py-3 text-sm font-bold text-white">Create account</a><a href="/login" className="ml-2 inline-flex rounded-xl border border-nelture-600 px-4 py-3 text-sm font-bold text-nelture-700">Sign in</a></>}</div></div>; }
function LocationPicker({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: (customer: Customer) => void }) {
  const [address, setAddress] = useState(customer.address || ''); const [postalCode, setPostalCode] = useState(customer.postal_code || ''); const [city, setCity] = useState(customer.city || 'Chennai'); const [state, setState] = useState(customer.state || 'Tamil Nadu'); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const currentLocation = () => { if (!navigator.geolocation) { setMessage('Location services are not available in this browser.'); return; } setMessage('Getting your current location…'); navigator.geolocation.getCurrentPosition(position => { setAddress(`Current GPS location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`); setMessage('Current GPS location added. Please confirm your PIN code and locality.'); }, () => setMessage('Location permission was not granted. Enter your address manually.'), { enableHighAccuracy: true, timeout: 10000 }); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); const response = await fetch(endpoint('/auth/location'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, postal_code: postalCode, city, state }) }); const data = await response.json(); if (!response.ok) { setMessage(data.error || 'Unable to save location.'); setSaving(false); return; } onSaved(data); };
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"><form onSubmit={save} className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"><div className="flex items-center justify-between"><div><p className="text-lg font-black">Delivery location</p><p className="mt-1 text-sm text-slate-500">Set where your groceries should arrive.</p></div><button type="button" onClick={onClose} className="text-sm font-bold text-slate-500">Close</button></div><button type="button" onClick={currentLocation} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-nelture-600 py-3 text-sm font-bold text-nelture-700"><MapPin size={18}/> Use current location</button><label className="mt-4 block text-xs font-bold">Address<textarea value={address} onChange={event => setAddress(event.target.value)} required className="mt-2 min-h-18 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-nelture-600" placeholder="House, street, locality"/></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">PIN code<input value={postalCode} onChange={event => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-nelture-600" placeholder="600040"/></label><label className="text-xs font-bold">City<input value={city} onChange={event => setCity(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-nelture-600"/></label></div><label className="mt-3 block text-xs font-bold">State<input value={state} onChange={event => setState(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-nelture-600"/></label>{message && <p className="mt-3 text-xs text-slate-600">{message}</p>}<button disabled={saving} className="mt-5 w-full rounded-xl bg-nelture-600 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save delivery location'}</button></form></div>;
}
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="flex items-center justify-between"><h2 className="text-xl font-black tracking-tight">{title}</h2>{action && <button onClick={onAction} className="text-sm font-bold text-nelture-700">{action}</button>}</div>; }
export default App;
