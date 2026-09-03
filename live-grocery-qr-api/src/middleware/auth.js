import { auth, db } from '../firebase/admin.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    req.user = await auth.verifyIdToken(header.slice(7));
    req.role = String(req.user.role || 'CUSTOMER').toUpperCase();
    if (req.role === 'CUSTOMER') {
      const profile = await db.collection('customers').where('firebaseAuthUid', '==', req.user.uid).limit(1).get();
      req.customer = profile.empty ? null : { id: profile.docs[0].id, ...profile.docs[0].data() };
    }
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired authentication token' }); }
}

export const allowRoles = (...roles) => (req, res, next) =>
  roles.includes(req.role) ? next() : res.status(403).json({ error: 'Insufficient permission' });
