import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: info.message || 'Authentication failed' });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login error' });
      }
      
      const { password, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    });
  })(req, res, next);
});

// Register (Admin only)
router.post('/register', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { email, password, name, phone, role = 'staff' } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    // Check if user already exists
    const existingUser = await req.db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = await req.db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      phone,
      role,
    }).returning();
    
    const { password: _, ...userWithoutPassword } = newUser[0];
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout error' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const { password, ...userWithoutPassword } = req.user as any;
    res.json({ user: userWithoutPassword });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Get all users (Admin only)
router.get('/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const allUsers = await req.db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users);
    
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (Admin only)
router.put('/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;
    
    const updatedUser = await req.db.update(users)
      .set({ name, phone, role, isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password, ...userWithoutPassword } = updatedUser[0];
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Middleware functions
function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export { requireAuth, requireRole };
export default router;