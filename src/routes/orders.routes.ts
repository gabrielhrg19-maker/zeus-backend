import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, OrderController.create);
router.get('/my-orders', authMiddleware, OrderController.listMine);
router.get('/:id/status', authMiddleware, OrderController.getStatus);

export default router;
