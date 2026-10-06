import { Request, Response } from 'express';
import { prisma } from '../prisma';

let tableChecked = false;
async function ensureSponsorTable() {
    if (tableChecked) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Sponsor" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "tier" TEXT DEFAULT 'Patrocinador Oficial',
                "image" TEXT NOT NULL,
                "whatsapp" TEXT,
                "instagram" TEXT,
                "website" TEXT,
                "order" INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        tableChecked = true;
    } catch (e: any) {
        console.warn('[Sponsor] ensureSponsorTable check:', e?.message || e);
    }
}

export class SponsorController {
    static async list(req: Request, res: Response) {
        try {
            await ensureSponsorTable();
            const list = await (prisma as any).sponsor.findMany({
                orderBy: [
                    { order: 'asc' },
                    { createdAt: 'asc' }
                ]
            });
            res.json(list);
        } catch (error) {
            console.error('[Sponsor] Erro ao listar patrocinadores:', error);
            res.status(500).json({ error: 'Erro ao listar patrocinadores' });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            await ensureSponsorTable();
            const { name, tier, image, whatsapp, instagram, website, order } = req.body;

            if (!name || !image) {
                return res.status(400).json({ error: 'Nome e logo/foto do patrocinador são obrigatórios.' });
            }

            const sponsor = await (prisma as any).sponsor.create({
                data: {
                    name: name.trim(),
                    tier: tier ? tier.trim() : 'Patrocinador Oficial',
                    image: image.trim(),
                    whatsapp: whatsapp ? whatsapp.trim() : null,
                    instagram: instagram ? instagram.trim() : null,
                    website: website ? website.trim() : null,
                    order: typeof order === 'number' ? order : parseInt(order) || 0,
                }
            });

            res.status(201).json(sponsor);
        } catch (error) {
            console.error('[Sponsor] Erro ao criar patrocinador:', error);
            res.status(500).json({ error: 'Erro ao criar patrocinador' });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            await ensureSponsorTable();
            const id = req.params.id as string;
            const { name, tier, image, whatsapp, instagram, website, order } = req.body;

            const existing = await (prisma as any).sponsor.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Patrocinador não encontrado.' });
            }

            const updated = await (prisma as any).sponsor.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name: name.trim() }),
                    ...(tier !== undefined && { tier: tier ? tier.trim() : 'Patrocinador Oficial' }),
                    ...(image !== undefined && { image: image.trim() }),
                    ...(whatsapp !== undefined && { whatsapp: whatsapp ? whatsapp.trim() : null }),
                    ...(instagram !== undefined && { instagram: instagram ? instagram.trim() : null }),
                    ...(website !== undefined && { website: website ? website.trim() : null }),
                    ...(order !== undefined && { order: typeof order === 'number' ? order : parseInt(order) || 0 }),
                }
            });

            res.json(updated);
        } catch (error) {
            console.error('[Sponsor] Erro ao atualizar patrocinador:', error);
            res.status(500).json({ error: 'Erro ao atualizar patrocinador' });
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            await ensureSponsorTable();
            const id = req.params.id as string;
            await (prisma as any).sponsor.delete({ where: { id } });
            res.json({ message: 'Patrocinador excluído com sucesso.' });
        } catch (error) {
            console.error('[Sponsor] Erro ao excluir patrocinador:', error);
            res.status(500).json({ error: 'Erro ao excluir patrocinador' });
        }
    }
}
