import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { PdfService } from '../services/pdf.service';

export class TicketController {
    static async listByUser(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const tickets = await prisma.ticket.findMany({
                where: { order: { userId } },
                include: {
                    order: {
                        include: { championship: { include: { categories: true } } }
                    },
                    scans: {
                        orderBy: { scannedAt: 'desc' },
                        take: 10
                    }
                }
            });
            res.json(tickets);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao listar tickets' });
        }
    }

    static async validate(req: Request, res: Response) {
        try {
            const { uuid } = req.body;
            const scannedById = (req as any).user?.id || null;

            const ticket = await prisma.ticket.findUnique({
                where: { uuid },
                include: {
                    order: { include: { championship: true, user: true } },
                    scans: {
                        orderBy: { scannedAt: 'desc' },
                        take: 1
                    }
                }
            });

            if (!ticket) return res.status(404).json({ error: 'TICKET INVÁLIDO' });

            // Check 24h expiry
            const now = new Date();
            if (ticket.expiresAt && now > ticket.expiresAt) {
                // Mark as expired if not already
                if (ticket.status !== 'EXPIRED') {
                    await prisma.ticket.update({
                        where: { id: ticket.id },
                        data: { status: 'EXPIRED' }
                    });
                }
                return res.status(400).json({ error: 'TICKET EXPIRADO (24h excedidas)' });
            }

            // Determine action: if last scan was ENTRY, this is an EXIT. Otherwise, ENTRY.
            const lastScan = ticket.scans[0];
            const action = lastScan?.action === 'ENTRY' ? 'EXIT' : 'ENTRY';

            // Record the scan
            await prisma.ticketScan.create({
                data: {
                    ticketId: ticket.id,
                    action,
                    scannedById
                }
            });

            // Update validatedAt on first validation
            if (!ticket.validatedAt) {
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: { validatedAt: now }
                });
            }

            const ticketOrder = ticket.order as any;
            res.json({
                message: action === 'ENTRY' ? 'ACESSO LIBERADO ✅' : 'SAÍDA REGISTRADA 🚪',
                action,
                ticket: {
                    id: ticket.id,
                    uuid: ticket.uuid,
                    status: ticket.status,
                    expiresAt: ticket.expiresAt,
                    type: ticketOrder.type,
                    championship: ticketOrder.championship?.name,
                    user: ticketOrder.user?.name
                }
            });
        } catch (e) {
            console.error('[TicketController] Erro ao validar ticket:', e);
            res.status(500).json({ error: 'Erro ao validar ticket' });
        }
    }

    static async downloadPdf(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const ticketId = req.params.id as string;

            const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    order: {
                        include: {
                            user: true,
                            championship: true
                        }
                    }
                }
            });

            if (!ticket) return res.status(404).json({ error: 'TICKET INVÁLIDO' });

            const ticketWithOrder = ticket as any;

            if (ticketWithOrder.order.userId !== userId && (req as any).user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'NÃO AUTORIZADO' });
            }

            const { order } = ticketWithOrder;
            const { user, championship } = order;

            const ticketData = {
                championshipName: championship.name,
                ticketType: order.type === 'COMPETITOR' ? 'Competidor' : 'Espectador',
                eventDate: championship.date,
                eventLocation: championship.location,
                userName: user.name,
                purchaseDate: ticket.createdAt,
                uuid: ticket.uuid
            };

            const pdfBuffer = await PdfService.generateTicketPdf(ticketData);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="ingresso-${championship.name.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
            res.send(pdfBuffer);

        } catch (error) {
            console.error('Erro ao gerar PDF do ticket:', error);
            res.status(500).json({ error: 'Erro ao gerar PDF do ticket' });
        }
    }
}
