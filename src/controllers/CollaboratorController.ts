import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class CollaboratorController {
    static async list(req: Request, res: Response) {
        try {
            const list = await prisma.collaborator.findMany({
                orderBy: [
                    { order: 'asc' },
                    { createdAt: 'asc' }
                ]
            });
            res.json(list);
        } catch (error) {
            console.error('[Collaborator] Erro ao listar colaboradores:', error);
            res.status(500).json({ error: 'Erro ao listar colaboradores' });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const { name, role, image, order, duration } = req.body;

            if (!name || !role || !image) {
                return res.status(400).json({ error: 'Nome, cargo e foto são obrigatórios' });
            }

            const collaborator = await prisma.collaborator.create({
                data: {
                    name: name.trim(),
                    role: role.trim(),
                    image: image.trim(),
                    order: typeof order === 'number' ? order : 0,
                    duration: typeof duration === 'number' ? duration : 5000,
                }
            });

            res.status(201).json(collaborator);
        } catch (error) {
            console.error('[Collaborator] Erro ao criar colaborador:', error);
            res.status(500).json({ error: 'Erro ao criar colaborador' });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const { name, role, image, order, duration } = req.body;

            const existing = await prisma.collaborator.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Colaborador não encontrado' });
            }

            const updated = await prisma.collaborator.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name: name.trim() }),
                    ...(role !== undefined && { role: role.trim() }),
                    ...(image !== undefined && { image: image.trim() }),
                    ...(order !== undefined && { order: typeof order === 'number' ? order : parseInt(order) || 0 }),
                    ...(duration !== undefined && { duration: typeof duration === 'number' ? duration : parseInt(duration) || 5000 }),
                }
            });

            res.json(updated);
        } catch (error) {
            console.error('[Collaborator] Erro ao atualizar colaborador:', error);
            res.status(500).json({ error: 'Erro ao atualizar colaborador' });
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            await prisma.collaborator.delete({ where: { id } });
            res.json({ message: 'Colaborador excluído com sucesso' });
        } catch (error) {
            console.error('[Collaborator] Erro ao excluir colaborador:', error);
            res.status(500).json({ error: 'Erro ao excluir colaborador' });
        }
    }
}
