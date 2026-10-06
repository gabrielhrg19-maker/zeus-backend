import { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';

const storage = multer.memoryStorage();

const uploadAnyMiddleware = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            return cb(null, true);
        }
        cb(new Error('Apenas arquivos de imagem são permitidos!'));
    }
}).any();

function getUploadedFile(req: Request): Express.Multer.File | undefined {
    if (req.file) return req.file;
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        return req.files[0];
    }
    return undefined;
}

let uploadTableChecked = false;
async function ensureUploadTable() {
    if (uploadTableChecked) return;
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'geral';
        `);
        uploadTableChecked = true;
    } catch (e: any) {
        console.warn('[Upload] ensureUploadTable error:', e?.message || e);
    }
}

export class UploadController {
    static async uploadBanner(req: Request, res: Response) {
        await ensureUploadTable();
        uploadAnyMiddleware(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Erro no upload: ' + err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }

            const file = getUploadedFile(req);
            if (!file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            try {
                const category = req.body.category || 'banner';
                const record = await prisma.upload.create({
                    data: {
                        filename: file.originalname,
                        mimeType: file.mimetype,
                        data: file.buffer,
                        category: category,
                    }
                });

                const fileUrl = `/api/uploads/${record.id}`;
                res.json({ id: record.id, url: fileUrl, filename: record.filename, category: record.category });
            } catch (dbErr: any) {
                console.error('[Upload] Erro ao salvar no banco:', dbErr);
                res.status(500).json({ error: 'Erro ao salvar imagem no banco de dados' });
            }
        });
    }

    static async uploadImage(req: Request, res: Response) {
        await ensureUploadTable();
        uploadAnyMiddleware(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Erro no upload: ' + err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }

            const file = getUploadedFile(req);
            if (!file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            try {
                const category = req.body.category || (req.query.category as string) || 'geral';
                const record = await prisma.upload.create({
                    data: {
                        filename: file.originalname,
                        mimeType: file.mimetype,
                        data: file.buffer,
                        category: category,
                    }
                });

                const fileUrl = `/api/uploads/${record.id}`;
                res.json({ id: record.id, url: fileUrl, filename: record.filename, category: record.category, createdAt: record.createdAt });
            } catch (dbErr: any) {
                console.error('[Upload] Erro ao salvar no banco:', dbErr);
                res.status(500).json({ error: 'Erro ao salvar imagem no banco de dados' });
            }
        });
    }

    static async listUploads(req: Request, res: Response) {
        try {
            await ensureUploadTable();
            const { category } = req.query;
            const whereClause: any = {};
            if (category && category !== 'todos') {
                whereClause.category = String(category);
            }

            const uploads = await prisma.upload.findMany({
                where: whereClause,
                select: {
                    id: true,
                    filename: true,
                    mimeType: true,
                    category: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            });

            const list = uploads.map(u => ({
                id: u.id,
                filename: u.filename,
                mimeType: u.mimeType,
                category: u.category || 'geral',
                url: `/api/uploads/${u.id}`,
                createdAt: u.createdAt
            }));

            res.json(list);
        } catch (err) {
            console.error('[Upload] Erro ao listar imagens:', err);
            res.status(500).json({ error: 'Erro ao listar imagens' });
        }
    }

    static async updateUpload(req: Request, res: Response) {
        await ensureUploadTable();
        uploadAnyMiddleware(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Erro no upload: ' + err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }

            try {
                const id = req.params.id as string;
                const { filename, category } = req.body;

                const existing = await prisma.upload.findUnique({ where: { id } });
                if (!existing) {
                    return res.status(404).json({ error: 'Imagem não encontrada' });
                }

                const file = getUploadedFile(req);
                const dataToUpdate: any = {};
                if (filename && filename.trim()) {
                    dataToUpdate.filename = filename.trim();
                }
                if (category && category.trim()) {
                    dataToUpdate.category = category.trim();
                }
                if (file) {
                    dataToUpdate.data = file.buffer;
                    dataToUpdate.mimeType = file.mimetype;
                    if (!filename) {
                        dataToUpdate.filename = file.originalname;
                    }
                }

                const updated = await prisma.upload.update({
                    where: { id },
                    data: dataToUpdate,
                    select: {
                        id: true,
                        filename: true,
                        mimeType: true,
                        category: true,
                        createdAt: true
                    }
                });

                res.json({
                    id: updated.id,
                    filename: updated.filename,
                    mimeType: updated.mimeType,
                    category: updated.category || 'geral',
                    url: `/api/uploads/${updated.id}`,
                    createdAt: updated.createdAt
                });
            } catch (error: any) {
                console.error('[Upload] Erro ao atualizar imagem:', error);
                res.status(500).json({ error: 'Erro ao atualizar imagem' });
            }
        });
    }

    static async deleteUpload(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            await prisma.upload.delete({ where: { id } });
            res.json({ message: 'Imagem excluída com sucesso' });
        } catch (err) {
            console.error('[Upload] Erro ao deletar imagem:', err);
            res.status(500).json({ error: 'Erro ao excluir imagem' });
        }
    }

    static async serveImage(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const record = await prisma.upload.findUnique({ where: { id } });

            if (!record) {
                return res.status(404).json({ error: 'Imagem não encontrada' });
            }

            res.set('Content-Type', record.mimeType);
            res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
            res.send(record.data);
        } catch (err) {
            console.error('[Upload] Erro ao servir imagem:', err);
            res.status(500).json({ error: 'Erro ao buscar imagem' });
        }
    }
}
