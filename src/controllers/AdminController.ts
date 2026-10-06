import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { emitEvent } from '../socket';
import { emailQueue } from '../services/queue.service';
import { PaymentLogService } from '../services/PaymentLogService';
import { generateUniqueChampionshipSlug } from '../utils/slug';

export class AdminController {
    static async toggleChampionshipStatus(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const champ = await prisma.championship.findUnique({ where: { id } });

            if (!champ) return res.status(404).json({ error: 'Campeonato não encontrado' });

            const newStatus = champ.status === 'OPEN' ? 'CLOSED' : 'OPEN';

            const updated = await prisma.championship.update({
                where: { id },
                data: { status: newStatus }
            });

            res.json(updated);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao atualizar status' });
        }
    }

    static async listChampionships(req: Request, res: Response) {
        try {
            const championships = await prisma.championship.findMany({
                include: { categories: true },
                orderBy: { date: 'asc' }
            });
            res.json(championships);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao listar campeonatos' });
        }
    }

    static async listAllOrders(req: Request, res: Response) {
        try {
            const { status } = req.query;
            const where: any = {};
            if (status && status !== 'ALL') {
                where.paymentStatus = String(status);
            }
            const orders = await prisma.order.findMany({
                where,
                include: { 
                    user: true, 
                    championship: true,
                    ticket: true,
                    paymentAttempts: {
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json(orders);
        } catch (e) {
            console.error('[AdminController] Erro ao listar transações:', e);
            res.status(500).json({ error: 'Erro ao listar transações' });
        }
    }

    static async manuallyApproveOrder(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const adminUser = (req as any).user;

            const order = await prisma.order.findUnique({
                where: { id },
                include: { 
                    championship: true, 
                    user: true, 
                    ticket: true,
                    paymentAttempts: { orderBy: { createdAt: 'desc' } }
                }
            });

            if (!order) {
                return res.status(404).json({ error: 'Pedido não encontrado.' });
            }

            if (order.paymentStatus === 'APPROVED') {
                return res.status(400).json({ error: 'Este pedido já está aprovado.' });
            }

            let wonTshirt = order.wonTshirt;
            if (order.championshipId) {
                const champ = await prisma.championship.findUnique({ where: { id: order.championshipId } });
                if (champ?.hasTshirtPromotion && !wonTshirt) {
                    const limit = order.type === 'COMPETITOR' ? champ.tshirtLimitComp : champ.tshirtLimitVis;
                    const winnersCount = await prisma.order.count({
                        where: {
                            championshipId: order.championshipId,
                            type: order.type,
                            paymentStatus: 'APPROVED',
                            wonTshirt: true
                        }
                    });
                    if (winnersCount < limit) {
                        wonTshirt = true;
                    }
                }
            }

            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id },
                    data: {
                        paymentStatus: 'APPROVED',
                        wonTshirt
                    }
                });

                await tx.paymentAttempt.updateMany({
                    where: { orderId: id },
                    data: { status: 'APPROVED' }
                });

                if (order.includesFederation || order.type === 'FEDERATION') {
                    const currentYear = new Date().getFullYear();
                    await tx.user.update({
                        where: { id: order.userId },
                        data: { federationYear: currentYear }
                    });
                }
            });

            // Gerar Ticket se não existir e não for exclusivamente Federação
            let ticket = order.ticket;
            if (!ticket && order.type !== 'FEDERATION') {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);

                ticket = await prisma.ticket.create({
                    data: {
                        orderId: order.id,
                        championshipId: order.championshipId,
                        expiresAt
                    }
                });

                await emailQueue.add('send-ticket', { ticketId: ticket.id });
            }

            // Log de auditoria
            await PaymentLogService.log({
                userId: order.userId,
                orderId: order.id,
                type: order.type,
                amount: order.amount,
                status: 'APPROVED',
                logMessage: `[Aprovação Manual] Pedido aprovado manualmente pelo administrador ${adminUser?.name || 'Admin'} (${adminUser?.email || ''}). Ingresso e benefícios liberados.`
            });

            const updatedOrder = await prisma.order.findUnique({
                where: { id },
                include: { user: true, championship: true, ticket: true, paymentAttempts: true }
            });

            res.json({
                success: true,
                message: 'Pedido aprovado com sucesso! Ingresso liberado e cliente atualizado.',
                order: updatedOrder,
                ticket
            });
        } catch (e: any) {
            console.error('[AdminController] Erro ao aprovar pedido manualmente:', e);
            res.status(500).json({ error: 'Erro ao aprovar pedido: ' + (e?.message || 'Erro interno') });
        }
    }

    static async checkMercadoPagoOrderStatus(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const adminUser = (req as any).user;

            const order = await prisma.order.findUnique({
                where: { id },
                include: { 
                    championship: true, 
                    user: true, 
                    ticket: true,
                    paymentAttempts: { orderBy: { createdAt: 'desc' } }
                }
            });

            if (!order) {
                return res.status(404).json({ error: 'Pedido não encontrado.' });
            }

            if (order.paymentStatus === 'APPROVED') {
                return res.json({
                    success: true,
                    status: 'approved',
                    alreadyApproved: true,
                    message: 'Este pedido já está aprovado no sistema.'
                });
            }

            const DEFAULT_MP_ACCESS_TOKEN = 'APP_USR-3345611795216825-031010-c151d4812a4f61dac62f4135483553a6-214542459';
            let accessToken: string;
            if (order.type === 'FEDERATION') {
                accessToken = process.env.MERCADOPAGO_FED_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN;
            } else {
                const champ = order.championship as any;
                const champHasOwnPair = !!(champ?.mpAccessToken && champ?.mpPublicKey);
                accessToken = champHasOwnPair
                    ? champ.mpAccessToken
                    : (process.env.MERCADOPAGO_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN);
            }

            const client = new MercadoPagoConfig({ accessToken });
            const paymentClient = new Payment(client);

            let paymentInfo: any = null;

            // 1. Tentar pelo gatewayOrderId ou gatewayPaymentId da tentativa
            const possiblePaymentId = order.gatewayOrderId || order.paymentAttempts[0]?.gatewayPaymentId;
            if (possiblePaymentId && possiblePaymentId.length > 5 && !isNaN(Number(possiblePaymentId))) {
                try {
                    paymentInfo = await paymentClient.get({ id: possiblePaymentId });
                } catch (err: any) {
                    console.warn(`[check-mp] Consulta direta por ID ${possiblePaymentId} falhou, tentando busca por external_reference:`, err?.message);
                }
            }

            // 2. Se não achou por ID direto, buscar via external_reference (ID do pedido)
            if (!paymentInfo) {
                try {
                    const searchRes = await paymentClient.search({
                        options: {
                            external_reference: order.id,
                            sort: 'date_created',
                            criteria: 'desc'
                        }
                    });
                    if (searchRes.results && searchRes.results.length > 0) {
                        paymentInfo = searchRes.results[0];
                    }
                } catch (err: any) {
                    console.warn(`[check-mp] Busca por external_reference falhou:`, err?.message);
                }
            }

            // 3. Fallback: procurar no paymentLog
            if (!paymentInfo) {
                try {
                    const logs = await (prisma as any).paymentLog.findMany({
                        where: { orderId: order.id },
                        orderBy: { createdAt: 'desc' }
                    });
                    for (const log of logs) {
                        if (log.gatewayResponse) {
                            try {
                                const parsed = typeof log.gatewayResponse === 'string' ? JSON.parse(log.gatewayResponse) : log.gatewayResponse;
                                const gId = parsed.id || parsed.paymentId;
                                if (gId && !isNaN(Number(gId))) {
                                    paymentInfo = await paymentClient.get({ id: gId.toString() });
                                    if (paymentInfo) break;
                                }
                            } catch (_) {}
                        }
                    }
                } catch (err) {}
            }

            if (!paymentInfo) {
                return res.status(404).json({
                    success: false,
                    message: 'Nenhum registro de pagamento correspondente foi localizado no Mercado Pago para este pedido.'
                });
            }

            console.log(`[check-mp] Pedido ${order.id} status no Mercado Pago: ${paymentInfo.status} (ID ${paymentInfo.id})`);

            // Se o Mercado Pago liberou e aprovou:
            if (paymentInfo.status === 'approved') {
                let wonTshirt = order.wonTshirt;
                if (order.championshipId) {
                    const champ = await prisma.championship.findUnique({ where: { id: order.championshipId } });
                    if (champ?.hasTshirtPromotion && !wonTshirt) {
                        const limit = order.type === 'COMPETITOR' ? champ.tshirtLimitComp : champ.tshirtLimitVis;
                        const winnersCount = await prisma.order.count({
                            where: {
                                championshipId: order.championshipId,
                                type: order.type,
                                paymentStatus: 'APPROVED',
                                wonTshirt: true
                            }
                        });
                        if (winnersCount < limit) {
                            wonTshirt = true;
                        }
                    }
                }

                await prisma.$transaction(async (tx) => {
                    await tx.order.update({
                        where: { id },
                        data: {
                            paymentStatus: 'APPROVED',
                            gatewayOrderId: paymentInfo.id?.toString(),
                            wonTshirt
                        }
                    });

                    await tx.paymentAttempt.updateMany({
                        where: { orderId: id },
                        data: {
                            status: 'APPROVED',
                            gatewayPaymentId: paymentInfo.id?.toString()
                        }
                    });

                    if (order.includesFederation || order.type === 'FEDERATION') {
                        const currentYear = new Date().getFullYear();
                        await tx.user.update({
                            where: { id: order.userId },
                            data: { federationYear: currentYear }
                        });
                    }
                });

                // Gerar Ticket se não existir
                let ticket = order.ticket;
                if (!ticket && order.type !== 'FEDERATION') {
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 24);

                    ticket = await prisma.ticket.create({
                        data: {
                            orderId: order.id,
                            championshipId: order.championshipId,
                            expiresAt
                        }
                    });

                    await emailQueue.add('send-ticket', { ticketId: ticket.id });
                }

                // Log
                await PaymentLogService.log({
                    userId: order.userId,
                    orderId: order.id,
                    type: order.type,
                    amount: order.amount,
                    status: 'APPROVED',
                    logMessage: `[Sincronização MP] Pagamento consultado diretamente no Mercado Pago (ID ${paymentInfo.id}) e APROVADO com sucesso.`,
                    gatewayResponse: paymentInfo
                });

                const updatedOrder = await prisma.order.findUnique({
                    where: { id },
                    include: { user: true, championship: true, ticket: true, paymentAttempts: true }
                });

                return res.json({
                    success: true,
                    status: 'approved',
                    message: `Pagamento APROVADO no Mercado Pago! Pedido atualizado e ingresso emitido com sucesso.`,
                    order: updatedOrder,
                    ticket
                });
            }

            // Se ainda pendente
            if (paymentInfo.status === 'pending' || paymentInfo.status === 'in_process') {
                return res.json({
                    success: false,
                    status: paymentInfo.status,
                    statusDetail: paymentInfo.status_detail,
                    message: `O pagamento ainda consta como PENDENTE no Mercado Pago (${paymentInfo.status_detail || 'aguardando transferência/compensação'}). O Mercado Pago ainda não liberou o valor.`
                });
            }

            // Se recusado / cancelado
            return res.json({
                success: false,
                status: paymentInfo.status,
                statusDetail: paymentInfo.status_detail,
                message: `Status no Mercado Pago: ${paymentInfo.status} (${paymentInfo.status_detail || 'não aprovado'}).`
            });

        } catch (e: any) {
            console.error('[AdminController] Erro ao consultar status no MP:', e);
            res.status(500).json({ error: 'Erro ao consultar status no Mercado Pago: ' + (e?.message || 'Erro interno') });
        }
    }

    static async deleteOrder(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const order = await prisma.order.findUnique({ where: { id } });
            if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

            await prisma.$transaction(async (tx) => {
                await tx.paymentAttempt.deleteMany({ where: { orderId: id } });
                await tx.ticketScan.deleteMany({ where: { ticket: { orderId: id } } });
                await tx.ticket.deleteMany({ where: { orderId: id } });
                await tx.order.delete({ where: { id } });
            });

            res.json({ success: true, message: 'Pedido excluído com sucesso.' });
        } catch (e: any) {
            console.error('[AdminController] Erro ao excluir pedido:', e);
            res.status(500).json({ error: 'Erro ao excluir pedido: ' + (e?.message || 'Erro interno') });
        }
    }

    static async updateChampionship(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const data = { ...req.body };

            // Se o admin mandou as chaves em branco, presumimos que ele não quer alterá-las, preservando as originais
            if (!data.mpAccessToken) delete data.mpAccessToken;
            if (!data.mpPublicKey) delete data.mpPublicKey;
            if (!data.mpWebhookSecret) delete data.mpWebhookSecret;
            if (!data.mpFedAccessToken) delete data.mpFedAccessToken;
            if (!data.mpFedPublicKey) delete data.mpFedPublicKey;
            if (!data.mpFedWebhookSecret) delete data.mpFedWebhookSecret;

            // Converter data para objeto Date se vier como string
            if (data.date && typeof data.date === 'string') {
                data.date = new Date(data.date);
            }

            // Slug: se o admin informou um, normaliza e garante unicidade.
            // Se enviou vazio, geramos a partir do nome para nunca ficar sem URL.
            if (data.slug !== undefined) {
                const base = data.slug?.trim() ? data.slug : (data.name || 'evento');
                data.slug = await generateUniqueChampionshipSlug(base, id);
            }

            const champ = await prisma.championship.update({
                where: { id },
                data
            });

            res.json(champ);
        } catch (e) {
            console.error('[AdminController] Erro ao atualizar campeonato:', e);
            res.status(500).json({ error: 'Erro ao atualizar campeonato' });
        }
    }

    static async deleteChampionship(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const force = req.query.force === 'true';

            // Check if championship exists
            const existing = await prisma.championship.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Campeonato não encontrado' });
            }

            // Check if there are orders related to this championship
            const orders = await prisma.order.findMany({ where: { championshipId: id } });
            const paidOrders = orders.filter(o => o.paymentStatus === 'APPROVED');
            if (paidOrders.length > 0 && !force) {
                return res.status(400).json({ 
                    error: `Não é possível excluir um campeonato que já possui ${paidOrders.length} pedido(s) aprovado(s).` 
                });
            }

            await prisma.$transaction(async (tx) => {
                // If force or unpaid orders, delete orders and related payments/tickets
                if (orders.length > 0) {
                    const orderIds = orders.map(o => o.id);
                    await tx.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
                    await tx.ticketScan.deleteMany({ where: { ticket: { championshipId: id } } });
                    await tx.ticket.deleteMany({ where: { championshipId: id } });
                    await tx.order.deleteMany({ where: { championshipId: id } });
                }

                // Delete judging session scores & judging sessions
                const sessions = await tx.judgingSession.findMany({ where: { championshipId: id } });
                const sessionIds = sessions.map(s => s.id);
                if (sessionIds.length > 0) {
                    await tx.score.deleteMany({ where: { sessionId: { in: sessionIds } } });
                    await tx.judgingSession.deleteMany({ where: { championshipId: id } });
                }

                // Delete results and scores related to categories
                const categories = await tx.category.findMany({ where: { championshipId: id } });
                const categoryIds = categories.map(c => c.id);
                if (categoryIds.length > 0) {
                    await tx.score.deleteMany({ where: { categoryId: { in: categoryIds } } });
                    await tx.result.deleteMany({ where: { categoryId: { in: categoryIds } } });
                }

                // Delete stage logs, scores, results and athletes
                const athletes = await tx.athlete.findMany({ where: { championshipId: id } });
                const athleteIds = athletes.map(a => a.id);
                if (athleteIds.length > 0) {
                    await tx.stageLog.deleteMany({ where: { athleteId: { in: athleteIds } } });
                    await tx.score.deleteMany({ where: { athleteId: { in: athleteIds } } });
                    await tx.result.deleteMany({ where: { athleteId: { in: athleteIds } } });
                    await tx.athlete.deleteMany({ where: { championshipId: id } });
                }

                // Delete stages
                const stages = await tx.stage.findMany({ where: { championshipId: id } });
                const stageIds = stages.map(s => s.id);
                if (stageIds.length > 0) {
                    await tx.stageLog.deleteMany({ where: { stageId: { in: stageIds } } });
                    await tx.stage.deleteMany({ where: { championshipId: id } });
                }

                // Delete categories
                if (categoryIds.length > 0) {
                    await tx.category.deleteMany({ where: { championshipId: id } });
                }

                // Delete tickets
                await tx.ticket.deleteMany({ where: { championshipId: id } });

                // Delete championship
                await tx.championship.delete({ where: { id } });
            });

            res.json({ message: 'Campeonato excluído com sucesso' });
        } catch (e: any) {
            console.error('[AdminController] Erro ao excluir campeonato:', e);
            res.status(500).json({ error: 'Erro ao excluir campeonato: ' + (e?.message || 'Erro interno') });
        }
    }

    static async listUsers(req: Request, res: Response) {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    cpf: true,
                    phone: true,
                    address: true,
                    city: true,
                    state: true,
                    role: true,
                    federationYear: true,
                    createdAt: true,
                    updatedAt: true,
                    orders: {
                        select: {
                            type: true,
                            paymentStatus: true,
                            amount: true,
                            includesFederation: true,
                            wonTshirt: true,
                            createdAt: true,
                            championship: { select: { name: true } }
                        },
                        orderBy: { createdAt: 'desc' }
                    },
                    athletes: {
                        select: {
                            id: true,
                            name: true,
                            height: true,
                            weight: true,
                            athleteNumber: true,
                            birthDate: true,
                            status: true,
                            categoryId: true,
                            championshipId: true,
                            championship: { select: { name: true } },
                            category: { select: { name: true, parentName: true } },
                            currentStage: { select: { name: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json(users);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao listar usuários' });
        }
    }

    static async changeUserRole(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const { role } = req.body;

            if (!['ADMIN', 'USER', 'TICKETER', 'SUPPORT', 'JUDGE', 'ATHLETE'].includes(role)) {
                return res.status(400).json({ error: 'Perfil inválido' });
            }

            const updated = await prisma.user.update({
                where: { id },
                data: { role }
            });

            // Prevent sending full sensitive user data back, just basic info
            res.json({ id: updated.id, name: updated.name, role: updated.role });
        } catch (e) {
            res.status(500).json({ error: 'Erro ao atualizar perfil do usuário' });
        }
    }

    static async createUser(req: Request, res: Response) {
        try {
            const { name, cpf, email, phone, password, role } = req.body;

            const cleanCpf = cpf.replace(/\D/g, '');
            const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

            const exists = await prisma.user.findFirst({ 
                where: { OR: [{ email }, { cpf: cleanCpf }] } 
            });
            
            if (exists) return res.status(400).json({ error: 'E-mail ou CPF já cadastrados' });

            const password_hash = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
                data: { 
                    name, 
                    cpf: cleanCpf, 
                    email, 
                    phone: cleanPhone, 
                    password_hash, 
                    role: role || 'USER' 
                }
            });

            res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
        } catch (e) {
            console.error('[AdminController] Erro ao criar usuário:', e);
            res.status(500).json({ error: 'Erro ao criar usuário no banco de dados' });
        }
    }

    static async toggleUserFederation(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const user = await prisma.user.findUnique({ where: { id } });

            if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

            const currentYear = new Date().getFullYear();
            const isFederated = user.federationYear === currentYear;

            const newYear = isFederated ? null : currentYear;

            const updated = await prisma.user.update({
                where: { id },
                data: { federationYear: newYear }
            });

            res.json({ id: updated.id, name: updated.name, federationYear: updated.federationYear });
        } catch (e) {
            res.status(500).json({ error: 'Erro ao alternar status de federação' });
        }
    }

    static async updateUser(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const { name, cpf, email, phone, password, role } = req.body;

            const updateData: any = { name, cpf, email, phone, role };
            
            if (password && password.trim() !== '') {
                updateData.password_hash = await bcrypt.hash(password, 10);
            }

            const updated = await prisma.user.update({
                where: { id },
                data: updateData
            });

            res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
        } catch (e) {
            res.status(500).json({ error: 'Erro ao atualizar usuário' });
        }
    }

    static async deleteUser(req: Request, res: Response) {
        try {
            const id = req.params.id as string;

            const hasOrders = await prisma.order.findFirst({ where: { userId: id } });
            if (hasOrders) {
                return res.status(400).json({ error: 'Não é possível excluir um usuário que possui pedidos/vendas vinculadas.' });
            }

            // Also check for credit cards (we can delete them or block).
            await prisma.creditCard.deleteMany({ where: { userId: id } });

            await prisma.user.delete({ where: { id } });

            res.json({ message: 'Usuário excluído com sucesso' });
        } catch (e) {
            res.status(500).json({ error: 'Erro ao excluir usuário' });
        }
    }

    static async listPaymentLogs(req: Request, res: Response) {
        try {
            const logs = await (prisma as any).paymentLog.findMany({
                include: { user: true },
                orderBy: { createdAt: 'desc' },
                take: 500
            });
            res.json(logs);
        } catch (e) {
            console.error('[AdminController] Erro ao listar payment logs:', e);
            res.status(500).json({ error: 'Erro ao listar logs de pagamento' });
        }
    }

    // ===== PIPELINE DE ESTAÇÕES =====

    static async getChampionshipStages(req: Request, res: Response) {
        try {
            const championshipId = req.params.id as string;
            const stages = await prisma.stage.findMany({
                where: { championshipId },
                orderBy: { order: 'asc' }
            });
            res.json(stages);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao listar estações' });
        }
    }

    static async getChampionshipProgress(req: Request, res: Response) {
        try {
            const championshipId = req.params.id as string;

            // Get stages for this championship
            let stages = await prisma.stage.findMany({
                where: { championshipId },
                orderBy: { order: 'asc' }
            });

            if (stages.length === 0) {
                const defaultStages = [
                    { name: 'Portaria', order: 1, championshipId },
                    { name: 'Pintura', order: 2, championshipId },
                    { name: 'Backstage', order: 3, championshipId },
                    { name: 'Palco', order: 4, championshipId },
                    { name: 'Finalizado', order: 5, championshipId },
                ];
                await prisma.stage.createMany({ data: defaultStages });
                stages = await prisma.stage.findMany({
                    where: { championshipId },
                    orderBy: { order: 'asc' }
                });
            }

            // Get all APPROVED competitor orders for this championship
            const competitorOrders = await prisma.order.findMany({
                where: {
                    championshipId,
                    type: 'COMPETITOR',
                    paymentStatus: 'APPROVED'
                },
                include: {
                    user: true,
                    ticket: true
                }
            });

            // Group orders by userId to avoid duplicating athletes across multiple orders
            const ordersByUser = new Map<string, typeof competitorOrders>();
            for (const order of competitorOrders) {
                const existing = ordersByUser.get(order.userId) || [];
                existing.push(order);
                ordersByUser.set(order.userId, existing);
            }

            // For each unique user, build their progress entries
            const progressNested = await Promise.all(Array.from(ordersByUser.entries()).map(async ([userId, userOrders]) => {
                // Collect ALL categoryIds across ALL orders for this user
                const allCategoryIds = new Set<string>();
                for (const order of userOrders) {
                    const catIds = (order.categoryIds as string[]) || [];
                    catIds.forEach(id => allCategoryIds.add(id));
                }

                // Get the user info and ticket from the most recent order
                const latestOrder = userOrders[0]; // Already sorted by createdAt desc via query

                // Find all athlete records for this user
                const athletes = await prisma.athlete.findMany({
                    where: { userId, championshipId },
                    include: {
                        currentStage: true,
                        logs: {
                            include: { stage: true, validatedBy: true },
                            orderBy: { timestamp: 'asc' }
                        },
                        category: true
                    }
                });

                if (athletes.length > 0) {
                    // We have athlete records — show them
                    // Also check if any purchased categories are missing athlete records
                    const existingCatIds = new Set(athletes.map(a => a.categoryId).filter(Boolean));
                    const missingCatIds = Array.from(allCategoryIds).filter(id => !existingCatIds.has(id));

                    const athleteEntries = athletes.map(athlete => ({
                        id: athlete.id,
                        athleteId: athlete.id,
                        userId,
                        name: latestOrder.user.name,
                        cpf: latestOrder.user.cpf,
                        email: latestOrder.user.email,
                        category: athlete.category?.name || 'Categoria Geral',
                        parentCategory: athlete.category?.parentName || null,
                        categoryId: athlete.categoryId,
                        currentStage: athlete.currentStage?.name || 'Pendente',
                        currentStageOrder: athlete.currentStage?.order || 0,
                        status: athlete.status || 'PENDING',
                        ticketUuid: latestOrder.ticket?.uuid,
                        ticketStatus: latestOrder.ticket?.status,
                        logs: athlete.logs?.map(l => ({
                            id: l.id,
                            stage: l.stage.name,
                            action: l.action,
                            validatedBy: l.validatedBy.name,
                            timestamp: l.timestamp,
                            details: l.details
                        })) || []
                    }));

                    // Add entries for missing categories (purchased but not yet checked in)
                    if (missingCatIds.length > 0) {
                        const missingCats = await prisma.category.findMany({
                            where: { id: { in: missingCatIds } }
                        });
                        for (const catId of missingCatIds) {
                            const cat = missingCats.find(c => c.id === catId);
                            athleteEntries.push({
                                id: `${latestOrder.id}-${catId}`,
                                athleteId: null as any,
                                userId,
                                name: latestOrder.user.name,
                                cpf: latestOrder.user.cpf,
                                email: latestOrder.user.email,
                                category: cat?.name || 'Categoria Geral',
                                parentCategory: cat?.parentName || null,
                                categoryId: catId,
                                currentStage: 'Aguardando Portaria',
                                currentStageOrder: 0,
                                status: 'PENDING',
                                ticketUuid: latestOrder.ticket?.uuid,
                                ticketStatus: latestOrder.ticket?.status,
                                logs: []
                            });
                        }
                    }

                    return athleteEntries;
                }

                // No athlete records at all — show per-category entries from all orders
                if (allCategoryIds.size > 0) {
                    const orderCategories = await prisma.category.findMany({
                        where: { id: { in: Array.from(allCategoryIds) } }
                    });
                    return Array.from(allCategoryIds).map(catId => {
                        const cat = orderCategories.find(c => c.id === catId);
                        return {
                            id: `${latestOrder.id}-${catId}`,
                            athleteId: null,
                            userId,
                            name: latestOrder.user.name,
                            cpf: latestOrder.user.cpf,
                            email: latestOrder.user.email,
                            category: cat?.name || 'Categoria Geral',
                            parentCategory: cat?.parentName || null,
                            categoryId: catId,
                            currentStage: 'Aguardando Portaria',
                            currentStageOrder: 0,
                            status: 'PENDING',
                            ticketUuid: latestOrder.ticket?.uuid,
                            ticketStatus: latestOrder.ticket?.status,
                            logs: []
                        };
                    });
                }

                // No categories at all (legacy order)
                return [{
                    id: latestOrder.id,
                    athleteId: null,
                    userId,
                    name: latestOrder.user.name,
                    cpf: latestOrder.user.cpf,
                    email: latestOrder.user.email,
                    category: 'Categoria Geral',
                    parentCategory: null,
                    categoryId: null,
                    currentStage: 'Aguardando Portaria',
                    currentStageOrder: 0,
                    status: 'PENDING',
                    ticketUuid: latestOrder.ticket?.uuid,
                    ticketStatus: latestOrder.ticket?.status,
                    logs: []
                }];
            }));
            
            const progress = progressNested.flat();

            res.json({ stages, athletes: progress });
        } catch (e) {
            console.error('[AdminController] Erro ao buscar progresso:', e);
            res.status(500).json({ error: 'Erro ao buscar progresso do campeonato' });
        }
    }

    static async advanceAthleteStage(req: Request, res: Response) {
        try {
            let championshipId = req.params.champId as string;
            const targetId = req.params.athleteId as string;
            const validatedById = (req as any).user.id;
            const { details, skip, categoryId: specificCategoryId } = req.body;

            // If championshipId is 'any', we must find it via the ticket or athlete
            if (championshipId === 'any' || !championshipId) {
                const ticket = await prisma.ticket.findFirst({
                    where: { uuid: targetId },
                    select: { championshipId: true }
                });
                if (ticket?.championshipId) {
                    championshipId = ticket.championshipId;
                } else {
                    const athlete = await prisma.athlete.findFirst({
                        where: { OR: [{ id: targetId }, { userId: targetId }] },
                        select: { championshipId: true }
                    });
                    if (athlete) championshipId = athlete.championshipId;
                }
            }

            if (!championshipId || championshipId === 'any') {
                return res.status(400).json({ error: 'Não foi possível identificar o campeonato para este atleta.' });
            }

            let stages = await prisma.stage.findMany({
                where: { championshipId },
                orderBy: { order: 'asc' }
            });

            if (stages.length === 0) {
                const defaultStages = [
                    { name: 'Portaria', order: 1, championshipId },
                    { name: 'Pintura', order: 2, championshipId },
                    { name: 'Backstage', order: 3, championshipId },
                    { name: 'Palco', order: 4, championshipId },
                    { name: 'Finalizado', order: 5, championshipId },
                ];
                await prisma.stage.createMany({ data: defaultStages });
                stages = await prisma.stage.findMany({
                    where: { championshipId },
                    orderBy: { order: 'asc' }
                });
            }

            const firstStage = stages[0];

            // 1. Find ALL approved orders for this user in this championship
            const userIdFromTicket = await (async () => {
                // Try ticket lookup first
                const ticket = await prisma.ticket.findFirst({
                    where: { uuid: targetId },
                    include: { order: true }
                });
                if (ticket?.order?.userId) return ticket.order.userId;
                
                // Try order lookup
                const order = await prisma.order.findFirst({
                    where: { id: targetId, championshipId },
                    select: { userId: true }
                });
                if (order?.userId) return order.userId;

                // Try athlete lookup
                const athlete = await prisma.athlete.findFirst({
                    where: { OR: [{ id: targetId }, { userId: targetId }], championshipId },
                    select: { userId: true }
                });
                if (athlete?.userId) return athlete.userId;

                // Use targetId as userId directly
                return targetId;
            })();

            const allOrders = await prisma.order.findMany({
                where: {
                    userId: userIdFromTicket,
                    championshipId,
                    type: 'COMPETITOR',
                    paymentStatus: 'APPROVED'
                },
                include: { user: true }
            });

            const representativeOrder = allOrders[0]; // For user info

            if (!representativeOrder) {
                // If no order found but athletes exist, just continue with existing athletes
                const existingAthletes = await prisma.athlete.findMany({
                    where: {
                        OR: [{ id: targetId }, { userId: targetId, championshipId }],
                        championshipId
                    },
                    include: { currentStage: true, category: true }
                });
                if (existingAthletes.length === 0) return res.status(404).json({ error: 'Pedido ou Atleta não encontrado' });
                // We proceed with existing ones
            } else {
                // 2. Collect ALL categoryIds from ALL orders for this user
                const allCatIds = new Set<string>();
                for (const ord of allOrders) {
                    const catIds = (ord.categoryIds as string[]) || [];
                    catIds.forEach(id => allCatIds.add(id));
                }
                const uniqueCatIds = allCatIds.size > 0 ? Array.from(allCatIds) : [null];
                
                for (const catId of uniqueCatIds) {
                    const existing = await prisma.athlete.findFirst({
                        where: { userId: representativeOrder.userId, championshipId, categoryId: catId }
                    });

                    if (!existing) {
                        const newAth = await prisma.athlete.create({
                            data: {
                                userId: representativeOrder.userId,
                                name: representativeOrder.user.name,
                                championshipId,
                                categoryId: catId,
                                currentStageId: firstStage.id,
                                status: 'ACTIVE'
                            },
                            include: { currentStage: true, category: true }
                        });
                        await prisma.stageLog.create({
                            data: {
                                athleteId: newAth.id,
                                stageId: firstStage.id,
                                action: 'ENTERED',
                                validatedById,
                                details: details || `Check-in na ${firstStage.name} (Auto-gerado)`
                            }
                        });
                    }
                }
            }

            // 3. Find ALL athlete records for this user to have the complete list
            let userToSearch = userIdFromTicket;

            let athletes = await prisma.athlete.findMany({
                where: { 
                    userId: userToSearch,
                    championshipId 
                },
                include: { currentStage: true, category: true }
            });

            // If we still have no athletes but targetId might be an athlete ID (legacy or direct)
            if (athletes.length === 0 && targetId.length > 30) {
                 athletes = await prisma.athlete.findMany({
                    where: { id: targetId },
                    include: { currentStage: true, category: true }
                });
            }

            // 4. Logic: Unified entry at Portaria, separate progress after
            let athletesToAdvance = [];

            // Determine if we are moving from the first stage (Portaria)
            const targetAthlete = specificCategoryId 
                ? athletes.find(a => a.categoryId === specificCategoryId)
                : athletes.find(a => a.id === targetId || a.currentStage?.order === firstStage.order);

            const isTargetAtFirstStage = targetAthlete?.currentStage?.order === firstStage.order;

            if (isTargetAtFirstStage) {
                // If the athlete is at the Portaria, we move ALL categories currently at Portaria (Unified Entry)
                athletesToAdvance = athletes.filter(a => a.currentStage?.order === firstStage.order);
            } else if (specificCategoryId) {
                // Progress from Stage 2 onwards is individual
                athletesToAdvance = athletes.filter(a => a.categoryId === specificCategoryId);
            } else if (athletes.length > 1) {
                // Multiple categories beyond Portaria and no specific one selected: request choice
                return res.status(202).json({ 
                    message: 'Atleta possui múltiplas categorias. Escolha qual avançar:',
                    needsSelection: true,
                    athletes: athletes.map(a => ({
                        id: a.id,
                        categoryId: a.categoryId,
                        categoryName: a.category?.name || 'Categoria Geral',
                        currentStage: a.currentStage?.name
                    }))
                });
            } else {
                // Only one category
                athletesToAdvance = athletes;
            }

            if (athletesToAdvance.length === 0) {
                return res.status(404).json({ error: 'Nenhum registro encontrado para avançar nesta categoria.' });
            }

            // 4. Perform advancement
            const updatedResults = [];
            for (const athlete of athletesToAdvance) {
                const currentOrder = athlete.currentStage?.order || 0;
                const nextStage = stages.find(s => s.order > currentOrder);

                if (!nextStage) continue;

                if (athlete.currentStageId) {
                    await prisma.stageLog.create({
                        data: {
                            athleteId: athlete.id,
                            stageId: athlete.currentStageId,
                            action: skip ? 'SKIPPED' : 'COMPLETED',
                            validatedById,
                            details: details || (skip ? `Etapa pulada` : `Concluído`)
                        }
                    });
                }

                const updated = await prisma.athlete.update({
                    where: { id: athlete.id },
                    data: {
                        currentStageId: nextStage.id,
                        status: nextStage.name === 'Finalizado' ? 'FINISHED' : 'ACTIVE'
                    },
                    include: { currentStage: true, category: true }
                });

                await prisma.stageLog.create({
                    data: {
                        athleteId: athlete.id,
                        stageId: nextStage.id,
                        action: 'ENTERED',
                        validatedById,
                        details: details || `Avançou para ${nextStage.name}`
                    }
                });
                updatedResults.push(updated);
            }

            if (updatedResults.length === 0) {
                return res.status(400).json({ error: 'Atleta já está na última estação.' });
            }

            res.json({ 
                message: `Avançou para: ${updatedResults[0].currentStage?.name}`, 
                athlete: updatedResults[0],
                count: updatedResults.length 
            });
        } catch (e) {
            console.error('[AdminController] Erro ao avançar etapa:', e);
            res.status(500).json({ error: 'Erro ao avançar etapa' });
        }
    }

    // ===== RESET DE SENHA =====

    static async resetUserPassword(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const defaultPassword = 'zeus123';
            const password_hash = await bcrypt.hash(defaultPassword, 10);

            await prisma.user.update({
                where: { id },
                data: { password_hash }
            });

            res.json({ message: `Senha resetada para: ${defaultPassword}` });
        } catch (e) {
            res.status(500).json({ error: 'Erro ao resetar senha' });
        }
    }

    static async assignFreeTicket(req: Request, res: Response) {
        try {
            const userId = req.params.id as string;
            const { championshipId, type, categoryIds } = req.body;
            const adminId = (req as any).user?.id;

            if (!userId) {
                return res.status(400).json({ error: 'ID do usuário não fornecido.' });
            }

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            const champ = await prisma.championship.findUnique({ where: { id: championshipId } });
            if (!champ) {
                return res.status(404).json({ error: 'Campeonato não encontrado.' });
            }

            if (!['COMPETITOR', 'VISITOR'].includes(type)) {
                return res.status(400).json({ error: 'Tipo de ingresso inválido. Deve ser COMPETITOR ou VISITOR.' });
            }

            // Create Order
            const order = await prisma.order.create({
                data: {
                    userId,
                    championshipId,
                    type,
                    amount: 0,
                    paymentStatus: 'APPROVED',
                    includesFederation: false,
                    categoryIds: type === 'COMPETITOR' ? (categoryIds || []) : []
                }
            });

            // Create Ticket
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const ticket = await prisma.ticket.create({
                data: {
                    orderId: order.id,
                    championshipId,
                    expiresAt
                }
            });

            // If it's a competitor, register the user as an Athlete in the categories
            if (type === 'COMPETITOR') {
                const stages = await prisma.stage.findMany({
                    where: { championshipId },
                    orderBy: { order: 'asc' }
                });
                const firstStageId = stages.length > 0 ? stages[0].id : null;

                const catsToRegister = categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0
                    ? categoryIds
                    : [null];

                for (const catId of catsToRegister) {
                    const existing = await prisma.athlete.findFirst({
                        where: { userId, championshipId, categoryId: catId }
                    });

                    if (!existing) {
                        const newAth = await prisma.athlete.create({
                            data: {
                                userId,
                                name: user.name,
                                championshipId,
                                categoryId: catId,
                                currentStageId: firstStageId,
                                status: 'ACTIVE'
                            }
                        });

                        if (firstStageId) {
                            await prisma.stageLog.create({
                                data: {
                                    athleteId: newAth.id,
                                    stageId: firstStageId,
                                    action: 'ENTERED',
                                    validatedById: adminId || userId,
                                    details: 'Ingresso gratuito concedido pelo administrador'
                                }
                            });
                        }
                    }
                }
            }

            // Send Ticket Email
            await emailQueue.add('send-ticket', { ticketId: ticket.id });

            // Log
            await PaymentLogService.log({
                userId,
                orderId: order.id,
                type,
                amount: 0,
                status: 'APPROVED',
                logMessage: `Ingresso gratuito (${type === 'COMPETITOR' ? 'Atleta' : 'Visitante'}) atribuído manualmente pelo administrador.`
            });

            res.status(201).json({ message: 'Ingresso concedido com sucesso!', order, ticket });
        } catch (e) {
            console.error('[AdminController] Erro ao atribuir ingresso gratuito:', e);
            res.status(500).json({ error: 'Erro ao atribuir ingresso gratuito.' });
        }
    }

    // ===== GESTÃO GLOBAL (TEMPLATES) =====

    static async listGlobalStages(req: Request, res: Response) {
        try {
            const stages = await prisma.globalStage.findMany({ orderBy: { order: 'asc' } });
            res.json(stages);
        } catch (e) { res.status(500).json({ error: 'Erro ao listar etapas globais' }); }
    }

    static async createGlobalStage(req: Request, res: Response) {
        try {
            const { name, order } = req.body;
            const stage = await prisma.globalStage.create({ data: { name, order } });
            res.json(stage);
        } catch (e) { res.status(500).json({ error: 'Erro ao criar etapa global' }); }
    }

    static async deleteGlobalStage(req: Request, res: Response) {
        try {
            await prisma.globalStage.delete({ where: { id: req.params.id as string } });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Erro ao excluir etapa global' }); }
    }

    static async listGlobalCategories(req: Request, res: Response) {
        try {
            const categories = await prisma.globalCategory.findMany({ 
                orderBy: [
                    { order: 'asc' },
                    { name: 'asc' }
                ] 
            });
            res.json(categories);
        } catch (e) { res.status(500).json({ error: 'Erro ao listar categorias globais' }); }
    }

    static async createGlobalCategory(req: Request, res: Response) {
        try {
            const data = req.body;
            const category = await prisma.globalCategory.create({ data });
            res.json(category);
        } catch (e) { res.status(500).json({ error: 'Erro ao criar categoria global' }); }
    }

    static async deleteGlobalCategory(req: Request, res: Response) {
        try {
            await prisma.globalCategory.delete({ where: { id: req.params.id as string } });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Erro ao excluir categoria global' }); }
    }

    static async importGlobalToChampionship(req: Request, res: Response) {
        try {
            const championshipId = req.params.id as string;
            const { type } = req.body; // 'STAGES' or 'CATEGORIES'

            if (type === 'STAGES') {
                const globals = await prisma.globalStage.findMany({ orderBy: { order: 'asc' } });
                if (globals.length === 0) return res.status(400).json({ error: 'Nenhum template de etapa encontrado' });
                
                await prisma.$transaction([
                    // Limpar referências em atletas e logs antes de deletar stages
                    prisma.athlete.updateMany({
                        where: { championshipId },
                        data: { currentStageId: null }
                    }),
                    prisma.stageLog.deleteMany({
                        where: { stage: { championshipId } }
                    }),
                    prisma.stage.deleteMany({ where: { championshipId } }),
                    prisma.stage.createMany({
                        data: globals.map(g => ({
                            name: g.name,
                            order: g.order,
                            championshipId
                        }))
                    })
                ]);
            } else if (type === 'CATEGORIES') {
                const globals = await prisma.globalCategory.findMany();
                if (globals.length === 0) return res.status(400).json({ error: 'Nenhum template de categoria encontrado' });

                await prisma.$transaction([
                    // Limpar referências e dados vinculados antes de deletar categorias
                    prisma.score.deleteMany({
                        where: { category: { championshipId } }
                    }),
                    prisma.result.deleteMany({
                        where: { category: { championshipId } }
                    }),
                    prisma.judgingSession.deleteMany({
                        where: { category: { championshipId } }
                    }),
                    prisma.athlete.updateMany({
                        where: { championshipId },
                        data: { categoryId: null }
                    }),
                    prisma.category.deleteMany({ where: { championshipId } }),
                    prisma.category.createMany({
                        data: globals.map(g => ({
                            name: g.name,
                            parentName: g.parentName,
                            minWeight: g.minWeight,
                            maxWeight: g.maxWeight,
                            minHeight: g.minHeight,
                            maxHeight: g.maxHeight,
                            poses: g.poses,
                            order: g.order,
                            championshipId
                        }))
                    })
                ]);
            }

            res.json({ success: true });
        } catch (e) { 
            console.error('[AdminController] Erro ao importar templates:', e);
            res.status(500).json({ error: 'Erro ao importar templates' }); 
        }
    }

    static async createAthlete(req: Request, res: Response) {
        try {
            const { userId, championshipId, categoryId, name } = req.body;
            const validatedById = (req as any).user.id;

            const stages = await prisma.stage.findMany({
                where: { championshipId },
                orderBy: { order: 'asc' }
            });

            if (stages.length === 0) {
                return res.status(400).json({ error: 'Este campeonato não possui etapas configuradas.' });
            }

            const athlete = await prisma.athlete.create({
                data: {
                    userId,
                    name,
                    championshipId,
                    categoryId: categoryId || null,
                    currentStageId: stages[0].id,
                    status: 'ACTIVE'
                },
                include: { category: true, championship: true }
            });

            await prisma.stageLog.create({
                data: {
                    athleteId: athlete.id,
                    stageId: stages[0].id,
                    action: 'ENTERED',
                    validatedById,
                    details: 'Inscrição manual realizada pelo administrador'
                }
            });

            // Automatically attribute a competitor ticket/order if the user doesn't already have one for this championship
            if (userId) {
                const existingOrder = await prisma.order.findFirst({
                    where: {
                        userId,
                        championshipId,
                        type: 'COMPETITOR',
                        paymentStatus: 'APPROVED'
                    }
                });

                if (!existingOrder) {
                    const order = await prisma.order.create({
                        data: {
                            userId,
                            championshipId,
                            type: 'COMPETITOR',
                            amount: 0,
                            paymentStatus: 'APPROVED',
                            includesFederation: false,
                            categoryIds: categoryId ? [categoryId] : []
                        }
                    });

                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 24);

                    const ticket = await prisma.ticket.create({
                        data: {
                            orderId: order.id,
                            championshipId,
                            expiresAt
                        }
                    });

                    await emailQueue.add('send-ticket', { ticketId: ticket.id });

                    await PaymentLogService.log({
                        userId,
                        orderId: order.id,
                        type: 'COMPETITOR',
                        amount: 0,
                        status: 'APPROVED',
                        logMessage: `Ingresso de competidor gratuito gerado automaticamente após inscrição manual na categoria.`
                    });
                } else {
                    const orderCatIds = (existingOrder.categoryIds as string[]) || [];
                    if (categoryId && !orderCatIds.includes(categoryId)) {
                        await prisma.order.update({
                            where: { id: existingOrder.id },
                            data: {
                                categoryIds: [...orderCatIds, categoryId]
                            }
                        });
                    }
                }
            }

            res.status(201).json(athlete);
        } catch (e) {
            console.error('[AdminController] Erro ao criar atleta:', e);
            res.status(500).json({ error: 'Erro ao criar inscrição de atleta' });
        }
    }

    static async updateAthlete(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const categoryId = req.body.categoryId as string | null;
            const athleteNumberInput = req.body.athleteNumber;

            const dataToUpdate: any = {};
            if (categoryId !== undefined) {
                dataToUpdate.categoryId = (categoryId === '' || !categoryId) ? null : categoryId;
            }
            if (athleteNumberInput !== undefined) {
                dataToUpdate.athleteNumber = (athleteNumberInput === '' || athleteNumberInput === null) ? null : parseInt(athleteNumberInput, 10);
            }

            const athlete = await prisma.athlete.update({
                where: { id },
                data: dataToUpdate,
                include: { category: true }
            });

            res.json(athlete);
        } catch (e) {
            console.error('[AdminController] Erro ao atualizar atleta:', e);
            res.status(500).json({ error: 'Erro ao atualizar atleta' });
        }
    }

    static async deleteAthlete(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            
            // 1. Check if it's a virtual entry (Format: orderId-catId)
            if (id.includes('-') && id.length > 40) {
                const parts = id.split('-');
                // A UUID is usually 36 chars. If parts[0] is a UUID, it might be an orderId
                if (parts[0].length >= 30) {
                    const orderId = parts[0];
                    const catId = parts.slice(1).join('-'); // Rejoin in case catId has dashes

                    const order = await prisma.order.findUnique({ where: { id: orderId } });
                    if (order) {
                        const currentCats = (order.categoryIds as string[]) || [];
                        const updatedCats = currentCats.filter(c => c !== catId);
                        
                        await prisma.order.update({
                            where: { id: orderId },
                            data: { categoryIds: updatedCats }
                        });
                        return res.json({ success: true, message: 'Categoria removida do pedido.' });
                    }
                }
            }

            // 2. It's a real Athlete record
            const athlete = await prisma.athlete.findUnique({
                where: { id },
                select: { userId: true, championshipId: true, categoryId: true }
            });

            if (athlete) {
                // Also remove this category from the user's orders for this championship
                // to prevent it from reappearing as "Aguardando Portaria"
                const orders = await prisma.order.findMany({
                    where: { 
                        userId: athlete.userId!, 
                        championshipId: athlete.championshipId!,
                        type: 'COMPETITOR',
                        paymentStatus: 'APPROVED'
                    }
                });

                for (const order of orders) {
                    const currentCats = (order.categoryIds as string[]) || [];
                    if (currentCats.includes(athlete.categoryId as string)) {
                        const updatedCats = currentCats.filter(c => c !== athlete.categoryId);
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { categoryIds: updatedCats }
                        });
                    }
                }

                // Delete logs and athlete
                await prisma.stageLog.deleteMany({ where: { athleteId: id } });
                await prisma.athlete.delete({ where: { id } });
            } else {
                // If not found in Athlete table, maybe it's a direct ID that doesn't match the hyphen logic
                // But let's try a direct delete just in case
                try {
                    await prisma.stageLog.deleteMany({ where: { athleteId: id } });
                    await prisma.athlete.delete({ where: { id } });
                } catch (err) {
                    return res.status(404).json({ error: 'Registro não encontrado' });
                }
            }

            res.json({ success: true });
        } catch (e) {
            console.error('[AdminController] Erro ao excluir atleta:', e);
            res.status(500).json({ error: 'Erro ao excluir atleta' });
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const { name, parentName, order } = req.body;

            const updated = await prisma.category.update({
                where: { id },
                data: { 
                    name, 
                    parentName: (parentName === '' || !parentName) ? null : parentName, 
                    order: parseInt(order) 
                }
            });

            res.json(updated);
        } catch (e) {
            console.error('[AdminController] Erro ao atualizar categoria:', e);
            res.status(500).json({ error: 'Erro ao atualizar categoria' });
        }
    }

    // ===== ACOMPANHAMENTO DE CATEGORIAS NO PALCO =====

    /**
     * Define a categoria atual no palco
     */
    static async setCurrentCategory(req: Request, res: Response) {
        try {
            const championshipId = req.params.id as string;
            const { categoryId } = req.body;

            const champ = await prisma.championship.findUnique({ where: { id: championshipId } });
            if (!champ) return res.status(404).json({ error: 'Campeonato não encontrado' });

            // If there's a current category and it's different from the new one, add it to presented
            const updateData: any = { currentCategoryId: categoryId || null };

            if (champ.currentCategoryId && champ.currentCategoryId !== categoryId) {
                // Add the old category to presented list if not already there
                if (!champ.presentedCategoryIds.includes(champ.currentCategoryId)) {
                    updateData.presentedCategoryIds = [...champ.presentedCategoryIds, champ.currentCategoryId];
                }
            }

            const updated = await prisma.championship.update({
                where: { id: championshipId },
                data: updateData,
                include: { categories: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } }
            });

            // Emit WebSocket event
            emitEvent.categoryChanged(championshipId, {
                currentCategoryId: updated.currentCategoryId,
            });

            res.json(updated);
        } catch (e) {
            console.error('[AdminController] Erro ao definir categoria atual:', e);
            res.status(500).json({ error: 'Erro ao definir categoria atual no palco' });
        }
    }

    /**
     * Finaliza a categoria atual (marca como apresentada e limpa o palco)
     */
    static async finishCurrentCategory(req: Request, res: Response) {
        try {
            const championshipId = req.params.id as string;

            const champ = await prisma.championship.findUnique({ where: { id: championshipId } });
            if (!champ) return res.status(404).json({ error: 'Campeonato não encontrado' });

            if (!champ.currentCategoryId) {
                return res.status(400).json({ error: 'Nenhuma categoria está no palco' });
            }

            const updateData: any = { currentCategoryId: null };
            if (!champ.presentedCategoryIds.includes(champ.currentCategoryId)) {
                updateData.presentedCategoryIds = [...champ.presentedCategoryIds, champ.currentCategoryId];
            }

            const updated = await prisma.championship.update({
                where: { id: championshipId },
                data: updateData,
                include: { categories: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } }
            });

            // Emit WebSocket event
            emitEvent.categoryFinished(championshipId, {
                categoryId: champ.currentCategoryId,
                presentedCategoryIds: updated.presentedCategoryIds
            });

            res.json(updated);
        } catch (e) {
            console.error('[AdminController] Erro ao finalizar categoria:', e);
            res.status(500).json({ error: 'Erro ao finalizar categoria no palco' });
        }
    }

    /**
     * Reseta o acompanhamento de categorias (limpa tudo)
     */
    static async resetCategoryTracking(req: Request, res: Response) {
        try {
            const championshipId = req.params.id as string;

            const updated = await prisma.championship.update({
                where: { id: championshipId },
                data: {
                    currentCategoryId: null,
                    presentedCategoryIds: []
                },
                include: { categories: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } }
            });

            // Emit WebSocket event
            emitEvent.categoryChanged(championshipId, {
                currentCategoryId: null
            });

            res.json(updated);
        } catch (e) {
            console.error('[AdminController] Erro ao resetar tracking:', e);
            res.status(500).json({ error: 'Erro ao resetar acompanhamento' });
        }
    }

    static async getPublicCategoryTracking(req: Request, res: Response) {
        try {
            // Try both 'championshipId' (from event.routes) and 'id' (from common patterns)
            const championshipId = (req.params.championshipId || req.params.id) as string;
            
            if (!championshipId) {
                return res.status(400).json({ error: 'ID do campeonato é obrigatório' });
            }

            const champ = await prisma.championship.findUnique({
                where: { id: championshipId },
                include: {
                    categories: {
                        include: {
                            _count: {
                                select: { athletes: true }
                            }
                        },
                        orderBy: [{ order: 'asc' }, { name: 'asc' }]
                    }
                }
            }) as any;

            if (!champ) return res.status(404).json({ error: 'Campeonato não encontrado' });

            // Ensure we have an array for presentedCategoryIds
            const presentedIds = champ.presentedCategoryIds || [];

            // We include all categories that are either subcategories (have parentName)
            // or are standalone categories (no parentName and no subcategories point to them)
            // BUT for the live stage, we typically only care about the subcategories that actually compete.
            const allCategories = champ.categories;
            
            const currentCategory = allCategories.find((c: any) => c.id === champ.currentCategoryId) || null;
            const presentedCategories = allCategories.filter((c: any) => presentedIds.includes(c.id));
            const remainingCategories = allCategories.filter(
                (c: any) => c.id !== champ.currentCategoryId && !presentedIds.includes(c.id)
            );

            res.json({
                championship: {
                    id: champ.id,
                    name: champ.name,
                    date: champ.date,
                    location: champ.location
                },
                currentCategory,
                presentedCategories,
                remainingCategories,
                totalCategories: allCategories.length,
                presentedCount: presentedCategories.length,
                remainingCount: remainingCategories.length
            });
        } catch (e) {
            console.error('[AdminController] Erro ao buscar tracking público:', e);
            res.status(500).json({ error: 'Erro ao buscar acompanhamento' });
        }
    }
}
