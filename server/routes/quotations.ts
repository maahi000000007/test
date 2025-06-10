import express from 'express';
import { quotations, quoteItems, customers, products, users } from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all quotations
router.get('/', requireAuth, async (req, res) => {
  try {
    const { customerId, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = req.db.select({
      id: quotations.id,
      quoteNumber: quotations.quoteNumber,
      customerId: quotations.customerId,
      userId: quotations.userId,
      subtotal: quotations.subtotal,
      discount: quotations.discount,
      tax: quotations.tax,
      total: quotations.total,
      status: quotations.status,
      expiryDate: quotations.expiryDate,
      createdAt: quotations.createdAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
      },
      user: {
        id: users.id,
        name: users.name,
      }
    }).from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(users, eq(quotations.userId, users.id))
    .orderBy(desc(quotations.createdAt));

    if (customerId) {
      query = query.where(eq(quotations.customerId, customerId as string));
    }

    if (status) {
      query = query.where(eq(quotations.status, status as string));
    }

    const result = await query.limit(Number(limit)).offset(offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
});

// Get quotation by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await req.db.select({
      id: quotations.id,
      quoteNumber: quotations.quoteNumber,
      customerId: quotations.customerId,
      userId: quotations.userId,
      subtotal: quotations.subtotal,
      discount: quotations.discount,
      tax: quotations.tax,
      total: quotations.total,
      status: quotations.status,
      expiryDate: quotations.expiryDate,
      notes: quotations.notes,
      createdAt: quotations.createdAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
      },
      user: {
        id: users.id,
        name: users.name,
      }
    }).from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(users, eq(quotations.userId, users.id))
    .where(eq(quotations.id, id))
    .limit(1);

    if (quotation.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Get quote items
    const items = await req.db.select({
      id: quoteItems.id,
      productId: quoteItems.productId,
      variantId: quoteItems.variantId,
      quantity: quoteItems.quantity,
      unitPrice: quoteItems.unitPrice,
      total: quoteItems.total,
      isOptional: quoteItems.isOptional,
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        mpn: products.mpn,
        sku: products.sku,
      }
    }).from(quoteItems)
    .leftJoin(products, eq(quoteItems.productId, products.id))
    .where(eq(quoteItems.quoteId, id));

    res.json({
      ...quotation[0],
      items
    });
  } catch (error) {
    console.error('Error fetching quotation:', error);
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
});

// Create quotation
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      customerId,
      items,
      discount = 0,
      tax = 0,
      expiryDate,
      notes
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Quote items are required' });
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += Number(item.unitPrice) * Number(item.quantity);
    }

    const total = subtotal - Number(discount) + Number(tax);

    // Generate quote number
    const quoteNumber = `QUO-${Date.now()}`;

    // Create quotation
    const newQuotation = await req.db.insert(quotations).values({
      quoteNumber,
      customerId: customerId || null,
      userId: (req.user as any).id,
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      tax: tax.toString(),
      total: total.toString(),
      status: 'draft',
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    const quotationId = newQuotation[0].id;

    // Create quote items
    for (const item of items) {
      await req.db.insert(quoteItems).values({
        quoteId: quotationId,
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        total: (Number(item.unitPrice) * Number(item.quantity)).toString(),
        isOptional: item.isOptional || false,
      });
    }

    res.status(201).json(newQuotation[0]);
  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
});

// Update quotation
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, expiryDate, notes } = req.body;

    const updatedQuotation = await req.db.update(quotations)
      .set({
        status,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id))
      .returning();

    if (updatedQuotation.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    res.json(updatedQuotation[0]);
  } catch (error) {
    console.error('Error updating quotation:', error);
    res.status(500).json({ error: 'Failed to update quotation' });
  }
});

// Convert quotation to sale
router.post('/:id/convert-to-sale', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { payments, notes: saleNotes } = req.body;

    const quotation = await req.db.select().from(quotations).where(eq(quotations.id, id)).limit(1);

    if (quotation.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const quote = quotation[0];

    // Get quote items
    const items = await req.db.select({
      productId: quoteItems.productId,
      variantId: quoteItems.variantId,
      quantity: quoteItems.quantity,
      unitPrice: quoteItems.unitPrice,
      product: {
        costPrice: products.costPrice,
      }
    }).from(quoteItems)
    .leftJoin(products, eq(quoteItems.productId, products.id))
    .where(eq(quoteItems.quoteId, id));

    // Prepare sale data
    const saleItems = items.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      costPrice: Number(item.product?.costPrice || 0),
    }));

    const saleData = {
      customerId: quote.customerId,
      items: saleItems,
      discount: Number(quote.discount),
      tax: Number(quote.tax),
      payments,
      notes: saleNotes || `Converted from Quotation: ${quote.quoteNumber}`,
    };

    // Create sale (you would call the sales API here)
    // For now, we'll just update the quotation status
    await req.db.update(quotations)
      .set({
        status: 'converted',
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id));

    res.json({ message: 'Quotation converted to sale successfully', saleData });
  } catch (error) {
    console.error('Error converting quotation to sale:', error);
    res.status(500).json({ error: 'Failed to convert quotation to sale' });
  }
});

// Send quotation (placeholder for WhatsApp integration)
router.post('/:id/send', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { method, recipient } = req.body; // method: 'whatsapp', 'email'

    // Update quotation status to sent
    await req.db.update(quotations)
      .set({
        status: 'sent',
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id));

    // Here you would integrate with WhatsApp API or email service
    res.json({ message: `Quotation sent via ${method} to ${recipient}` });
  } catch (error) {
    console.error('Error sending quotation:', error);
    res.status(500).json({ error: 'Failed to send quotation' });
  }
});

export default router;