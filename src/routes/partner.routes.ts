import { Router } from 'express';
import { PartnerController } from '../controllers/PartnerController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Rota pública para listar parceiros na landing page
router.get('/', PartnerController.list);

// Rotas protegidas (apenas admin) para gerenciar parceiros
router.post('/', authMiddleware, adminMiddleware, PartnerController.create);
router.put('/:id', authMiddleware, adminMiddleware, PartnerController.update);
router.delete('/:id', authMiddleware, adminMiddleware, PartnerController.delete);

export default router;
