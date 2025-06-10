import express from 'express';
import { suppliers, purchases } from '../../shared/schema.js';
import { eq, desc, sum, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from './auth.js';

const router = express.Router();

// Get all suppliers
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = req.db.select().from(suppliers).orderBy(desc(suppliers.createdAt));

    if (search) {
      query = query.where(
        sql`${suppliers.name} ILIKE ${`%${search}%`} OR ${suppliers.phone} ILIKE ${`%${search}%`}`
      );
    }

    const result = await query.limit(Number(limit)).offset(offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Get supplier by ID with purchase history
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await req.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);

    if (supplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get purchase history
    const purchaseHistory = await req.db.select({
      id: purchases.id,
      invoiceNumber: purchases.invoiceNumber,
      total: purchases.total,
      paid: purchases.paid,
      balance: purchases.balance,
      status: purchases.status,
      createdAt: purchases.createdAt,
    }).from(purchases)
    .where(eq(purchases.supplierId, id))
    .orderBy(desc(purchases.createdAt))
    .limit(20);

    // Get purchase stats
    const stats = await req.db.select({
      totalPurchases: sum(purchases.total),
      totalPaid: sum(purchases.paid),
      totalBalance: sum(purchases.balance),
      purchaseCount: sql`COUNT(*)`,
    }).from(purchases)
    .where(eq(purchases.supplierId, id));

    res.json({
      ...supplier[0],
      purchaseHistory,
      stats: stats[0] || { totalPurchases: 0, totalPaid: 0, totalBalance: 0, purchaseCount: 0 }
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// Create supplier
router.post('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const newSupplier = await req.db.insert(suppliers).values({
      name,
      email,
      phone,
      address,
      balance: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newSupplier[0]);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier
router.put('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    const updatedSupplier = await req.db.update(suppliers)
      .set({
        name,
        email,
        phone,
        address,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id))
      .returning();

    if (updatedSupplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(updatedSupplier[0]);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete supplier
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier has purchases
    const supplierPurchases = await req.db.select().from(purchases).where(eq(purchases.supplierId, id)).limit(1);

    if (supplierPurchases.length > 0) {
      return res.status(400).json({ error: 'Cannot delete supplier with existing purchases' });
    }

    const deletedSupplier = await req.db.delete(suppliers).where(eq(suppliers.id, id)).returning();

    if (deletedSupplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Get suppliers with outstanding balances
router.get('/reports/outstanding-balances', requireAuth, async (req, res) => {
  try {
    const suppliersWithBalance = await req.db.select({
      id: suppliers.id,
      name: suppliers.name,
      email: suppliers.email,
      phone: suppliers.phone,
      balance: suppliers.balance,
      totalPurchases: sql`COALESCE(SUM(${purchases.total}), 0)`,
      totalPaid: sql`COALESCE(SUM(${purchases.paid}), 0)`,
      lastPurchase: sql`MAX(${purchases.createdAt})`,
    }).from(suppliers)
    .leftJoin(purchases, eq(suppliers.id, purchases.supplierId))
    .where(sql`${suppliers.balance} > 0`)
    .groupBy(suppliers.id, suppliers.name, suppliers.email, suppliers.phone, suppliers.balance)
    .orderBy(desc(suppliers.balance));

    res.json(suppliersWithBalance);
  } catch (error) {
    console.error('Error fetching suppliers with outstanding balances:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers with outstanding balances' });
  }
});

// Update supplier balance
router.post('/:id/payment', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const supplier = await req.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);

    if (supplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const currentBalance = Number(supplier[0].balance);
    const paymentAmount = Number(amount);

    if (paymentAmount > currentBalance) {
      return res.status(400).json({ error: 'Payment amount cannot exceed outstanding balance' });
    }

    const newBalance = currentBalance - paymentAmount;

    const updatedSupplier = await req.db.update(suppliers)
      .set({
        balance: newBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id))
      .returning();

    // Here you could also create a payment record in a payments table
    // For now, we'll just return the updated supplier

    res.json({
      ...updatedSupplier[0],
      paymentAmount,
      notes
    });
  } catch (error) {
    console.error('Error processing supplier payment:', error);
    res.status(500).json({ error: 'Failed to process supplier payment' });
  }
});

export default router;