import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Não autorizado' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !['ADMIN', 'SUPPORT', 'TICKETER', 'JUDGE'].includes(user.role)) {
            return res.status(403).json({ error: 'Acesso negado: Requer privilégios administrativos ou de suporte militar' });
        }

        (req as any).userRole = user.role; // Pass role down to controllers
        next();
    } catch (e) {
        res.status(500).json({ error: 'Erro ao validar privilégios' });
    }
};
