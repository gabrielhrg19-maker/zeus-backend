import { Router } from 'express';
import { handleWebhook, processPayment } from '../controllers/payment.controller';

const router = Router();

router.post('/process', processPayment);
router.post('/webhook/:champId', handleWebhook);

export default router;
