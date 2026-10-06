import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Public: Serve image
router.get('/:id', UploadController.serveImage);

// Public: List images (supports ?category= filter)
router.get('/', UploadController.listUploads);

// Admin only: Upload image / banner
router.post('/banner', authMiddleware, adminMiddleware, UploadController.uploadBanner);
router.post('/', authMiddleware, adminMiddleware, UploadController.uploadImage);

// Admin only: Edit image
router.put('/:id', authMiddleware, adminMiddleware, UploadController.updateUpload);

// Admin only: Delete image
router.delete('/:id', authMiddleware, adminMiddleware, UploadController.deleteUpload);

export default router;

