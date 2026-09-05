import type { Category, Customer, Product } from '../types/commerce';

const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '/grocery-api';
export const endpoint = (path: string) => `${apiBase}${path}`;

export async function registerCustomer(payload: Omit<Customer, 'customer_id'>): Promise<Customer> {
  const response = await fetch(endpoint('/customers'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Unable to create your account.');
  return data as Customer;
}

export async function getCatalog(): Promise<{ categories: Category[]; products: Product[] }> {
  const response = await fetch(endpoint('/api/catalog'));
  if (response.status === 404) return { categories: [], products: [] };
  if (!response.ok) throw new Error('Unable to load the catalogue.');
  const catalog = await response.json() as { categories: Category[]; products: Product[] };
  return { ...catalog, products: catalog.products.map(product => ({ ...product, imageUrl: product.imageUrl?.startsWith('/') ? endpoint(product.imageUrl) : product.imageUrl })) };
}
