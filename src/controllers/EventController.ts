import { Request, Response } from 'express';
import { AthleteService } from '../services/AthleteService';
import { JudgingService } from '../services/JudgingService';
import { prisma } from '../prisma';

export class EventController {
  static async registerAthlete(req: Request, res: Response) {
    try {
      const athlete = await AthleteService.registerAthlete(req.body);
      res.json(athlete);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async advanceStage(req: Request, res: Response) {
    try {
      const { athleteId, validatedById, details } = req.body;
      const result = await AthleteService.advanceStage(athleteId, validatedById, details);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getDashboard(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const stats = await AthleteService.getDashboardStats(championshipId);
      res.json(stats);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ========== JUDGING ENDPOINTS ==========

  /**
   * Submit a single score (judge)
   */
  static async submitScore(req: Request, res: Response) {
    try {
      const score = await JudgingService.submitScore(req.body);
      res.json(score);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Submit batch scores and finalize session (judge)
   */
  static async submitBatchScores(req: Request, res: Response) {
    try {
      const session = await JudgingService.submitBatchScores(req.body);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get or create a judging session (judge)
   */
  static async getOrCreateSession(req: Request, res: Response) {
    try {
      const session = await JudgingService.getOrCreateSession(req.body);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get sessions for a judge in a championship
   */
  static async getJudgeSessions(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const judgeId = req.params.judgeId as string;
      const sessions = await JudgingService.getJudgeSessions(championshipId, judgeId);
      res.json(sessions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get all sessions for a championship (admin)
   */
  static async getChampionshipSessions(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const sessions = await JudgingService.getSessionsForChampionship(championshipId);
      res.json(sessions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get category judging status overview (admin)
   */
  static async getCategoryJudgingStatus(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const status = await JudgingService.getCategoryJudgingStatus(championshipId);
      res.json(status);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Update session status (admin)
   */
  static async updateSessionStatus(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId as string;
      const { status, rejectionReason } = req.body;
      const adminUserId = (req as any).user?.id;
      const session = await JudgingService.updateSessionStatus(sessionId, status, adminUserId, rejectionReason);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Bulk approve/publish all sessions for a category (admin)
   */
  static async bulkUpdateCategoryStatus(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const categoryId = req.params.categoryId as string;
      const { status } = req.body;
      const adminUserId = (req as any).user?.id as string;
      const result = await JudgingService.bulkUpdateCategoryStatus(championshipId, categoryId, status, adminUserId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get ranking for a category (admin/judge)
   */
  static async getRanking(req: Request, res: Response) {
    try {
      const categoryId = req.params.categoryId as string;
      const ranking = await JudgingService.calculateRanking(categoryId);
      res.json(ranking);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get published results for public view (no auth required)
   */
  static async getPublishedResults(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const results = await JudgingService.getPublishedResults(championshipId);
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get locutor data for the currently active category (no auth required for screen/orator)
   */
  static async getLocutorData(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;

      // 1. Fetch championship to find the active category
      const championship = await prisma.championship.findUnique({
        where: { id: championshipId },
        select: { id: true, name: true, currentCategoryId: true }
      });

      if (!championship) {
        return res.status(404).json({ error: 'Campeonato não encontrado' });
      }

      if (!championship.currentCategoryId) {
        return res.json({
          championship,
          active: false,
          message: 'Nenhuma categoria ativa no palco no momento.'
        });
      }

      // 2. Fetch active category details
      const category = await prisma.category.findUnique({
        where: { id: championship.currentCategoryId },
        include: {
          athletes: {
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, athleteNumber: true },
            orderBy: { athleteNumber: 'asc' }
          }
        }
      });

      if (!category) {
        return res.json({
          championship,
          active: false,
          message: 'Categoria ativa não encontrada no banco de dados.'
        });
      }

      // 3. Fetch current sessions for this category to check approval status
      const sessions = await prisma.judgingSession.findMany({
        where: { championshipId, categoryId: category.id }
      });
      const isApproved = sessions.length > 0 && sessions.every(s => s.status === 'APPROVED' || s.status === 'PUBLISHED');

      // 4. Calculate ranking (even if pre-publish)
      const ranking = await JudgingService.calculateRanking(category.id);

      res.json({
        championship,
        active: true,
        category: {
          id: category.id,
          name: category.name,
          poses: category.poses
        },
        athletes: category.athletes,
        ranking,
        isApproved
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get public monitoring data (stages and athlete progress)
   */
  static async getPublicMonitoring(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      
      const stages = await prisma.stage.findMany({
        where: { championshipId },
        orderBy: { order: 'asc' }
      });

      const competitors = await prisma.athlete.findMany({
        where: { championshipId },
        include: {
          user: { select: { name: true } },
          currentStage: true,
          category: true
        }
      });

      const progress = competitors.map(c => ({
        id: c.id,
        name: c.user?.name || 'Atleta',
        athleteNumber: c.athleteNumber,
        category: c.category?.name || 'Geral',
        parentCategory: c.category?.parentName || null,
        currentStage: c.currentStage?.name || 'Pendente',
        currentStageOrder: c.currentStage?.order || 0
      }));

      res.json({ stages, athletes: progress });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get categories with athletes for a championship (used by judge panel)
   */
  static async getChampionshipCategories(req: Request, res: Response) {
    try {
      const championshipId = req.params.championshipId as string;
      const categories = await prisma.category.findMany({
        where: { 
          championshipId,
          athletes: { some: { status: 'ACTIVE' } }
        },
        include: {
          athletes: {
            select: { id: true, name: true, status: true },
            where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
          }
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      res.json(categories);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get judge profile by userId
   */
  static async getJudgeByUserId(req: Request, res: Response) {
    try {
      const userId = req.params.userId as string;
      let judge = await prisma.judge.findUnique({ where: { userId } });
      
      // Auto-create judge profile if user has JUDGE role
      if (!judge) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.role === 'JUDGE') {
          judge = await prisma.judge.create({
            data: { userId, name: user.name }
          });
        }
      }
      
      if (!judge) {
        return res.status(404).json({ error: 'Perfil de árbitro não encontrado' });
      }
      
      res.json(judge);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
