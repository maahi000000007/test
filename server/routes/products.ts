import express from 'express';
import { products, categories, productVariants, serialNumbers } from '../../shared/schema.js';
import { eq, like, or, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole } from './auth.js';

const router = express.Router();

// Get all products with search and filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, category, active, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = req.db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      mpn: products.mpn,
      sku: products.sku,
      upc: products.upc,
      categoryId: products.categoryId,
      costPrice: products.costPrice,
      sellingPrice: products.sellingPrice,
      stock: products.stock,
      minStock: products.minStock,
      image: products.image,
      isActive: products.isActive,
      hasVariants: products.hasVariants,
      warrantyMonths: products.warrantyMonths,
      openCartSync: products.openCartSync,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
      }
    }).from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt));
    
    // Apply filters
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.mpn, `%${search}%`),
          like(products.sku, `%${search}%`),
          like(products.upc, `%${search}%`)
        )
      );
    }
    
    if (category) {
      conditions.push(eq(products.categoryId, category as string));
    }
    
    if (active !== undefined) {
      conditions.push(eq(products.isActive, active === 'true'));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const result = await query.limit(Number(limit)).offset(offset);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID with variants and serial numbers
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await req.db.select().from(products).where(eq(products.id, id)).limit(1);
    
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get variants if product has variants
    let variants = [];
    if (product[0].hasVariants) {
      variants = await req.db.select().from(productVariants).where(eq(productVariants.productId, id));
    }
    
    // Get serial numbers
    const serials = await req.db.select().from(serialNumbers).where(eq(serialNumbers.productId, id));
    
    res.json({
      ...product[0],
      variants,
      serialNumbers: serials
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product
router.post('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const productData = req.body;
    
    const newProduct = await req.db.insert(products).values({
      ...productData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    res.status(201).json(newProduct[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;
    
    const updatedProduct = await req.db.update(products)
      .set({
        ...productData,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    
    if (updatedProduct.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(updatedProduct[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedProduct = await req.db.delete(products).where(eq(products.id, id)).returning();
    
    if (deletedProduct.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get categories
router.get('/categories/all', requireAuth, async (req, res) => {
  try {
    const allCategories = await req.db.select().from(categories);
    res.json(allCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category
router.post('/categories', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const newCategory = await req.db.insert(categories).values({
      name,
      description,
      createdAt: new Date(),
    }).returning();
    
    res.status(201).json(newCategory[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Add product variant
router.post('/:id/variants', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const variantData = req.body;
    
    const newVariant = await req.db.insert(productVariants).values({
      ...variantData,
      productId: id,
      createdAt: new Date(),
    }).returning();
    
    res.status(201).json(newVariant[0]);
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
});

// Add serial number
router.post('/:id/serials', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { serialNumber, variantId, warrantyMonths } = req.body;
    
    let warrantyExpiry = null;
    if (warrantyMonths && warrantyMonths > 0) {
      warrantyExpiry = new Date();
      warrantyExpiry.setMonth(warrantyExpiry.getMonth() + warrantyMonths);
    }
    
    const newSerial = await req.db.insert(serialNumbers).values({
      productId: id,
      variantId: variantId || null,
      serialNumber,
      status: 'available',
      warrantyExpiry,
      createdAt: new Date(),
    }).returning();
    
    res.status(201).json(newSerial[0]);
  } catch (error) {
    console.error('Error adding serial number:', error);
    res.status(500).json({ error: 'Failed to add serial number' });
  }
});

// Search products by barcode/serial
router.get('/search/barcode/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Search in products
    const productResults = await req.db.select().from(products)
      .where(or(
        eq(products.sku, code),
        eq(products.upc, code),
        eq(products.mpn, code)
      ));
    
    // Search in variants
    const variantResults = await req.db.select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      sku: productVariants.sku,
      upc: productVariants.upc,
      costPrice: productVariants.costPrice,
      sellingPrice: productVariants.sellingPrice,
      stock: productVariants.stock,
      attributes: productVariants.attributes,
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
      }
    }).from(productVariants)
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(or(
      eq(productVariants.sku, code),
      eq(productVariants.upc, code)
    ));
    
    // Search in serial numbers
    const serialResults = await req.db.select({
      id: serialNumbers.id,
      serialNumber: serialNumbers.serialNumber,
      status: serialNumbers.status,
      productId: serialNumbers.productId,
      variantId: serialNumbers.variantId,
      product: {
        id: products.id,
        name: products.name,
        costPrice: products.costPrice,
        sellingPrice: products.sellingPrice,
        image: products.image,
      }
    }).from(serialNumbers)
    .leftJoin(products, eq(serialNumbers.productId, products.id))
    .where(eq(serialNumbers.serialNumber, code));
    
    res.json({
      products: productResults,
      variants: variantResults,
      serials: serialResults
    });
  } catch (error) {
    console.error('Error searching by barcode:', error);
    res.status(500).json({ error: 'Failed to search by barcode' });
  }
});

export default router;