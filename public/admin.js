const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
let products = [];
const api = (path, options) => fetch(path, options).then(async response => { const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || 'Request failed'); return data; });
function render() {
  const query = document.querySelector('#search').value.toLowerCase();
  document.querySelector('#products').innerHTML = products.filter(product => product.name.toLowerCase().includes(query)).map(product => `<article class="product"><img src="${product.imageUrl || '/product-images/nelture-grocery-fallback.png'}" alt="${product.name}"><b>${product.name}</b><span class="muted">${product.brand || 'Nelture'} · ${product.unit}</span><div>Price <input data-price="${product.id}" type="number" value="${product.price}" step=".01"></div><div>Stock <input data-stock="${product.id}" type="number" value="${product.stock}"></div><button data-save="${product.id}">Save stock & price</button><button class="image-button" data-generate="${product.id}">Generate AI image</button><div class="product-actions"><button class="edit-button" data-edit="${product.id}">Edit</button><button class="delete-button" data-delete="${product.id}">Delete</button></div></article>`).join('');
}
async function load() {
  try {
    const [dashboard, catalog, orders] = await Promise.all([api('/admin/api/dashboard'), api('/admin/api/products'), api('/admin/api/orders')]);
    products = catalog;
    document.querySelector('#stats').innerHTML = [['Customers', dashboard.customers], ['Orders', dashboard.orders], ['Sales', money.format(dashboard.sales)], ['Products', dashboard.products], ['Low stock', dashboard.lowStock]].map(([label, value]) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`).join('');
    render();
    document.querySelector('#orders').innerHTML = orders.length ? orders.map(order => `<div class="order"><span>${order.order_id}</span><span>${order.customer_name || '—'}</span><span>${order.product_name}</span><span>${money.format(order.total_amount)}</span><span>${order.order_status}</span></div>`).join('') : '<p class="muted">No orders yet.</p>';
  } catch (error) { document.querySelector('main').innerHTML = `<section class="panel"><h2>Admin access required</h2><p class="muted">${error.message}</p></section>`; }
}
document.querySelector('#search').oninput = render;
document.querySelector('#products').onclick = async event => {
  const productId = event.target.dataset.save;
  if (productId) { const price = document.querySelector(`[data-price="${productId}"]`).value; const stock = document.querySelector(`[data-stock="${productId}"]`).value; await api(`/admin/api/products/${productId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: Number(price), stock: Number(stock) }) }); await load(); return; }
  const editId = event.target.dataset.edit;
  if (editId) { const product = products.find(item => item.id === editId); if (!product) return; openEditForm(product); return; }
  const generateId = event.target.dataset.generate;
  if (generateId) { const product = products.find(item => item.id === generateId); if (!product || !confirm(`Generate a new AI product image for ${product.name}?`)) return; const button = event.target; button.disabled = true; button.textContent = 'Generating image…'; try { await api(`/admin/api/products/${generateId}/generate-image`, { method: 'POST' }); await load(); } catch (error) { alert(error.message); button.disabled = false; button.textContent = 'Generate AI image'; } return; }
  const deleteId = event.target.dataset.delete;
  if (deleteId) { const product = products.find(item => item.id === deleteId); if (!product || !confirm(`Delete ${product.name}? This cannot be undone.`)) return; await api(`/admin/api/products/${deleteId}`, { method: 'DELETE' }); await load(); }
};
document.querySelector('#logout').onclick = async () => { await fetch('/admin/auth/logout', { method: 'POST' }); location = '/admin/login'; };
const productForm = document.querySelector('#product-form');
const formMessage = document.querySelector('#product-form-message');
let editingProductId = null;
const resetForm = () => { editingProductId = null; productForm.reset(); productForm.hidden = true; formMessage.textContent = ''; document.querySelector('#show-product-form').hidden = false; document.querySelector('#product-form-title').textContent = 'Add a product'; productForm.querySelector('[type="submit"]').textContent = 'Save product'; };
const showForm = () => { resetForm(); productForm.hidden = false; document.querySelector('#show-product-form').hidden = true; productForm.querySelector('[name="name"]').focus(); };
const openEditForm = product => { editingProductId = product.id; productForm.hidden = false; document.querySelector('#show-product-form').hidden = true; document.querySelector('#product-form-title').textContent = `Edit ${product.name}`; productForm.elements.name.value = product.name || ''; productForm.elements.brand.value = product.brand || ''; productForm.elements.unit.value = product.unit || ''; productForm.elements.price.value = product.price ?? ''; productForm.elements.mrp.value = product.mrp ?? ''; productForm.elements.stock.value = product.stock ?? 0; productForm.querySelector('[type="submit"]').textContent = 'Save changes'; productForm.querySelector('[name="name"]').focus(); };
document.querySelector('#show-product-form').onclick = showForm;
document.querySelector('#cancel-product-form').onclick = resetForm;
productForm.onsubmit = async event => {
  event.preventDefault(); formMessage.textContent = '';
  const submit = productForm.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Saving…';
  const values = Object.fromEntries(new FormData(productForm));
  if (values.mrp === '') delete values.mrp;
  try { await api(editingProductId ? `/admin/api/products/${editingProductId}` : '/admin/api/products', { method: editingProductId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); resetForm(); await load(); }
  catch (error) { formMessage.textContent = error.message; }
  finally { submit.disabled = false; submit.textContent = 'Save product'; }
};
load();
