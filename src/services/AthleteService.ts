import { prisma } from '../prisma';

export class AthleteService {
  /**
   * Defines the category class and max weight based on height
   * Rules from Classic_Physique_Regras_Ajustadas_V4.pdf
   */
  static getClassicPhysiqueCategory(heightCm: number): { className: string; maxWeightKg: number } {
    if (heightCm <= 170.0) {
      if (heightCm <= 163.0) return { className: 'A', maxWeightKg: 76.0 };
      if (heightCm <= 165.0) return { className: 'A', maxWeightKg: 78.0 };
      if (heightCm <= 168.0) return { className: 'A', maxWeightKg: 80.0 };
      return { className: 'A', maxWeightKg: 83.0 };
    } else if (heightCm <= 178.0) {
      if (heightCm <= 173.0) return { className: 'B', maxWeightKg: 85.0 };
      if (heightCm <= 175.0) return { className: 'B', maxWeightKg: 88.0 };
      return { className: 'B', maxWeightKg: 92.0 };
    } else if (heightCm <= 183.0) {
      if (heightCm <= 180.0) return { className: 'C', maxWeightKg: 95.0 };
      return { className: 'C', maxWeightKg: 98.0 };
    } else {
      if (heightCm <= 185.0) return { className: 'D', maxWeightKg: 102.0 };
      if (heightCm <= 188.0) return { className: 'D', maxWeightKg: 105.0 };
      if (heightCm <= 191.0) return { className: 'D', maxWeightKg: 108.0 };
      if (heightCm <= 193.0) return { className: 'D', maxWeightKg: 112.0 };
      if (heightCm <= 196.0) return { className: 'D', maxWeightKg: 115.0 };
      if (heightCm <= 198.0) return { className: 'D', maxWeightKg: 118.0 };
      if (heightCm <= 201.0) return { className: 'D', maxWeightKg: 121.0 };
      return { className: 'D', maxWeightKg: 124.0 };
    }
  }

  static async registerAthlete(data: {
    userId?: string;
    name: string;
    height: number;
    weight: number;
    birthDate: Date;
    championshipId: string;
  }) {
    const { className, maxWeightKg } = this.getClassicPhysiqueCategory(data.height);

    // Find or create category for this championship
    let category = await prisma.category.findFirst({
      where: {
        championshipId: data.championshipId,
        name: `Classic Physique ${className}`
      }
    });

    if (!category) {
      // Get default poses for Classic Physique A/B/C/D
      const poses = [
        "Duplo Bíceps de Frente",
        "Expansão de Tórax de Perfil",
        "Duplo Bíceps de Costas",
        "Abdominais e Coxas",
        "Pose Clássica Favorita"
      ];

      category = await prisma.category.create({
        data: {
          name: `Classic Physique ${className}`,
          championshipId: data.championshipId,
          maxWeight: maxWeightKg,
          poses
        }
      });
    }

    // Find initial stage (Check-in / Portaria)
    const initialStage = await prisma.stage.findFirst({
      where: { championshipId: data.championshipId, order: 1 }
    });

    // Auto-assign sequential competitor number
    const lastAthlete = await prisma.athlete.findFirst({
      where: { championshipId: data.championshipId },
      orderBy: { athleteNumber: 'desc' },
      select: { athleteNumber: true }
    });
    const nextNumber = lastAthlete && lastAthlete.athleteNumber ? lastAthlete.athleteNumber + 1 : 1;

    return await prisma.athlete.create({
      data: {
        userId: data.userId,
        name: data.name,
        height: data.height,
        weight: data.weight,
        athleteNumber: nextNumber,
        birthDate: data.birthDate,
        championshipId: data.championshipId,
        categoryId: category.id,
        currentStageId: initialStage?.id,
        status: 'ACTIVE'
      }
    });
  }

  static async advanceStage(athleteId: string, validatedById: string, details?: string) {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { currentStage: true }
    });

    if (!athlete || !athlete.currentStage) {
      throw new Error('Athlete or current stage not found');
    }

    const nextStage = await prisma.stage.findFirst({
      where: {
        championshipId: athlete.championshipId,
        order: athlete.currentStage.order + 1
      }
    });

    if (!nextStage) {
      // If no next stage, mark as FINISHED
      return await prisma.athlete.update({
        where: { id: athleteId },
        data: {
          status: 'FINISHED',
          logs: {
            create: {
              stageId: athlete.currentStageId!,
              action: 'COMPLETED',
              validatedById,
              details: details || 'Completed final stage'
            }
          }
        }
      });
    }

    return await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        currentStageId: nextStage.id,
        logs: {
          create: [
            {
              stageId: athlete.currentStageId!,
              action: 'COMPLETED',
              validatedById,
              details
            },
            {
              stageId: nextStage.id,
              action: 'ENTERED',
              validatedById,
              details: `Advanced from ${athlete.currentStage.name}`
            }
          ]
        }
      }
    });
  }

  static async getDashboardStats(championshipId: string) {
    const stages = await prisma.stage.findMany({
      where: { championshipId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { athletes: true }
        }
      }
    });

    const athletes = await prisma.athlete.findMany({
      where: { championshipId },
      include: {
        category: true,
        currentStage: true
      }
    });

    return {
      stages: stages.map((s: any) => ({
        name: s.name,
        count: s._count.athletes
      })),
      athletes: athletes.map((a: any) => ({
        id: a.id,
        name: a.name,
        category: a.category?.name,
        stage: a.currentStage?.name || 'Finished',
        status: a.status
      }))
    };
  }
}
