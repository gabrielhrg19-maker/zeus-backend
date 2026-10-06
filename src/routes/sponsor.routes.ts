import { Router } from 'express';
import { SponsorController } from '../controllers/SponsorController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Rota pública para listar patrocinadores
router.get('/', SponsorController.list);

// Rotas protegidas (apenas admin)
router.post('/', authMiddleware, adminMiddleware, SponsorController.create);
router.put('/:id', authMiddleware, adminMiddleware, SponsorController.update);
router.delete('/:id', authMiddleware, adminMiddleware, SponsorController.delete);

export default router;
