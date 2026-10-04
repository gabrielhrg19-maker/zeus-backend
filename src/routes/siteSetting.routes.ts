import { Router } from 'express';
import { SiteSettingController } from '../controllers/SiteSettingController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Public: get site settings for landing page
router.get('/', SiteSettingController.getSettings);

// Admin: update site settings
router.put('/', authMiddleware, adminMiddleware, SiteSettingController.updateSettings);

export default router;
