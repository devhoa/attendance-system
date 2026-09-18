import { Router } from 'express';
import { getDashboardOverview } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/summary', requireAuth, getDashboardOverview);

export default router;
