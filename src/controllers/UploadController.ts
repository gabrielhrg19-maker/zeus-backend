import { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';

const storage = multer.memoryStorage();

const uploadImageMiddleware = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            return cb(null, true);
        }
        cb(new Error('Apenas arquivos de imagem são permitidos!'));
    }
}).single('file');

const uploadBannerMiddleware = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            return cb(null, true);
        }
        cb(new Error('Apenas arquivos de imagem são permitidos!'));
    }
}).single('banner');

export class UploadController {
    static async uploadBanner(req: Request, res: Response) {
        uploadBannerMiddleware(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Erro no upload: ' + err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            try {
                const record = await prisma.upload.create({
                    data: {
                        filename: req.file.originalname,
                        mimeType: req.file.mimetype,
                        data: req.file.buffer,
                    }
                });

                const fileUrl = `/api/uploads/${record.id}`;
                res.json({ id: record.id, url: fileUrl, filename: record.filename });
            } catch (dbErr: any) {
                console.error('[Upload] Erro ao salvar no banco:', dbErr);
                res.status(500).json({ error: 'Erro ao salvar imagem no banco de dados' });
            }
        });
    }

    static async uploadImage(req: Request, res: Response) {
        uploadImageMiddleware(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Erro no upload: ' + err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            try {
                const record = await prisma.upload.create({
                    data: {
                        filename: req.file.originalname,
                        mimeType: req.file.mimetype,
                        data: req.file.buffer,
                    }
                });

                const fileUrl = `/api/uploads/${record.id}`;
                res.json({ id: record.id, url: fileUrl, filename: record.filename, createdAt: record.createdAt });
            } catch (dbErr: any) {
                console.error('[Upload] Erro ao salvar no banco:', dbErr);
                res.status(500).json({ error: 'Erro ao salvar imagem no banco de dados' });
            }
        });
    }

    static async listUploads(req: Request, res: Response) {
        try {
            const uploads = await prisma.upload.findMany({
                select: {
                    id: true,
                    filename: true,
                    mimeType: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            });

            const list = uploads.map(u => ({
                id: u.id,
                filename: u.filename,
                mimeType: u.mimeType,
                url: `/api/uploads/${u.id}`,
                createdAt: u.createdAt
            }));

            res.json(list);
        } catch (err) {
            console.error('[Upload] Erro ao listar imagens:', err);
            res.status(500).json({ error: 'Erro ao listar imagens' });
        }
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
