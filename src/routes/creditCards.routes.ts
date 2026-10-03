import { Router } from 'express';
import { CreditCardController } from '../controllers/CreditCardController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', CreditCardController.create);
router.get('/', CreditCardController.list);
router.delete('/:id', CreditCardController.delete);

export default router;
