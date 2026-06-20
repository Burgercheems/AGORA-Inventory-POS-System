export type ProductStatus = 'active' | 'inactive';

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  supplierId: string;
  price: number;
  status: ProductStatus;
  description?: string;
}