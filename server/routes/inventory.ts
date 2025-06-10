import express from 'express';
import { products, serialNumbers, productVariants } from '../../shared/schema.js';
import { eq, lt, sql, and, or } from 'drizzle-orm';
import { requireAuth, requireRole } from './auth.js';

const router = express.Router();

// Get low stock items
router.get('/low-stock', requireAuth, async (req, res) => {
  try {
    const lowStockProducts = await req.db.select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stock: products.stock,
      minStock: products.minStock,
      costPrice: products.costPrice,
      sellingPrice: products.sellingPrice,
      image: products.image,
    }).from(products)
    .where(
      and(
        products.isActive,
        sql`${products.stock} <= ${products.minStock}`
      )
    );

    res.json(lowStockProducts);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Get inventory summary
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const summary = await req.db.select({
      totalProducts: sql`COUNT(*)`,
      totalValue: sql`SUM(${products.stock} * ${products.costPrice})`,
      lowStockCount: sql`COUNT(CASE WHEN ${products.stock} <= ${products.minStock} THEN 1 END)`,
      outOfStockCount: sql`COUNT(CASE WHEN ${products.stock} = 0 THEN 1 END)`,
    }).from(products)
    .where(products.isActive);

    res.json(summary[0]);
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

// Update stock levels
router.post('/adjust-stock', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { productId, variantId, adjustment, reason, notes } = req.body;

    if (variantId) {
      // Update variant stock
      await req.db.update(productVariants)
        .set({
          stock: sql`${productVariants.stock} + ${adjustment}`,
        })
        .where(eq(productVariants.id, variantId));
    } else {
      // Update product stock
      await req.db.update(products)
        .set({
          stock: sql`${products.stock} + ${adjustment}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));
    }

    // Log the adjustment (you might want to create a stock_adjustments table)
    // For now, we'll just return success

    res.json({ message: 'Stock adjusted successfully' });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Get serial numbers for a product
router.get('/serials/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { status } = req.query;

    let query = req.db.select().from(serialNumbers).where(eq(serialNumbers.productId, productId));

    if (status) {
      query = query.where(eq(serialNumbers.status, status as string));
    }

    const serials = await query;
    res.json(serials);
  } catch (error) {
    console.error('Error fetching serial numbers:', error);
    res.status(500).json({ error: 'Failed to fetch serial numbers' });
  }
});

// Add serial numbers
router.post('/serials', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { productId, variantId, serialNumbers: serials, warrantyMonths } = req.body;

    const serialData = serials.map((serial: string) => {
      let warrantyExpiry = null;
      if (warrantyMonths && warrantyMonths > 0) {
        warrantyExpiry = new Date();
        warrantyExpiry.setMonth(warrantyExpiry.getMonth() + warrantyMonths);
      }

      return {
        productId,
        variantId: variantId || null,
        serialNumber: serial,
        status: 'available',
        warrantyExpiry,
        createdAt: new Date(),
      };
    });

    const newSerials = await req.db.insert(serialNumbers).values(serialData).returning();

    res.status(201).json(newSerials);
  } catch (error) {
    console.error('Error adding serial numbers:', error);
    res.status(500).json({ error: 'Failed to add serial numbers' });
  }
});

// Update serial number status
router.put('/serials/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, customerId, saleId } = req.body;

    const updatedSerial = await req.db.update(serialNumbers)
      .set({
        status,
        customerId: customerId || null,
        saleId: saleId || null,
      })
      .where(eq(serialNumbers.id, id))
      .returning();

    if (updatedSerial.length === 0) {
      return res.status(404).json({ error: 'Serial number not found' });
    }

    res.json(updatedSerial[0]);
  } catch (error) {
    console.error('Error updating serial number:', error);
    res.status(500).json({ error: 'Failed to update serial number' });
  }
});

// Get warranty expiring items
router.get('/warranty-expiring', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Number(days));

    const expiringWarranties = await req.db.select({
      id: serialNumbers.id,
      serialNumber: serialNumbers.serialNumber,
      warrantyExpiry: serialNumbers.warrantyExpiry,
      customerId: serialNumbers.customerId,
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
      }
    }).from(serialNumbers)
    .leftJoin(products, eq(serialNumbers.productId, products.id))
    .where(
      and(
        eq(serialNumbers.status, 'sold'),
        sql`${serialNumbers.warrantyExpiry} <= ${expiryDate}`,
        sql`${serialNumbers.warrantyExpiry} > NOW()`
      )
    );

    res.json(expiringWarranties);
  } catch (error) {
    console.error('Error fetching warranty expiring items:', error);
    res.status(500).json({ error: 'Failed to fetch warranty expiring items' });
  }
});

// Get stock movement report
router.get('/movements', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;

    // This would typically come from a stock_movements table
    // For now, we'll return a placeholder response
    const movements = [];

    res.json(movements);
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

export default router;