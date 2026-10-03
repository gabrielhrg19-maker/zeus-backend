import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { slugify, generateUniqueChampionshipSlug } from '../utils/slug';

const stripSecrets = (c: any) => {
    const {
        mpAccessToken,
        mpWebhookSecret,
        mpFedAccessToken,
        mpFedWebhookSecret,
        mpPublicKey,
        ...safeData
    } = c;

    // Só entrega a Public Key própria do evento quando há o PAR COMPLETO
    // (Public Key + Access Token). Sem o par, o frontend cai no VITE_env e o
    // backend cai no .env — sempre a MESMA conta — evitando "Invalid credentials".
    const hasOwnPair = !!(mpAccessToken && mpPublicKey);

    return {
        ...safeData,
        mpPublicKey: hasOwnPair ? mpPublicKey : null,
    };
};

export class ChampionshipController {
    static async list(req: Request, res: Response) {
        try {
            const champs = await prisma.championship.findMany({
                orderBy: { date: 'asc' },
                include: { categories: { orderBy: { name: 'asc' } } }
            });

            // Backfill: garante que campeonatos antigos (sem slug) recebam um.
            for (const c of champs) {
                if (!c.slug) {
                    const slug = await generateUniqueChampionshipSlug(c.name, c.id);
                    await prisma.championship.update({ where: { id: c.id }, data: { slug } });
                    c.slug = slug;
                }
            }

            res.json(champs.map(stripSecrets));
        } catch (e) {
            res.status(500).json({ error: 'Erro ao listar campeonatos' });
        }
    }

    static async getBySlug(req: Request, res: Response) {
        try {
            const slugParam = slugify(req.params.slug as string);

            let champ = await prisma.championship.findUnique({
                where: { slug: slugParam },
                include: { categories: { orderBy: { name: 'asc' } } }
            });

            // Fallback: tenta casar pelo nome/cidade "slugificados" (campeonatos antigos).
            if (!champ) {
                const all = await prisma.championship.findMany({
                    include: { categories: { orderBy: { name: 'asc' } } }
                });
                champ = all.find(c =>
                    slugify(c.name) === slugParam || slugify(c.location) === slugParam
                ) || null;
            }

            if (!champ) return res.status(404).json({ error: 'Campeonato não encontrado' });

            res.json(stripSecrets(champ));
        } catch (e) {
            res.status(500).json({ error: 'Erro ao buscar campeonato' });
        }
    }

    static async getById(req: Request, res: Response) {
        try {
            const champ = await prisma.championship.findUnique({
                where: { id: req.params.id as string }
            });
            if (!champ) return res.status(404).json({ error: 'Campeonato não encontrado' });

            res.json(stripSecrets(champ));
        } catch (e) {
            res.status(500).json({ error: 'Erro ao buscar campeonato' });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const data = { ...req.body };
            
            // Converter data para objeto Date se vier como string
            if (data.date && typeof data.date === 'string') {
                data.date = new Date(data.date);
            }

            // Gera slug a partir do que o admin informou ou do nome do evento.
            data.slug = await generateUniqueChampionshipSlug(data.slug || data.name || 'evento');

            const champ = await prisma.championship.create({ data });

            // Auto-create default stages for the new championship
            const defaultStages = [
                { name: 'Portaria', order: 1, championshipId: champ.id },
                { name: 'Pintura', order: 2, championshipId: champ.id },
                { name: 'Backstage', order: 3, championshipId: champ.id },
                { name: 'Palco', order: 4, championshipId: champ.id },
                { name: 'Finalizado', order: 5, championshipId: champ.id },
            ];
            await prisma.stage.createMany({ data: defaultStages });

            res.json(stripSecrets(champ));
        } catch (e) {
            console.error('[ChampionshipController] Erro ao criar campeonato:', e);
            res.status(500).json({ error: 'Erro ao criar campeonato' });
        }
    }
}
