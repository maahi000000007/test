import express from 'express';
import { purchases, purchaseItems, suppliers, products, users } from '../../shared/schema.js';
import { eq, desc, sum, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from './auth.js';

const router = express.Router();

// Get all purchases
router.get('/', requireAuth, async (req, res) => {
  try {
    const { supplierId, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = req.db.select({
      id: purchases.id,
      supplierId: purchases.supplierId,
      userId: purchases.userId,
      invoiceNumber: purchases.invoiceNumber,
      total: purchases.total,
      paid: purchases.paid,
      balance: purchases.balance,
      status: purchases.status,
      createdAt: purchases.createdAt,
      supplier: {
        id: suppliers.id,
        name: suppliers.name,
      },
      user: {
        id: users.id,
        name: users.name,
      }
    }).from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .leftJoin(users, eq(purchases.userId, users.id))
    .orderBy(desc(purchases.createdAt));

    if (supplierId) {
      query = query.where(eq(purchases.supplierId, supplierId as string));
    }

    if (status) {
      query = query.where(eq(purchases.status, status as string));
    }

    const result = await query.limit(Number(limit)).offset(offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// Get purchase by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await req.db.select({
      id: purchases.id,
      supplierId: purchases.supplierId,
      userId: purchases.userId,
      invoiceNumber: purchases.invoiceNumber,
      total: purchases.total,
      paid: purchases.paid,
      balance: purchases.balance,
      status: purchases.status,
      documents: purchases.documents,
      createdAt: purchases.createdAt,
      supplier: {
        id: suppliers.id,
        name: suppliers.name,
        email: suppliers.email,
        phone: suppliers.phone,
      },
      user: {
        id: users.id,
        name: users.name,
      }
    }).from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .leftJoin(users, eq(purchases.userId, users.id))
    .where(eq(purchases.id, id))
    .limit(1);

    if (purchase.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // Get purchase items
    const items = await req.db.select({
      id: purchaseItems.id,
      productId: purchaseItems.productId,
      variantId: purchaseItems.variantId,
      quantity: purchaseItems.quantity,
      unitCost: purchaseItems.unitCost,
      total: purchaseItems.total,
      serialNumbers: purchaseItems.serialNumbers,
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        mpn: products.mpn,
        sku: products.sku,
      }
    }).from(purchaseItems)
    .leftJoin(products, eq(purchaseItems.productId, products.id))
    .where(eq(purchaseItems.purchaseId, id));

    res.json({
      ...purchase[0],
      items
    });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
});

// Create purchase
router.post('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const {
      supplierId,
      invoiceNumber,
      items,
      documents
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Purchase items are required' });
    }

    // Calculate total
    let total = 0;
    for (const item of items) {
      total += Number(item.unitCost) * Number(item.quantity);
    }

    // Create purchase
    const newPurchase = await req.db.insert(purchases).values({
      supplierId,
      userId: (req.user as any).id,
      invoiceNumber,
      total: total.toString(),
      paid: '0',
      balance: total.toString(),
      status: 'pending',
      documents,
      createdAt: new Date(),
    }).returning();

    const purchaseId = newPurchase[0].id;

    // Create purchase items
    for (const item of items) {
      await req.db.insert(purchaseItems).values({
        purchaseId,
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        unitCost: item.unitCost.toString(),
        total: (Number(item.unitCost) * Number(item.quantity)).toString(),
        serialNumbers: item.serialNumbers || null,
      });

      // Update product stock and cost price
      await req.db.update(products)
        .set({
          stock: sql`${products.stock} + ${item.quantity}`,
          costPrice: item.unitCost.toString(),
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
    }

    res.status(201).json(newPurchase[0]);
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
});

// Update purchase
router.put('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paid, documents } = req.body;

    const purchase = await req.db.select().from(purchases).where(eq(purchases.id, id)).limit(1);

    if (purchase.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const updateData: any = {};
    
    if (status !== undefined) updateData.status = status;
    if (documents !== undefined) updateData.documents = documents;
    
    if (paid !== undefined) {
      updateData.paid = paid.toString();
      updateData.balance = (Number(purchase[0].total) - Number(paid)).toString();
    }

    const updatedPurchase = await req.db.update(purchases)
      .set(updateData)
      .where(eq(purchases.id, id))
      .returning();

    // Update supplier balance if payment is made
    if (paid !== undefined) {
      const paidAmount = Number(paid) - Number(purchase[0].paid);
      if (paidAmount !== 0) {
        await req.db.update(suppliers)
          .set({
            balance: sql`${suppliers.balance} - ${paidAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, purchase[0].supplierId));
      }
    }

    res.json(updatedPurchase[0]);
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ error: 'Failed to update purchase' });
  }
});

// Get purchase summary
router.get('/reports/summary', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = req.db.select({
      totalPurchases: sum(purchases.total),
      totalPaid: sum(purchases.paid),
      totalBalance: sum(purchases.balance),
      purchaseCount: sql`COUNT(*)`,
    }).from(purchases);

    if (startDate && endDate) {
      query = query.where(sql`${purchases.createdAt} BETWEEN ${new Date(startDate as string)} AND ${new Date(endDate as string)}`);
    }

    const summary = await query;
    res.json(summary[0]);
  } catch (error) {
    console.error('Error fetching purchase summary:', error);
    res.status(500).json({ error: 'Failed to fetch purchase summary' });
  }
});

export default router;