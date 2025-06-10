import express from 'express';
import { sales, saleItems, products, customers, users, salesTargets } from '../../shared/schema.js';
import { eq, desc, sum, count, sql, and, gte, lte } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get sales targets
router.get('/targets', requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    let query = req.db.select({
      id: salesTargets.id,
      userId: salesTargets.userId,
      period: salesTargets.period,
      target: salesTargets.target,
      achieved: salesTargets.achieved,
      startDate: salesTargets.startDate,
      endDate: salesTargets.endDate,
      user: {
        id: users.id,
        name: users.name,
      }
    }).from(salesTargets)
    .leftJoin(users, eq(salesTargets.userId, users.id))
    .orderBy(desc(salesTargets.startDate));

    // If not admin/manager, only show own targets
    if (!['admin', 'manager'].includes(userRole)) {
      query = query.where(eq(salesTargets.userId, userId));
    }

    const targets = await query;
    res.json(targets);
  } catch (error) {
    console.error('Error fetching sales targets:', error);
    res.status(500).json({ error: 'Failed to fetch sales targets' });
  }
});

// Create sales target
router.post('/targets', requireAuth, async (req, res) => {
  try {
    const { userId, period, target, startDate, endDate } = req.body;
    const currentUser = req.user as any;

    // Only admin/manager can create targets for others
    const targetUserId = ['admin', 'manager'].includes(currentUser.role) ? userId : currentUser.id;

    const newTarget = await req.db.insert(salesTargets).values({
      userId: targetUserId,
      period,
      target: target.toString(),
      achieved: '0',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdAt: new Date(),
    }).returning();

    res.status(201).json(newTarget[0]);
  } catch (error) {
    console.error('Error creating sales target:', error);
    res.status(500).json({ error: 'Failed to create sales target' });
  }
});

// Get profit/loss report
router.get('/profit-loss', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;

    let dateFormat = 'DATE(%s)';
    if (period === 'monthly') {
      dateFormat = 'DATE_FORMAT(%s, "%Y-%m")';
    } else if (period === 'yearly') {
      dateFormat = 'DATE_FORMAT(%s, "%Y")';
    }

    let query = req.db.select({
      period: sql`${sql.raw(dateFormat.replace('%s', 'sales.created_at'))}`,
      totalSales: sum(sales.total),
      totalProfit: sum(sales.profit),
      orderCount: count(sales.id),
    }).from(sales)
    .groupBy(sql`${sql.raw(dateFormat.replace('%s', 'sales.created_at'))}`)
    .orderBy(sql`${sql.raw(dateFormat.replace('%s', 'sales.created_at'))}`);

    if (startDate && endDate) {
      query = query.where(and(
        gte(sales.createdAt, new Date(startDate as string)),
        lte(sales.createdAt, new Date(endDate as string))
      ));
    }

    const report = await query;
    res.json(report);
  } catch (error) {
    console.error('Error fetching profit/loss report:', error);
    res.status(500).json({ error: 'Failed to fetch profit/loss report' });
  }
});

// Get product performance report
router.get('/product-performance', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    let query = req.db.select({
      productId: saleItems.productId,
      productName: products.name,
      productImage: products.image,
      totalQuantity: sum(saleItems.quantity),
      totalRev

enue: sum(saleItems.total),
      totalProfit: sum(saleItems.profit),
      avgPrice: sql`AVG(${saleItems.unitPrice})`,
      orderCount: count(sql`DISTINCT ${saleItems.saleId}`),
    }).from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(sales, eq(saleItems.saleId, sales.id))
    .groupBy(saleItems.productId, products.name, products.image)
    .orderBy(desc(sum(saleItems.total)))
    .limit(Number(limit));

    if (startDate && endDate) {
      query = query.where(and(
        gte(sales.createdAt, new Date(startDate as string)),
        lte(sales.createdAt, new Date(endDate as string))
      ));
    }

    const report = await query;
    res.json(report);
  } catch (error) {
    console.error('Error fetching product performance report:', error);
    res.status(500).json({ error: 'Failed to fetch product performance report' });
  }
});

// Get customer analysis report
router.get('/customer-analysis', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    let query = req.db.select({
      customerId: sales.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      totalSpent: sum(sales.total),
      totalProfit: sum(sales.profit),
      orderCount: count(sales.id),
      avgOrderValue: sql`AVG(${sales.total})`,
      lastPurchase: sql`MAX(${sales.createdAt})`,
    }).from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(sql`${sales.customerId} IS NOT NULL`)
    .groupBy(sales.customerId, customers.name, customers.phone)
    .orderBy(desc(sum(sales.total)))
    .limit(Number(limit));

    if (startDate && endDate) {
      query = query.where(and(
        gte(sales.createdAt, new Date(startDate as string)),
        lte(sales.createdAt, new Date(endDate as string))
      ));
    }

    const report = await query;
    res.json(report);
  } catch (error) {
    console.error('Error fetching customer analysis report:', error);
    res.status(500).json({ error: 'Failed to fetch customer analysis report' });
  }
});

// Get sales by user report
router.get('/sales-by-user', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = req.db.select({
      userId: sales.userId,
      userName: users.name,
      totalSales: sum(sales.total),
      totalProfit: sum(sales.profit),
      orderCount: count(sales.id),
      avgOrderValue: sql`AVG(${sales.total})`,
    }).from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .groupBy(sales.userId, users.name)
    .orderBy(desc(sum(sales.total)));

    if (startDate && endDate) {
      query = query.where(and(
        gte(sales.createdAt, new Date(startDate as string)),
        lte(sales.createdAt, new Date(endDate as string))
      ));
    }

    const report = await query;
    res.json(report);
  } catch (error) {
    console.error('Error fetching sales by user report:', error);
    res.status(500).json({ error: 'Failed to fetch sales by user report' });
  }
});

// Get inventory valuation report
router.get('/inventory-valuation', requireAuth, async (req, res) => {
  try {
    const report = await req.db.select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      stock: products.stock,
      costPrice: products.costPrice,
      sellingPrice: products.sellingPrice,
      costValue: sql`${products.stock} * ${products.costPrice}`,
      sellingValue: sql`${products.stock} * ${products.sellingPrice}`,
      potentialProfit: sql`${products.stock} * (${products.sellingPrice} - ${products.costPrice})`,
    }).from(products)
    .where(and(
      products.isActive,
      sql`${products.stock} > 0`
    ))
    .orderBy(desc(sql`${products.stock} * ${products.costPrice}`));

    const summary = await req.db.select({
      totalCostValue: sum(sql`${products.stock} * ${products.costPrice}`),
      totalSellingValue: sum(sql`${products.stock} * ${products.sellingPrice}`),
      totalPotentialProfit: sum(sql`${products.stock} * (${products.sellingPrice} - ${products.costPrice})`),
      totalProducts: count(products.id),
    }).from(products)
    .where(and(
      products.isActive,
      sql`${products.stock} > 0`
    ));

    res.json({
      items: report,
      summary: summary[0]
    });
  } catch (error) {
    console.error('Error fetching inventory valuation report:', error);
    res.status(500).json({ error: 'Failed to fetch inventory valuation report' });
  }
});

// Get seasonal trends report
router.get('/seasonal-trends', requireAuth, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const trends = await req.db.select({
      month: sql`MONTH(${sales.createdAt})`,
      monthName: sql`MONTHNAME(${sales.createdAt})`,
      totalSales: sum(sales.total),
      totalProfit: sum(sales.profit),
      orderCount: count(sales.id),
      avgOrderValue: sql`AVG(${sales.total})`,
    }).from(sales)
    .where(sql`YEAR(${sales.createdAt}) = ${year}`)
    .groupBy(sql`MONTH(${sales.createdAt})`, sql`MONTHNAME(${sales.createdAt})`)
    .orderBy(sql`MONTH(${sales.createdAt})`);

    res.json(trends);
  } catch (error) {
    console.error('Error fetching seasonal trends report:', error);
    res.status(500).json({ error: 'Failed to fetch seasonal trends report' });
  }
});

export default router;