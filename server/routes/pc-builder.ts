import express from 'express';
import { pcBuilds, products, customers } from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all PC builds
router.get('/', requireAuth, async (req, res) => {
  try {
    const { customerId, status } = req.query;
    
    let query = req.db.select({
      id: pcBuilds.id,
      name: pcBuilds.name,
      customerId: pcBuilds.customerId,
      userId: pcBuilds.userId,
      total: pcBuilds.total,
      status: pcBuilds.status,
      notes: pcBuilds.notes,
      createdAt: pcBuilds.createdAt,
      updatedAt: pcBuilds.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
      }
    }).from(pcBuilds)
    .leftJoin(customers, eq(pcBuilds.customerId, customers.id))
    .orderBy(desc(pcBuilds.createdAt));

    if (customerId) {
      query = query.where(eq(pcBuilds.customerId, customerId as string));
    }

    if (status) {
      query = query.where(eq(pcBuilds.status, status as string));
    }

    const builds = await query;
    res.json(builds);
  } catch (error) {
    console.error('Error fetching PC builds:', error);
    res.status(500).json({ error: 'Failed to fetch PC builds' });
  }
});

// Get PC build by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const build = await req.db.select().from(pcBuilds).where(eq(pcBuilds.id, id)).limit(1);

    if (build.length === 0) {
      return res.status(404).json({ error: 'PC build not found' });
    }

    // Get component details
    const components = build[0].components || [];
    const componentDetails = [];

    for (const component of components) {
      const product = await req.db.select().from(products).where(eq(products.id, component.productId)).limit(1);
      if (product.length > 0) {
        componentDetails.push({
          ...component,
          product: product[0]
        });
      }
    }

    res.json({
      ...build[0],
      components: componentDetails
    });
  } catch (error) {
    console.error('Error fetching PC build:', error);
    res.status(500).json({ error: 'Failed to fetch PC build' });
  }
});

// Create PC build
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, customerId, components, notes } = req.body;
    const userId = (req.user as any).id;

    // Calculate total
    let total = 0;
    for (const component of components) {
      const product = await req.db.select().from(products).where(eq(products.id, component.productId)).limit(1);
      if (product.length > 0) {
        total += Number(product[0].sellingPrice) * component.quantity;
      }
    }

    const newBuild = await req.db.insert(pcBuilds).values({
      name,
      customerId: customerId || null,
      userId,
      components,
      total: total.toString(),
      status: 'draft',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newBuild[0]);
  } catch (error) {
    console.error('Error creating PC build:', error);
    res.status(500).json({ error: 'Failed to create PC build' });
  }
});

// Update PC build
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, customerId, components, status, notes } = req.body;

    // Calculate total if components are updated
    let total;
    if (components) {
      total = 0;
      for (const component of components) {
        const product = await req.db.select().from(products).where(eq(products.id, component.productId)).limit(1);
        if (product.length > 0) {
          total += Number(product[0].sellingPrice) * component.quantity;
        }
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (customerId !== undefined) updateData.customerId = customerId;
    if (components !== undefined) {
      updateData.components = components;
      updateData.total = total?.toString();
    }
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updatedBuild = await req.db.update(pcBuilds)
      .set(updateData)
      .where(eq(pcBuilds.id, id))
      .returning();

    if (updatedBuild.length === 0) {
      return res.status(404).json({ error: 'PC build not found' });
    }

    res.json(updatedBuild[0]);
  } catch (error) {
    console.error('Error updating PC build:', error);
    res.status(500).json({ error: 'Failed to update PC build' });
  }
});

// Delete PC build
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBuild = await req.db.delete(pcBuilds).where(eq(pcBuilds.id, id)).returning();

    if (deletedBuild.length === 0) {
      return res.status(404).json({ error: 'PC build not found' });
    }

    res.json({ message: 'PC build deleted successfully' });
  } catch (error) {
    console.error('Error deleting PC build:', error);
    res.status(500).json({ error: 'Failed to delete PC build' });
  }
});

// Convert build to sale
router.post('/:id/convert-to-sale', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { discount = 0, tax = 0, payments, notes: saleNotes } = req.body;

    const build = await req.db.select().from(pcBuilds).where(eq(pcBuilds.id, id)).limit(1);

    if (build.length === 0) {
      return res.status(404).json({ error: 'PC build not found' });
    }

    const buildData = build[0];
    const components = buildData.components || [];

    // Prepare sale items
    const saleItems = [];
    for (const component of components) {
      const product = await req.db.select().from(products).where(eq(products.id, component.productId)).limit(1);
      if (product.length > 0) {
        saleItems.push({
          productId: component.productId,
          quantity: component.quantity,
          unitPrice: Number(product[0].sellingPrice),
          costPrice: Number(product[0].costPrice),
        });
      }
    }

    // Create sale via sales API
    const saleData = {
      customerId: buildData.customerId,
      items: saleItems,
      discount,
      tax,
      payments,
      notes: saleNotes || `Converted from PC Build: ${buildData.name}`,
    };

    // You would call the sales creation logic here
    // For now, we'll just update the build status
    await req.db.update(pcBuilds)
      .set({
        status: 'purchased',
        updatedAt: new Date(),
      })
      .where(eq(pcBuilds.id, id));

    res.json({ message: 'PC build converted to sale successfully', saleData });
  } catch (error) {
    console.error('Error converting PC build to sale:', error);
    res.status(500).json({ error: 'Failed to convert PC build to sale' });
  }
});

// Get compatible components
router.get('/components/compatible', requireAuth, async (req, res) => {
  try {
    const { category, socket, formFactor } = req.query;

    // This is a simplified compatibility check
    // In a real system, you'd have more complex compatibility rules
    let query = req.db.select().from(products).where(eq(products.isActive, true));

    if (category) {
      // Filter by category if provided
      // You'd need to join with categories table
    }

    const compatibleComponents = await query;
    res.json(compatibleComponents);
  } catch (error) {
    console.error('Error fetching compatible components:', error);
    res.status(500).json({ error: 'Failed to fetch compatible components' });
  }
});

export default router;