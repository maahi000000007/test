import express from 'express';
import { customers, sales, saleItems, products } from '../../shared/schema.js';
import { eq, desc, sum, count, sql } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all customers with search
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = req.db.select().from(customers).orderBy(desc(customers.createdAt));
    
    if (search) {
      query = query.where(
        sql`${customers.name} ILIKE ${`%${search}%`} OR ${customers.phone} ILIKE ${`%${search}%`}`
      );
    }
    
    const result = await query.limit(Number(limit)).offset(offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by phone
router.get('/phone/:phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    
    const customer = await req.db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    
    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer[0]);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Get customer by ID with purchase history
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await req.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    
    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get purchase history
    const purchaseHistory = await req.db.select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      total: sales.total,
      profit: sales.profit,
      status: sales.status,
      createdAt: sales.createdAt,
    }).from(sales)
    .where(eq(sales.customerId, id))
    .orderBy(desc(sales.createdAt))
    .limit(20);
    
    // Get purchase stats
    const stats = await req.db.select({
      totalSpent: sum(sales.total),
      totalOrders: count(sales.id),
    }).from(sales)
    .where(eq(sales.customerId, id));
    
    res.json({
      ...customer[0],
      purchaseHistory,
      stats: stats[0] || { totalSpent: 0, totalOrders: 0 }
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create customer
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    
    // Check if phone already exists
    const existingCustomer = await req.db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    
    if (existingCustomer.length > 0) {
      return res.status(400).json({ error: 'Customer with this phone number already exists' });
    }
    
    const newCustomer = await req.db.insert(customers).values({
      name,
      phone,
      email,
      address,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    res.status(201).json(newCustomer[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, customPricing } = req.body;
    
    const updatedCustomer = await req.db.update(customers)
      .set({
        name,
        phone,
        email,
        address,
        customPricing,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();
    
    if (updatedCustomer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(updatedCustomer[0]);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Get inactive customers (no purchase in 30+ days)
router.get('/reports/inactive', requireAuth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const inactiveCustomers = await req.db.select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      lastPurchase: customers.lastPurchase,
      totalSpent: customers.totalSpent,
    }).from(customers)
    .where(
      sql`${customers.lastPurchase} < ${thirtyDaysAgo} OR ${customers.lastPurchase} IS NULL`
    )
    .orderBy(desc(customers.lastPurchase));
    
    res.json(inactiveCustomers);
  } catch (error) {
    console.error('Error fetching inactive customers:', error);
    res.status(500).json({ error: 'Failed to fetch inactive customers' });
  }
});

// Get top customers by spending
router.get('/reports/top-spenders', requireAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const topCustomers = await req.db.select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      totalSpent: customers.totalSpent,
      loyaltyPoints: customers.loyaltyPoints,
      lastPurchase: customers.lastPurchase,
    }).from(customers)
    .orderBy(desc(customers.totalSpent))
    .limit(Number(limit));
    
    res.json(topCustomers);
  } catch (error) {
    console.error('Error fetching top customers:', error);
    res.status(500).json({ error: 'Failed to fetch top customers' });
  }
});

// Update loyalty points
router.post('/:id/loyalty', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { points, action } = req.body; // action: 'add' or 'redeem'
    
    const customer = await req.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    
    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const currentPoints = customer[0].loyaltyPoints || 0;
    let newPoints = currentPoints;
    
    if (action === 'add') {
      newPoints = currentPoints + points;
    } else if (action === 'redeem') {
      if (currentPoints < points) {
        return res.status(400).json({ error: 'Insufficient loyalty points' });
      }
      newPoints = currentPoints - points;
    }
    
    const updatedCustomer = await req.db.update(customers)
      .set({
        loyaltyPoints: newPoints,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();
    
    res.json(updatedCustomer[0]);
  } catch (error) {
    console.error('Error updating loyalty points:', error);
    res.status(500).json({ error: 'Failed to update loyalty points' });
  }
});

export default router;