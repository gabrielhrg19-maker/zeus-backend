import { Router } from 'express';
import { EventController } from '../controllers/EventController';
import { AdminController } from '../controllers/AdminController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ========== PUBLIC ROUTES (no auth) ==========
// Public results - anyone can view published results
router.get('/judging/public-results/:championshipId', EventController.getPublishedResults);
router.get('/public/monitoring/:championshipId', EventController.getPublicMonitoring);
router.get('/public/category-tracking/:championshipId', AdminController.getPublicCategoryTracking);
router.get('/public/locutor-data/:championshipId', EventController.getLocutorData);

// ========== AUTHENTICATED ROUTES ==========
// Athlete registration
router.post('/athletes/register', EventController.registerAthlete);

// Stage advancement (Staff/Admin)
router.post('/athletes/advance-stage', EventController.advanceStage);

// Dashboard stats
router.get('/dashboard/:championshipId', EventController.getDashboard);

// ========== JUDGING ROUTES (auth required) ==========
// Get judge profile by userId
router.get('/judging/judge/:userId', authMiddleware, EventController.getJudgeByUserId);

// Get categories with athletes for a championship
router.get('/judging/categories/:championshipId', authMiddleware, EventController.getChampionshipCategories);

// Get or create a judging session
router.post('/judging/session', authMiddleware, EventController.getOrCreateSession);

// Get sessions for a judge in a championship
router.get('/judging/sessions/:championshipId/:judgeId', authMiddleware, EventController.getJudgeSessions);

// Submit single score
router.post('/judging/score', authMiddleware, EventController.submitScore);

// Submit batch scores (finalize session)
router.post('/judging/batch-scores', authMiddleware, EventController.submitBatchScores);

// Get ranking for a category
router.get('/judging/ranking/:categoryId', authMiddleware, EventController.getRanking);

// ========== ADMIN JUDGING ROUTES ==========
// Get all sessions for a championship
router.get('/judging/admin/sessions/:championshipId', authMiddleware, EventController.getChampionshipSessions);

// Get category judging status overview
router.get('/judging/admin/status/:championshipId', authMiddleware, EventController.getCategoryJudgingStatus);

// Update a single session status
router.patch('/judging/admin/session/:sessionId/status', authMiddleware, EventController.updateSessionStatus);

// Bulk approve/publish all sessions for a category
router.patch('/judging/admin/:championshipId/category/:categoryId/status', authMiddleware, EventController.bulkUpdateCategoryStatus);

export default router;
