import express from 'express';
import { rmas, customers, products, sales, serialNumbers } from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all RMAs
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, customerId, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = req.db.select({
      id: rmas.id,
      rmaNumber: rmas.rmaNumber,
      customerId: rmas.customerId,
      saleId: rmas.saleId,
      productId: rmas.productId,
      serialNumber: rmas.serialNumber,
      reason: rmas.reason,
      status: rmas.status,
      notes: rmas.notes,
      createdAt: rmas.createdAt,
      updatedAt: rmas.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
      },
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        mpn: products.mpn,
      },
      sale: {
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
      }
    }).from(rmas)
    .leftJoin(customers, eq(rmas.customerId, customers.id))
    .leftJoin(products, eq(rmas.productId, products.id))
    .leftJoin(sales, eq(rmas.saleId, sales.id))
    .orderBy(desc(rmas.createdAt));

    if (status) {
      query = query.where(eq(rmas.status, status as string));
    }

    if (customerId) {
      query = query.where(eq(rmas.customerId, customerId as string));
    }

    const result = await query.limit(Number(limit)).offset(offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching RMAs:', error);
    res.status(500).json({ error: 'Failed to fetch RMAs' });
  }
});

// Get RMA by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const rma = await req.db.select({
      id: rmas.id,
      rmaNumber: rmas.rmaNumber,
      customerId: rmas.customerId,
      saleId: rmas.saleId,
      productId: rmas.productId,
      serialNumber: rmas.serialNumber,
      reason: rmas.reason,
      status: rmas.status,
      notes: rmas.notes,
      createdAt: rmas.createdAt,
      updatedAt: rmas.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
      },
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        mpn: products.mpn,
        sku: products.sku,
        warrantyMonths: products.warrantyMonths,
      },
      sale: {
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        createdAt: sales.createdAt,
      }
    }).from(rmas)
    .leftJoin(customers, eq(rmas.customerId, customers.id))
    .leftJoin(products, eq(rmas.productId, products.id))
    .leftJoin(sales, eq(rmas.saleId, sales.id))
    .where(eq(rmas.id, id))
    .limit(1);

    if (rma.length === 0) {
      return res.status(404).json({ error: 'RMA not found' });
    }

    // Get warranty info if serial number exists
    let warrantyInfo = null;
    if (rma[0].serialNumber) {
      const serial = await req.db.select().from(serialNumbers)
        .where(eq(serialNumbers.serialNumber, rma[0].serialNumber))
        .limit(1);
      
      if (serial.length > 0) {
        warrantyInfo = {
          warrantyExpiry: serial[0].warrantyExpiry,
          isUnderWarranty: serial[0].warrantyExpiry ? new Date(serial[0].warrantyExpiry) > new Date() : false,
        };
      }
    }

    res.json({
      ...rma[0],
      warrantyInfo
    });
  } catch (error) {
    console.error('Error fetching RMA:', error);
    res.status(500).json({ error: 'Failed to fetch RMA' });
  }
});

// Create RMA
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      customerId,
      saleId,
      productId,
      serialNumber,
      reason,
      notes
    } = req.body;

    if (!customerId || !productId || !reason) {
      return res.status(400).json({ error: 'Customer, product, and reason are required' });
    }

    // Generate RMA number
    const rmaNumber = `RMA-${Date.now()}`;

    const newRMA = await req.db.insert(rmas).values({
      rmaNumber,
      customerId,
      saleId: saleId || null,
      productId,
      serialNumber: serialNumber || null,
      reason,
      status: 'under_review',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Update serial number status if provided
    if (serialNumber) {
      await req.db.update(serialNumbers)
        .set({ status: 'rma' })
        .where(eq(serialNumbers.serialNumber, serialNumber));
    }

    res.status(201).json(newRMA[0]);
  } catch (error) {
    console.error('Error creating RMA:', error);
    res.status(500).json({ error: 'Failed to create RMA' });
  }
});

// Update RMA status
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const rma = await req.db.select().from(rmas).where(eq(rmas.id, id)).limit(1);

    if (rma.length === 0) {
      return res.status(404).json({ error: 'RMA not found' });
    }

    const updatedRMA = await req.db.update(rmas)
      .set({
        status,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(rmas.id, id))
      .returning();

    // Update serial number status based on RMA status
    if (rma[0].serialNumber) {
      let serialStatus = 'rma';
      
      if (status === 'returned') {
        serialStatus = 'available';
      } else if (status === 'rejected') {
        serialStatus = 'sold';
      }

      await req.db.update(serialNumbers)
        .set({ status: serialStatus })
        .where(eq(serialNumbers.serialNumber, rma[0].serialNumber));
    }

    res.json(updatedRMA[0]);
  } catch (error) {
    console.error('Error updating RMA:', error);
    res.status(500).json({ error: 'Failed to update RMA' });
  }
});

// Get RMA statistics
router.get('/reports/statistics', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = req.db.select({
      status: rmas.status,
      count: sql`COUNT(*)`,
    }).from(rmas)
    .groupBy(rmas.status);

    if (startDate && endDate) {
      query = query.where(sql`${rmas.createdAt} BETWEEN ${new Date(startDate as string)} AND ${new Date(endDate as string)}`);
    }

    const statusStats = await query;

    // Get top RMA reasons
    const reasonStats = await req.db.select({
      reason: rmas.reason,
      count: sql`COUNT(*)`,
    }).from(rmas)
    .groupBy(rmas.reason)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

    // Get product-wise RMA count
    const productStats = await req.db.select({
      productId: rmas.productId,
      productName: products.name,
      count: sql`COUNT(*)`,
    }).from(rmas)
    .leftJoin(products, eq(rmas.productId, products.id))
    .groupBy(rmas.productId, products.name)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

    res.json({
      statusStats,
      reasonStats,
      productStats
    });
  } catch (error) {
    console.error('Error fetching RMA statistics:', error);
    res.status(500).json({ error: 'Failed to fetch RMA statistics' });
  }
});

// Check warranty status
router.get('/warranty-check/:serialNumber', requireAuth, async (req, res) => {
  try {
    const { serialNumber } = req.params;

    const serial = await req.db.select({
      id: serialNumbers.id,
      serialNumber: serialNumbers.serialNumber,
      status: serialNumbers.status,
      warrantyExpiry: serialNumbers.warrantyExpiry,
      customerId: serialNumbers.customerId,
      saleId: serialNumbers.saleId,
      product: {
        id: products.id,
        name: products.name,
        warrantyMonths: products.warrantyMonths,
      },
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
      }
    }).from(serialNumbers)
    .leftJoin(products, eq(serialNumbers.productId, products.id))
    .leftJoin(customers, eq(serialNumbers.customerId, customers.id))
    .where(eq(serialNumbers.serialNumber, serialNumber))
    .limit(1);

    if (serial.length === 0) {
      return res.status(404).json({ error: 'Serial number not found' });
    }

    const serialData = serial[0];
    const isUnderWarranty = serialData.warrantyExpiry ? new Date(serialData.warrantyExpiry) > new Date() : false;
    const daysRemaining = serialData.warrantyExpiry ? 
      Math.ceil((new Date(serialData.warrantyExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

    res.json({
      ...serialData,
      isUnderWarranty,
      daysRemaining: Math.max(0, daysRemaining),
      canCreateRMA: serialData.status === 'sold' && isUnderWarranty
    });
  } catch (error) {
    console.error('Error checking warranty:', error);
    res.status(500).json({ error: 'Failed to check warranty' });
  }
});

export default router;