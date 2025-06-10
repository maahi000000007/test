import express from 'express';
import { offers } from '../../shared/schema.js';
import { eq, and, lte, gte } from 'drizzle-orm';
import { requireAuth, requireRole } from './auth.js';

const router = express.Router();

// Get all offers
router.get('/', requireAuth, async (req, res) => {
  try {
    const allOffers = await req.db.select().from(offers);
    res.json(allOffers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Get active offers
router.get('/active', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    
    const activeOffers = await req.db.select().from(offers)
      .where(and(
        eq(offers.isActive, true),
        lte(offers.startDate, now),
        gte(offers.endDate, now)
      ));

    res.json(activeOffers);
  } catch (error) {
    console.error('Error fetching active offers:', error);
    res.status(500).json({ error: 'Failed to fetch active offers' });
  }
});

// Create offer
router.post('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, type, conditions, rewards, startDate, endDate } = req.body;

    const newOffer = await req.db.insert(offers).values({
      name,
      type,
      conditions,
      rewards,
      isActive: true,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdAt: new Date(),
    }).returning();

    res.status(201).json(newOffer[0]);
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// Update offer
router.put('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, conditions, rewards, isActive, startDate, endDate } = req.body;

    const updatedOffer = await req.db.update(offers)
      .set({
        name,
        type,
        conditions,
        rewards,
        isActive,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      })
      .where(eq(offers.id, id))
      .returning();

    if (updatedOffer.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(updatedOffer[0]);
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// Delete offer
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOffer = await req.db.delete(offers).where(eq(offers.id, id)).returning();

    if (deletedOffer.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

// Check offer eligibility
router.post('/check-eligibility', requireAuth, async (req, res) => {
  try {
    const { cartItems, customerId, totalAmount } = req.body;

    const now = new Date();
    const activeOffers = await req.db.select().from(offers)
      .where(and(
        eq(offers.isActive, true),
        lte(offers.startDate, now),
        gte(offers.endDate, now)
      ));

    const eligibleOffers = [];

    for (const offer of activeOffers) {
      let isEligible = false;

      switch (offer.type) {
        case 'combo':
          // Check if required products are in cart
          const requiredProducts = offer.conditions?.requiredProducts || [];
          isEligible = requiredProducts.every((productId: string) =>
            cartItems.some((item: any) => item.productId === productId)
          );
          break;

        case 'bogo':
          // Buy one get one logic
          const bogoProduct = offer.conditions?.productId;
          const cartItem = cartItems.find((item: any) => item.productId === bogoProduct);
          isEligible = cartItem && cartItem.quantity >= (offer.conditions?.minQuantity || 1);
          break;

        case 'discount':
          // Minimum amount discount
          const minAmount = offer.conditions?.minAmount || 0;
          isEligible = totalAmount >= minAmount;
          break;

        case 'free_item':
          // Free item with minimum purchase
          const freeItemMinAmount = offer.conditions?.minAmount || 0;
          isEligible = totalAmount >= freeItemMinAmount;
          break;
      }

      if (isEligible) {
        eligibleOffers.push(offer);
      }
    }

    res.json(eligibleOffers);
  } catch (error) {
    console.error('Error checking offer eligibility:', error);
    res.status(500).json({ error: 'Failed to check offer eligibility' });
  }
});

export default router;