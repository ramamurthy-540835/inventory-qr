export type Category = { id: string; name: string; imageUrl?: string; active: boolean };
export type Product = { id: string; name: string; brand: string; categoryId: string; imageUrl?: string; mrp: number; price: number; unit: string; stock: number; rating?: number };
export type CartLine = Product & { quantity: number };
export type Customer = { customer_id: string; customer_name: string; phone_number?: string; email?: string; address?: string; postal_code?: string; city?: string; state?: string };
