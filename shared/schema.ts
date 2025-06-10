import { pgTable, text, integer, decimal, timestamp, boolean, uuid, jsonb, varchar, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users and Authentication
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: text('password').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  role: varchar('role', { length: 50 }).notNull().default('staff'), // admin, manager, staff
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Suppliers
export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  balance: decimal('balance', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Categories
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  mpn: varchar('mpn', { length: 100 }),
  sku: varchar('sku', { length: 100 }),
  upc: varchar('upc', { length: 100 }),
  categoryId: uuid('category_id').references(() => categories.id),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 12, scale: 2 }).notNull(),
  stock: integer('stock').default(0),
  minStock: integer('min_stock').default(0),
  image: text('image'),
  isActive: boolean('is_active').default(true),
  hasVariants: boolean('has_variants').default(false),
  warrantyMonths: integer('warranty_months').default(0),
  openCartSync: boolean('opencart_sync').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product Variants
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  upc: varchar('upc', { length: 100 }),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 12, scale: 2 }).notNull(),
  stock: integer('stock').default(0),
  attributes: jsonb('attributes'), // color, size, etc.
  createdAt: timestamp('created_at').defaultNow(),
});

// Serial Numbers
export const serialNumbers = pgTable('serial_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  serialNumber: varchar('serial_number', { length: 255 }).unique().notNull(),
  status: varchar('status', { length: 50 }).default('available'), // available, sold, rma
  purchaseId: uuid('purchase_id'),
  saleId: uuid('sale_id'),
  customerId: uuid('customer_id'),
  warrantyExpiry: timestamp('warranty_expiry'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Customers
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  totalSpent: decimal('total_spent', { precision: 12, scale: 2 }).default('0'),
  loyaltyPoints: integer('loyalty_points').default(0),
  lastPurchase: timestamp('last_purchase'),
  customPricing: jsonb('custom_pricing'), // product-specific pricing
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Sales
export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: varchar('invoice_number', { length: 100 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  userId: uuid('user_id').references(() => users.id),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 12, scale: 2 }).default('0'),
  tax: decimal('tax', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  profit: decimal('profit', { precision: 12, scale: 2 }).default('0'),
  status: varchar('status', { length: 50 }).default('completed'),
  paymentStatus: varchar('payment_status', { length: 50 }).default('paid'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sale Items
export const saleItems = pgTable('sale_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  saleId: uuid('sale_id').references(() => sales.id),
  productId: uuid('product_id').references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  serialNumber: varchar('serial_number', { length: 255 }),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  profit: decimal('profit', { precision: 12, scale: 2 }).notNull(),
});

// Payments
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  saleId: uuid('sale_id').references(() => sales.id),
  method: varchar('method', { length: 50 }).notNull(), // cash, bkash, nagad, bank
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 255 }),
  cashGiven: decimal('cash_given', { precision: 12, scale: 2 }),
  change: decimal('change', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Purchases
export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  userId: uuid('user_id').references(() => users.id),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  paid: decimal('paid', { precision: 12, scale: 2 }).default('0'),
  balance: decimal('balance', { precision: 12, scale: 2 }).default('0'),
  status: varchar('status', { length: 50 }).default('pending'),
  documents: jsonb('documents'), // attached files
  createdAt: timestamp('created_at').defaultNow(),
});

// Purchase Items
export const purchaseItems = pgTable('purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').references(() => purchases.id),
  productId: uuid('product_id').references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  unitCost: decimal('unit_cost', { precision: 12, scale: 2 }).notNull(),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  serialNumbers: jsonb('serial_numbers'), // array of serial numbers
});

// Quotations
export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteNumber: varchar('quote_number', { length: 100 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  userId: uuid('user_id').references(() => users.id),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 12, scale: 2 }).default('0'),
  tax: decimal('tax', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('draft'), // draft, sent, approved, expired, converted
  expiryDate: timestamp('expiry_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Quote Items
export const quoteItems = pgTable('quote_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').references(() => quotations.id),
  productId: uuid('product_id').references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  isOptional: boolean('is_optional').default(false),
});

// RMA (Returns)
export const rmas = pgTable('rmas', {
  id: uuid('id').primaryKey().defaultRandom(),
  rmaNumber: varchar('rma_number', { length: 100 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  saleId: uuid('sale_id').references(() => sales.id),
  productId: uuid('product_id').references(() => products.id),
  serialNumber: varchar('serial_number', { length: 255 }),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 50 }).default('under_review'), // under_review, approved, repaired, returned, rejected
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Offers and Promotions
export const offers = pgTable('offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // combo, bogo, discount, free_item
  conditions: jsonb('conditions'), // purchase conditions
  rewards: jsonb('rewards'), // what customer gets
  isActive: boolean('is_active').default(true),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sales Targets
export const salesTargets = pgTable('sales_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  period: varchar('period', { length: 50 }).notNull(), // weekly, monthly
  target: decimal('target', { precision: 12, scale: 2 }).notNull(),
  achieved: decimal('achieved', { precision: 12, scale: 2 }).default('0'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// PC Builds
export const pcBuilds = pgTable('pc_builds', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  userId: uuid('user_id').references(() => users.id),
  components: jsonb('components'), // array of products with quantities
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('draft'), // draft, saved, purchased
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  purchases: many(purchases),
  quotations: many(quotations),
  targets: many(salesTargets),
  builds: many(pcBuilds),
  notifications: many(notifications),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  serialNumbers: many(serialNumbers),
  saleItems: many(saleItems),
  purchaseItems: many(purchaseItems),
  quoteItems: many(quoteItems),
  rmas: many(rmas),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
  quotations: many(quotations),
  rmas: many(rmas),
  builds: many(pcBuilds),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
  items: many(saleItems),
  payments: many(payments),
  rmas: many(rmas),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  user: one(users, {
    fields: [purchases.userId],
    references: [users.id],
  }),
  items: many(purchaseItems),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [quotations.userId],
    references: [users.id],
  }),
  items: many(quoteItems),
}));