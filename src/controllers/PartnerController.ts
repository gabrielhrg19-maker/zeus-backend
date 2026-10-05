import { Request, Response } from 'express';
import { prisma } from '../prisma';

let tableChecked = false;
async function ensurePartnerTable() {
    if (tableChecked) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Partner" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "category" TEXT DEFAULT 'Parceiro Oficial',
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
        console.warn('[Partner] ensurePartnerTable check:', e?.message || e);
    }
}

export class PartnerController {
    static async list(req: Request, res: Response) {
        try {
            await ensurePartnerTable();
            const list = await (prisma as any).partner.findMany({
                orderBy: [
                    { order: 'asc' },
                    { createdAt: 'asc' }
                ]
            });
            res.json(list);
        } catch (error) {
            console.error('[Partner] Erro ao listar parceiros:', error);
            res.status(500).json({ error: 'Erro ao listar parceiros' });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            await ensurePartnerTable();
            const { name, category, image, whatsapp, instagram, website, order } = req.body;

            if (!name || !image) {
                return res.status(400).json({ error: 'Nome e logo/foto do parceiro são obrigatórios.' });
            }

            const partner = await (prisma as any).partner.create({
                data: {
                    name: name.trim(),
                    category: category ? category.trim() : 'Parceiro Oficial',
                    image: image.trim(),
                    whatsapp: whatsapp ? whatsapp.trim() : null,
                    instagram: instagram ? instagram.trim() : null,
                    website: website ? website.trim() : null,
                    order: typeof order === 'number' ? order : parseInt(order) || 0,
                }
            });

            res.status(201).json(partner);
        } catch (error) {
            console.error('[Partner] Erro ao criar parceiro:', error);
            res.status(500).json({ error: 'Erro ao criar parceiro' });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            await ensurePartnerTable();
            const id = req.params.id as string;
            const { name, category, image, whatsapp, instagram, website, order } = req.body;

            const existing = await (prisma as any).partner.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Parceiro não encontrado.' });
            }

            const updated = await (prisma as any).partner.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name: name.trim() }),
                    ...(category !== undefined && { category: category ? category.trim() : 'Parceiro Oficial' }),
                    ...(image !== undefined && { image: image.trim() }),
                    ...(whatsapp !== undefined && { whatsapp: whatsapp ? whatsapp.trim() : null }),
                    ...(instagram !== undefined && { instagram: instagram ? instagram.trim() : null }),
                    ...(website !== undefined && { website: website ? website.trim() : null }),
                    ...(order !== undefined && { order: typeof order === 'number' ? order : parseInt(order) || 0 }),
                }
            });

            res.json(updated);
        } catch (error) {
            console.error('[Partner] Erro ao atualizar parceiro:', error);
            res.status(500).json({ error: 'Erro ao atualizar parceiro' });
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            await ensurePartnerTable();
            const id = req.params.id as string;
            await (prisma as any).partner.delete({ where: { id } });
            res.json({ message: 'Parceiro excluído com sucesso.' });
        } catch (error) {
            console.error('[Partner] Erro ao excluir parceiro:', error);
            res.status(500).json({ error: 'Erro ao excluir parceiro' });
        }
    }
}
