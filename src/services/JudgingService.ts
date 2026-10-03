import { prisma } from '../prisma';
import { emitEvent } from '../socket';

export class JudgingService {

  /**
   * Get or create a JudgingSession for a judge working on a category
   */
  static async getOrCreateSession(data: {
    championshipId: string;
    categoryId: string;
    judgeId: string;
  }) {
    let session = await prisma.judgingSession.findUnique({
      where: {
        championshipId_categoryId_judgeId: {
          championshipId: data.championshipId,
          categoryId: data.categoryId,
          judgeId: data.judgeId,
        }
      },
      include: {
        scores: { include: { athlete: true } },
        category: true,
      }
    });

    if (!session) {
      session = await prisma.judgingSession.create({
        data: {
          championshipId: data.championshipId,
          categoryId: data.categoryId,
          judgeId: data.judgeId,
          status: 'SCORING',
        },
        include: {
          scores: { include: { athlete: true } },
          category: true,
        }
      });
    }

    return session;
  }

  /**
   * Submit a single score within a session
   */
  static async submitScore(data: {
    athleteId: string;
    judgeId: string;
    categoryId: string;
    championshipId: string;
    value: number;
    poseName?: string;
  }) {
    // Validate score range
    if (data.value < 1) {
      throw new Error('Colocação deve ser maior ou igual a 1');
    }

    // Ensure session exists and is in SCORING state
    const session = await this.getOrCreateSession({
      championshipId: data.championshipId,
      categoryId: data.categoryId,
      judgeId: data.judgeId,
    });

    if (session.status !== 'SCORING') {
      throw new Error(`Sessão já foi ${session.status === 'SUBMITTED' ? 'submetida' : 'aprovada'}. Não é possível alterar notas.`);
    }

    // Upsert: update if score already exists for this athlete+judge+category+session
    const existingScore = await prisma.score.findFirst({
      where: {
        athleteId: data.athleteId,
        judgeId: data.judgeId,
        categoryId: data.categoryId,
        sessionId: session.id,
        poseName: data.poseName || null,
      }
    });

    if (existingScore) {
      return await prisma.score.update({
        where: { id: existingScore.id },
        data: { value: data.value },
      });
    }

    return await prisma.score.create({
      data: {
        athleteId: data.athleteId,
        judgeId: data.judgeId,
        categoryId: data.categoryId,
        sessionId: session.id,
        poseName: data.poseName || null,
        value: data.value,
        round: 1,
      }
    });
  }

  /**
   * Submit batch scores for all athletes in a category and finalize session
   */
  static async submitBatchScores(data: {
    judgeId: string;
    categoryId: string;
    championshipId: string;
    scores: { athleteId: string; value: number; poseName?: string }[];
  }) {
    // Validate all scores
    for (const s of data.scores) {
      if (s.value < 1) {
        throw new Error(`Colocação inválida (${s.value}) para atleta. Deve ser maior ou igual a 1.`);
      }
    }

    const session = await this.getOrCreateSession({
      championshipId: data.championshipId,
      categoryId: data.categoryId,
      judgeId: data.judgeId,
    });

    if (session.status !== 'SCORING') {
      throw new Error('Sessão já finalizada. Não é possível reenviar notas.');
    }

    // Delete any existing scores for this session, then create all new ones
    await prisma.score.deleteMany({
      where: { sessionId: session.id }
    });

    await prisma.score.createMany({
      data: data.scores.map(s => ({
        athleteId: s.athleteId,
        judgeId: data.judgeId,
        categoryId: data.categoryId,
        sessionId: session.id,
        poseName: s.poseName || null,
        value: s.value,
        round: 1,
      }))
    });

    // Update session status to SUBMITTED
    const updatedSession = await prisma.judgingSession.update({
      where: { id: session.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: {
        scores: { include: { athlete: true } },
        category: true,
      }
    });

    // Emit WebSocket event
    emitEvent.scoresSubmitted(data.championshipId, {
        judgeId: data.judgeId,
        categoryId: data.categoryId,
        status: 'SUBMITTED'
    });

    return updatedSession;
  }

  /**
   * Get all sessions for a championship (admin overview)
   */
  static async getSessionsForChampionship(championshipId: string) {
    const sessions = await prisma.judgingSession.findMany({
      where: { championshipId },
      include: {
        category: true,
        judge: { include: { user: { select: { name: true } } } },
        scores: {
          include: {
            athlete: { select: { id: true, name: true } },
          }
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { createdAt: 'asc' }],
    });

    return sessions;
  }

  /**
   * Get sessions for a specific judge in a championship
   */
  static async getJudgeSessions(championshipId: string, judgeId: string) {
    return await prisma.judgingSession.findMany({
      where: { championshipId, judgeId },
      include: {
        category: true,
        scores: { include: { athlete: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update session status (admin action)
   */
  static async updateSessionStatus(
    sessionId: string,
    newStatus: 'SCORING' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED',
    adminUserId?: string,
    rejectionReason?: string
  ) {
    const session = await prisma.judgingSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error('Sessão não encontrada');

    // State machine validation
    const validTransitions: Record<string, string[]> = {
      'SCORING': ['SUBMITTED'],
      'SUBMITTED': ['APPROVED', 'SCORING'], // Can approve or reject (back to scoring)
      'APPROVED': ['PUBLISHED', 'SUBMITTED'], // Can publish or demote
      'PUBLISHED': ['APPROVED'], // Can unpublish
    };

    if (!validTransitions[session.status]?.includes(newStatus)) {
      throw new Error(`Transição inválida: ${session.status} → ${newStatus}`);
    }

    const updateData: any = { status: newStatus };

    if (newStatus === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = adminUserId;
      updateData.rejectionReason = null;
    } else if (newStatus === 'PUBLISHED') {
      updateData.publishedAt = new Date();
    } else if (newStatus === 'SCORING') {
      // Rejection - reset timestamps
      updateData.submittedAt = null;
      updateData.approvedAt = null;
      updateData.approvedBy = null;
      updateData.publishedAt = null;
      updateData.rejectionReason = rejectionReason || 'Devolvido para revisão';
    }

    const updatedSession = await prisma.judgingSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        category: true,
        judge: { include: { user: { select: { name: true } } } },
        scores: { include: { athlete: true } },
      }
    });

    // Emit WebSocket event
    emitEvent.sessionUpdated(updatedSession.championshipId, {
        sessionId: updatedSession.id,
        categoryId: updatedSession.categoryId,
        status: newStatus
    });

    return updatedSession;
  }

  /**
   * Bulk approve/publish all sessions for a category
   */
  static async bulkUpdateCategoryStatus(
    championshipId: string,
    categoryId: string,
    newStatus: 'APPROVED' | 'PUBLISHED',
    adminUserId: string
  ) {
    const sourceStatus = newStatus === 'APPROVED' ? 'SUBMITTED' : 'APPROVED';

    const sessions = await prisma.judgingSession.findMany({
      where: { championshipId, categoryId, status: sourceStatus }
    });

    const updateData: any = { status: newStatus };
    if (newStatus === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = adminUserId;
    } else if (newStatus === 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }

    await prisma.judgingSession.updateMany({
      where: { championshipId, categoryId, status: sourceStatus },
      data: updateData,
    });

    // If publishing, also calculate and store results
    if (newStatus === 'PUBLISHED') {
      await this.calculateAndStoreResults(categoryId);
      emitEvent.resultsPublished(championshipId, { categoryId });
    }

    // Emit global refresh
    emitEvent.dataRefresh('judging_status');

    return { updated: sessions.length };
  }

  /**
   * Calculate ranking using simple arithmetic mean
   */
  static async calculateRanking(categoryId: string) {
    const athletes = await prisma.athlete.findMany({
      where: { categoryId },
      include: {
        scores: {
          where: { categoryId },
          include: { judge: { include: { user: { select: { name: true } } } } }
        }
      }
    });

    const results = athletes.map(athlete => {
      const scores = athlete.scores.map(s => s.value);
      let totalSum = 0;

      if (scores.length > 0) {
        // Sum of all rankings
        totalSum = scores.reduce((a, b) => a + b, 0);
      } else {
        // If no scores submitted yet, default to a high sum to rank lower
        totalSum = 999;
      }

      const masterScore = athlete.scores.find(s => s.judge?.isMaster)?.value ?? null;

      return {
        athleteId: athlete.id,
        name: athlete.name,
        athleteNumber: athlete.athleteNumber,
        averageScore: totalSum, // averageScore is the DB field used for storing the score (lower is better)
        scoreCount: scores.length,
        scores: athlete.scores.map(s => ({
          judgeId: s.judgeId,
          judgeName: s.judge?.user?.name || 'Árbitro',
          isMaster: s.judge?.isMaster || false,
          value: s.value,
        })),
        masterScore
      };
    });

    return results.sort((a, b) => {
      // 1. Sort by total sum (ascending - lower sum wins)
      if (a.averageScore !== b.averageScore) {
        return a.averageScore - b.averageScore;
      }
      // 2. If tied, sort by master judge's score (ascending - lower placement wins)
      const masterA = a.masterScore ?? 999;
      const masterB = b.masterScore ?? 999;
      return masterA - masterB;
    });
  }

  /**
   * Calculate and persist results to the Result table
   */
  static async calculateAndStoreResults(categoryId: string) {
    const ranking = await this.calculateRanking(categoryId);

    // Delete existing results for this category
    await prisma.result.deleteMany({ where: { categoryId } });

    // Create new results in batch
    await prisma.result.createMany({
      data: ranking.map((r, i) => ({
        categoryId,
        athleteId: r.athleteId,
        rank: i + 1,
        averageScore: r.averageScore,
        isPublished: true,
      }))
    });

    return ranking;
  }

  /**
   * Get published results for public view
   */
  static async getPublishedResults(championshipId: string) {
    // Get all categories with at least one PUBLISHED session
    const publishedSessions = await prisma.judgingSession.findMany({
      where: { championshipId, status: 'PUBLISHED' },
      select: { categoryId: true },
      distinct: ['categoryId'],
    });

    const publishedCategoryIds = publishedSessions.map(s => s.categoryId);

    if (publishedCategoryIds.length === 0) return [];

    const categories = await prisma.category.findMany({
      where: { id: { in: publishedCategoryIds } },
      include: {
        results: {
          where: { isPublished: true },
          include: { athlete: { select: { id: true, name: true, athleteNumber: true } } },
          orderBy: { rank: 'asc' },
        }
      }
    });

    return categories.map(cat => ({
      categoryId: cat.id,
      categoryName: cat.name,
      parentName: cat.parentName,
      results: cat.results.map(r => ({
        rank: r.rank,
        athleteId: r.athlete.id,
        name: r.athlete.name,
        athleteNumber: r.athlete.athleteNumber,
        averageScore: r.averageScore,
      })),
    }));
  }

  /**
   * Get aggregated status for each category in a championship
   */
  static async getCategoryJudgingStatus(championshipId: string) {
    const categories = await prisma.category.findMany({
      where: { 
        championshipId,
        athletes: { some: {} } // Only categories with at least one athlete
      },
      include: {
        athletes: { select: { id: true, name: true } },
        judgingSessions: {
          include: {
            judge: { include: { user: { select: { name: true } } } },
            scores: { include: { athlete: { select: { id: true, name: true } } } },
          }
        }
      }
    });

    return categories.map(cat => {
      const sessions = cat.judgingSessions;
      const statusCounts = {
        SCORING: sessions.filter(s => s.status === 'SCORING').length,
        SUBMITTED: sessions.filter(s => s.status === 'SUBMITTED').length,
        APPROVED: sessions.filter(s => s.status === 'APPROVED').length,
        PUBLISHED: sessions.filter(s => s.status === 'PUBLISHED').length,
      };

      // Determine aggregate status
      let aggregateStatus = 'WAITING'; // No sessions yet
      if (sessions.length > 0) {
        if (statusCounts.PUBLISHED > 0 && statusCounts.PUBLISHED === sessions.length) {
          aggregateStatus = 'PUBLISHED';
        } else if (statusCounts.APPROVED > 0 && statusCounts.APPROVED === sessions.length) {
          aggregateStatus = 'APPROVED';
        } else if (statusCounts.SUBMITTED > 0 && (statusCounts.SUBMITTED + statusCounts.APPROVED + statusCounts.PUBLISHED) === sessions.length) {
          aggregateStatus = 'SUBMITTED';
        } else {
          aggregateStatus = 'SCORING';
        }
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        athleteCount: cat.athletes.length,
        athletes: cat.athletes,
        sessionCount: sessions.length,
        statusCounts,
        aggregateStatus,
        sessions: sessions.map(s => ({
          id: s.id,
          judgeId: s.judgeId,
          judgeName: s.judge?.user?.name || 'Árbitro',
          isMaster: s.judge?.isMaster || false,
          status: s.status,
          submittedAt: s.submittedAt,
          approvedAt: s.approvedAt,
          rejectionReason: s.rejectionReason,
          scores: s.scores.map(sc => ({
            athleteId: sc.athleteId,
            athleteName: sc.athlete.name,
            value: sc.value,
          })),
        })),
      };
    });
  }
}
