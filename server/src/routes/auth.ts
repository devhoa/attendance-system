import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.route('/register')
  .post(register)
  .get((_req, res) => {
    res.status(405).json({ message: 'Use POST /api/auth/register to create an account.' });
  });

router.route('/login')
  .post(login)
  .get((_req, res) => {
    res.status(405).json({ message: 'Use POST /api/auth/login to sign in.' });
  });

router.get('/me', requireAuth, me);

export default router;
