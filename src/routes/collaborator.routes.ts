import { Router } from 'express';
import { CollaboratorController } from '../controllers/CollaboratorController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Public: Get all collaborators for landing page
router.get('/', CollaboratorController.list);

// Admin only: CRUD collaborators
router.post('/', authMiddleware, adminMiddleware, CollaboratorController.create);
router.put('/:id', authMiddleware, adminMiddleware, CollaboratorController.update);
router.delete('/:id', authMiddleware, adminMiddleware, CollaboratorController.delete);

export default router;
