import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class CreditCardController {
    static async list(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) return res.status(401).json({ error: 'Não autorizado' });

            const cards = await prisma.creditCard.findMany({
                where: { userId }
            });
            res.json(cards);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao listar cartões' });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) return res.status(401).json({ error: 'Não autorizado' });

            return res.status(501).json({ error: 'O salvamento de cartão foi desativado em favor do checkout unificado do Mercado Pago.' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Erro ao processar a requisição' });
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const cardId = req.params.id as string;

            if (!userId) return res.status(401).json({ error: 'Não autorizado' });

            await prisma.creditCard.delete({
                where: { id: cardId }
            });

            res.status(204).send();
        } catch (e) {
            res.status(500).json({ error: 'Erro ao deletar cartão' });
        }
    }
}
