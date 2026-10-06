import { Router } from 'express';
import { adminMiddleware } from '../middleware/admin.middleware';
import { authMiddleware } from '../middleware/auth';
import { AdminController } from '../controllers/AdminController';
import { ChampionshipController } from '../controllers/ChampionshipController';
import { requireRoles } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Campeonatos
router.get('/championships', AdminController.listChampionships);
router.patch('/championships/:id/status', requireRoles(['ADMIN', 'SUPPORT']), AdminController.toggleChampionshipStatus);
router.put('/championships/:id', requireRoles(['ADMIN', 'SUPPORT']), AdminController.updateChampionship);
router.patch('/championships/:id', requireRoles(['ADMIN', 'SUPPORT']), AdminController.updateChampionship);
router.delete('/championships/:id', requireRoles(['ADMIN', 'SUPPORT']), AdminController.deleteChampionship);
router.post('/championships', requireRoles(['ADMIN', 'SUPPORT']), ChampionshipController.create);
router.post('/championships/:id/import', requireRoles(['ADMIN', 'SUPPORT']), AdminController.importGlobalToChampionship);
router.patch('/categories/:id', requireRoles(['ADMIN', 'SUPPORT']), AdminController.updateCategory);

// Templates Globais
router.get('/globals/stages', AdminController.listGlobalStages);
router.post('/globals/stages', requireRoles(['ADMIN']), AdminController.createGlobalStage);
router.delete('/globals/stages/:id', requireRoles(['ADMIN']), AdminController.deleteGlobalStage);

router.get('/globals/categories', AdminController.listGlobalCategories);
router.post('/globals/categories', requireRoles(['ADMIN']), AdminController.createGlobalCategory);
router.delete('/globals/categories/:id', requireRoles(['ADMIN']), AdminController.deleteGlobalCategory);

// Pipeline de Estações (Monitoramento)
router.get('/championships/:id/stages', AdminController.getChampionshipStages);
router.get('/championships/:id/progress', AdminController.getChampionshipProgress);
router.patch('/championships/:champId/athletes/:athleteId/status', AdminController.advanceAthleteStage);
router.patch('/athletes/:id', AdminController.updateAthlete);
router.post('/athletes', AdminController.createAthlete);
router.delete('/athletes/:id', AdminController.deleteAthlete);

// Acompanhamento de Categorias no Palco
router.patch('/championships/:id/current-category', requireRoles(['ADMIN', 'SUPPORT']), AdminController.setCurrentCategory);
router.patch('/championships/:id/finish-category', requireRoles(['ADMIN', 'SUPPORT']), AdminController.finishCurrentCategory);
router.patch('/championships/:id/reset-tracking', requireRoles(['ADMIN', 'SUPPORT']), AdminController.resetCategoryTracking);

// Financeiro / Pedidos
router.get('/orders', requireRoles(['ADMIN', 'SUPPORT']), AdminController.listAllOrders);
router.post('/orders/:id/approve', requireRoles(['ADMIN', 'SUPPORT']), AdminController.manuallyApproveOrder);
router.post('/orders/:id/check-mp', requireRoles(['ADMIN', 'SUPPORT']), AdminController.checkMercadoPagoOrderStatus);
router.delete('/orders/:id', requireRoles(['ADMIN']), AdminController.deleteOrder);
router.get('/payment-logs', requireRoles(['ADMIN', 'SUPPORT']), AdminController.listPaymentLogs);

// Usuários
router.get('/users', requireRoles(['ADMIN', 'SUPPORT']), AdminController.listUsers);
router.post('/users', requireRoles(['ADMIN']), AdminController.createUser);
router.put('/users/:id', requireRoles(['ADMIN']), AdminController.updateUser);
router.delete('/users/:id', requireRoles(['ADMIN']), AdminController.deleteUser);
router.patch('/users/:id/role', requireRoles(['ADMIN']), AdminController.changeUserRole);
router.patch('/users/:id/federation', requireRoles(['ADMIN', 'SUPPORT']), AdminController.toggleUserFederation);
router.post('/users/:id/reset-password', requireRoles(['ADMIN']), AdminController.resetUserPassword);
router.post('/users/:id/free-ticket', requireRoles(['ADMIN']), AdminController.assignFreeTicket);

export default router;
