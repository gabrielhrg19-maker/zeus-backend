import { Router } from 'express';
import { SiteSettingController } from '../controllers/SiteSettingController';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Event Instructions carousel
router.get('/instructions', SiteSettingController.getInstructions);
router.put('/instructions', authMiddleware, adminMiddleware, SiteSettingController.updateInstructions);

// Public: get site settings for landing page (all pages or specific page via :page / ?page=)
router.get('/', SiteSettingController.getSettings);
router.get('/:page', SiteSettingController.getSettings);

// Admin: update site settings (all or specific page)
router.put('/', authMiddleware, adminMiddleware, SiteSettingController.updateSettings);
router.put('/:page', authMiddleware, adminMiddleware, SiteSettingController.updateSettings);

export default router;
