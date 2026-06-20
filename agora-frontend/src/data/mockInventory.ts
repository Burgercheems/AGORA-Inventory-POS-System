import type { Category, Supplier, Product } from '../types/inventory';

// TODO: remove this file once GET /categories, /suppliers, /products are
// wired up via React Query. Kept here only so the UI has realistic data
// to render while the backend is still being built.

export const mockCategories: Category[] = [
  { id: 'cat-1', name: 'Beverages', description: 'Soft drinks, juices, water' },
  { id: 'cat-2', name: 'Snacks', description: 'Chips, biscuits, candies' },
  { id: 'cat-3', name: 'Canned Goods', description: 'Canned meat, fish, vegetables' },
  { id: 'cat-4', name: 'Personal Care', description: 'Soap, shampoo, toiletries' },
  { id: 'cat-5', name: 'Household', description: 'Cleaning and home supplies' },
];

export const mockSuppliers: Supplier[] = [
  { id: 'sup-1', name: 'Coca-Cola Philippines', contact: '+63 917 123 4567', address: 'Quezon City, Metro Manila' },
  { id: 'sup-2', name: 'Monde Nissin Corp.', contact: '+63 917 234 5678', address: 'Marikina City, Metro Manila' },
  { id: 'sup-3', name: 'Unilever Philippines', contact: '+63 917 345 6789', address: 'Taguig City, Metro Manila' },
  { id: 'sup-4', name: 'Local Wholesale Co.', contact: '+63 917 456 7890', address: 'Caloocan City, Metro Manila' },
];

export const mockProducts: Product[] = [
  { id: 'prod-1', name: 'Coke 1.5L', sku: 'BEV-COK-1500', barcode: '4801234567890', categoryId: 'cat-1', supplierId: 'sup-1', price: 75, status: 'active' },
  { id: 'prod-2', name: 'Sprite 1.5L', sku: 'BEV-SPR-1500', barcode: '4801234567891', categoryId: 'cat-1', supplierId: 'sup-1', price: 75, status: 'active' },
  { id: 'prod-3', name: 'Lucky Me Pancit Canton', sku: 'SNK-LMP-0080', barcode: '4801234567892', categoryId: 'cat-2', supplierId: 'sup-2', price: 16, status: 'active' },
  { id: 'prod-4', name: 'SkyFlakes Crackers', sku: 'SNK-SKY-0250', barcode: '4801234567893', categoryId: 'cat-2', supplierId: 'sup-2', price: 38, status: 'active' },
  { id: 'prod-5', name: 'Argentina Corned Beef 150g', sku: 'CAN-ARG-0150', barcode: '4801234567894', categoryId: 'cat-3', supplierId: 'sup-4', price: 45, status: 'active' },
  { id: 'prod-6', name: 'Century Tuna Flakes 155g', sku: 'CAN-CEN-0155', barcode: '4801234567895', categoryId: 'cat-3', supplierId: 'sup-4', price: 32, status: 'active' },
  { id: 'prod-7', name: 'Safeguard Soap 90g', sku: 'PC-SAF-0090', barcode: '4801234567896', categoryId: 'cat-4', supplierId: 'sup-3', price: 28, status: 'active' },
  { id: 'prod-8', name: 'Sunsilk Shampoo Sachet', sku: 'PC-SUN-0012', barcode: '4801234567897', categoryId: 'cat-4', supplierId: 'sup-3', price: 8, status: 'active' },
  { id: 'prod-9', name: 'Surf Powder Detergent 1kg', sku: 'HH-SUR-1000', barcode: '4801234567898', categoryId: 'cat-5', supplierId: 'sup-3', price: 95, status: 'inactive' },
  { id: 'prod-10', name: 'Joy Dishwashing Liquid 250ml', sku: 'HH-JOY-0250', barcode: '4801234567899', categoryId: 'cat-5', supplierId: 'sup-3', price: 42, status: 'active' },
];