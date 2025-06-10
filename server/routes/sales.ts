import express from 'express';
import { sales, saleItems, customers, products, payments, serialNumbers, users } from '../../shared/schema.js';
import { eq, desc, sum, count, sql, and, gte, lte } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all sales with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      customerId, 
      status, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = req.db.select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      customerId: sales.customerId,
      userId: sales.userId,
      subtotal: sales.subtotal,
      discount: sales.discount,
      tax: sales.tax,
      total: sales.total,
      profit: sales.profit,
      status: sales.status,
      paymentStatus: sales.paymentStatus,
      createdAt: sales.createdAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
      },
      user: {
        id: users.id,
        name: users.name,
      }
    }).from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(users, eq(sales.userId, users.id))
    .orderBy(desc(sales.createdAt));
    
    // Apply filters
    const conditions = [];
    
    if (startDate) {
      conditions.push(gte(sales.createdAt, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(sales.createdAt, new Date(endDate as string)));
    }
    
    if (customerId) {
      conditions.push(eq(sales.customerId, customerId as string));
    }
    
    if (status) {
      conditions.push(eq(sales.status, status as string));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const result = await query.limit(Number(limit)).offset(offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get sale by ID with items
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await req.db.select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      customerId: sales.customerId,
      userId: sales.userId,
      subtotal: sales.subtotal,
      discount: sales.discount,
      tax: sales.tax,
      total: sales.total,
      profit: sales.profit,
      status: sales.status,
      paymentStatus: sales.paymentStatus,
      notes: sales.notes,
      createdAt: sales.createdAt,
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
    }).from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(users, eq(sales.userId, users.id))
    .where(eq(sales.id, id))
    .limit(1);
    
    if (sale.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    // Get sale items
    const items = await req.db.select({
      id: saleItems.id,
      productId: saleItems.productId,
      variantId: saleItems.variantId,
      serialNumber: saleItems.serialNumber,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      costPrice: saleItems.costPrice,
      total: saleItems.total,
      profit: saleItems.profit,
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        mpn: products.mpn,
        sku: products.sku,
      }
    }).from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, id));
    
    // Get payments
    const salePayments = await req.db.select().from(payments).where(eq(payments.saleId, id));
    
    res.json({
      ...sale[0],
      items,
      payments: salePayments
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// Create sale
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      customerId,
      items,
      discount = 0,
      tax = 0,
      payments: salePayments,
      notes
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Sale items are required' });
    }
    
    // Calculate totals
    let subtotal = 0;
    let totalProfit = 0;
    
    for (const item of items) {
      subtotal += Number(item.unitPrice) * Number(item.quantity);
      totalProfit += (Number(item.unitPrice) - Number(item.costPrice)) * Number(item.quantity);
    }
    
    const total = subtotal - Number(discount) + Number(tax);
    
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}`;
    
    // Create sale
    const newSale = await req.db.insert(sales).values({
      invoiceNumber,
      customerId: customerId || null,
      userId: (req.user as any).id,
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      tax: tax.toString(),
      total: total.toString(),
      profit: totalProfit.toString(),
      status: 'completed',
      paymentStatus: 'paid',
      notes,
      createdAt: new Date(),
    }).returning();
    
    const saleId = newSale[0].id;
    
    // Create sale items
    for (const item of items) {
      await req.db.insert(saleItems).values({
        saleId,
        productId: item.productId,
        variantId: item.variantId || null,
        serialNumber: item.serialNumber || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        costPrice: item.costPrice.toString(),
        total: (Number(item.unitPrice) * Number(item.quantity)).toString(),
        profit: ((Number(item.unitPrice) - Number(item.costPrice)) * Number(item.quantity)).toString(),
      });
      
      // Update product stock
      await req.db.update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
      
      // Update serial number status if provided
      if (item.serialNumber) {
        await req.db.update(serialNumbers)
          .set({
            status: 'sold',
            saleId,
            customerId: customerId || null,
          })
          .where(eq(serialNumbers.serialNumber, item.serialNumber));
      }
    }
    
    // Create payments
    if (salePayments && salePayments.length > 0) {
      for (const payment of salePayments) {
        await req.db.insert(payments).values({
          saleId,
          method: payment.method,
          amount: payment.amount.toString(),
          reference: payment.reference || null,
          cashGiven: payment.cashGiven ? payment.cashGiven.toString() : null,
          change: payment.change ? payment.change.toString() : null,
          createdAt: new Date(),
        });
      }
    }
    
    // Update customer stats if customer provided
    if (customerId) {
      await req.db.update(customers)
        .set({
          totalSpent: sql`${customers.totalSpent} + ${total}`,
          lastPurchase: new Date(),
          loyaltyPoints: sql`${customers.loyaltyPoints} + ${Math.floor(total / 100)}`, // 1 point per 100 spent
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
    }
    
    res.status(201).json(newSale[0]);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// Get sales analytics
router.get('/analytics/dashboard', requireAuth, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    let startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }
    
    // Get sales summary
    const salesSummary = await req.db.select({
      totalSales: sum(sales.total),
      totalProfit: sum(sales.profit),
      totalOrders: count(sales.id),
    }).from(sales)
    .where(and(
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate)
    ));
    
    // Get top selling products
    const topProducts = await req.db.select({
      productId: saleItems.productId,
      productName: products.name,
      totalQuantity: sum(saleItems.quantity),
      totalRevenue: sum(saleItems.total),
      totalProfit: sum(saleItems.profit),
    }).from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate)
    ))
    .groupBy(saleItems.productId, products.name)
    .orderBy(desc(sum(saleItems.quantity)))
    .limit(10);
    
    // Get daily sales for chart
    const dailySales = await req.db.select({
      date: sql`DATE(${sales.createdAt})`,
      totalSales: sum(sales.total),
      totalProfit: sum(sales.profit),
      orderCount: count(sales.id),
    }).from(sales)
    .where(and(
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate)
    ))
    .groupBy(sql`DATE(${sales.createdAt})`)
    .orderBy(sql`DATE(${sales.createdAt})`);
    
    res.json({
      summary: salesSummary[0] || { totalSales: 0, totalProfit: 0, totalOrders: 0 },
      topProducts,
      dailySales
    });
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
});

// Get product suggestions for upselling
router.get('/suggestions/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Find products frequently bought together
    const suggestions = await req.db.select({
      productId: saleItems.productId,
      productName: products.name,
      productImage: products.image,
      sellingPrice: products.sellingPrice,
      frequency: count(saleItems.id),
    }).from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(sales, eq(saleItems.saleId, sales.id))
    .where(
      sql`${sales.id} IN (
        SELECT DISTINCT ${sales.id} 
        FROM ${sales} 
        JOIN ${saleItems} ON ${sales.id} = ${saleItems.saleId} 
        WHERE ${saleItems.productId} = ${productId}
      ) AND ${saleItems.productId} != ${productId}`
    )
    .groupBy(saleItems.productId, products.name, products.image, products.sellingPrice)
    .orderBy(desc(count(saleItems.id)))
    .limit(5);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching product suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch product suggestions' });
  }
});

export default router;