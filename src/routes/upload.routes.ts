import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Public: Serve image
router.get('/:id', UploadController.serveImage);

// Admin only: List all images
router.get('/', authMiddleware, adminMiddleware, UploadController.listUploads);

// Admin only: Upload image / banner
router.post('/banner', authMiddleware, adminMiddleware, UploadController.uploadBanner);
router.post('/', authMiddleware, adminMiddleware, UploadController.uploadImage);

// Admin only: Delete image
router.delete('/:id', authMiddleware, adminMiddleware, UploadController.deleteUpload);

export default router;

