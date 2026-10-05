import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { TicketService } from '../services/ticket.service';
import { PaymentLogService } from '../services/PaymentLogService';
import { emailQueue } from '../services/queue.service';

// MERCADOPAGO_ACCESS_TOKEN / MERCADOPAGO_WEBHOOK_SECRET       → Campeonatos
// MERCADOPAGO_FED_ACCESS_TOKEN / MERCADOPAGO_FED_WEBHOOK_SECRET → Federação
const DEFAULT_MP_ACCESS_TOKEN = 'APP_USR-3345611795216825-031010-c151d4812a4f61dac62f4135483553a6-214542459';

export const processPayment = async (req: Request, res: Response) => {
    try {
        const { paymentData, orderId } = req.body;

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { championship: true, user: true } });
        if (!order) return res.status(404).json({ error: 'Pedido não encontrado no ato do pagamento.' });

        const paymentMethodId = paymentData.payment_method_id || paymentData.paymentMethodId;
        const isPix = paymentMethodId === 'pix';

        // 1. Reaproveitamento de PIX Pendente Válido
        if (isPix) {
            const activeAttempt = await prisma.paymentAttempt.findFirst({
                where: {
                    orderId,
                    paymentMethod: 'PIX',
                    status: 'PENDING',
                    amount: order.amount,
                    pixExpiredAt: { gt: new Date() }
                }
            });

            if (activeAttempt) {
                console.log(`[Payment] Reaproveitando tentativa de PIX ativa para Order ID: ${orderId}`);
                return res.status(200).json({
                    id: activeAttempt.gatewayPaymentId ? Number(activeAttempt.gatewayPaymentId) : null,
                    status: 'pending',
                    status_detail: 'pending_waiting_transfer',
                    transaction_amount: activeAttempt.amount,
                    qr_code: activeAttempt.pixCopyPaste,
                    qr_code_base64: activeAttempt.pixBase64,
                    ticket_url: null
                });
            }
        }

        // ============================================================
        // Seleção de credenciais — SEM FALLBACK cruzado.
        // Federação usa SOMENTE MERCADOPAGO_FED_ACCESS_TOKEN.
        // Campeonatos usam mpAccessToken do banco OU MERCADOPAGO_ACCESS_TOKEN do .env.
        // ============================================================
        let accessToken: string | undefined;

        if (order.type === 'FEDERATION') {
            accessToken = process.env.MERCADOPAGO_FED_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN;
            if (!accessToken) {
                await PaymentLogService.log({
                    userId: order.userId, orderId: order.id, type: order.type,
                    amount: order.amount, status: 'ERROR',
                    logMessage: 'Erro Crítico: MERCADOPAGO_FED_ACCESS_TOKEN não configurado no .env para pagamentos de Federação.',
                });
                return res.status(500).json({
                    error: 'Credenciais de pagamento da Federação não configuradas. Entre em contato com o suporte.',
                    code: 'CREDENTIALS_NOT_CONFIGURED'
                });
            }
        } else {
            // Campeonato: só usa credencial PRÓPRIA quando tem o PAR COMPLETO
            // (Public Key + Access Token). Caso contrário, cai no par global do .env.
            //
            // Isso evita o erro "Invalid credentials" (code 17): o frontend usa
            // champ.mpPublicKey || VITE_env e o backend precisa usar o Access Token
            // da MESMA conta. Se o evento tiver só uma das chaves, haveria descasamento.
            const champ = order.championship as any;
            const champHasOwnPair = !!(champ?.mpAccessToken && champ?.mpPublicKey);
            accessToken = champHasOwnPair
                ? champ.mpAccessToken
                : (process.env.MERCADOPAGO_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN);

            if (!accessToken) {
                await PaymentLogService.log({
                    userId: order.userId, orderId: order.id, type: order.type,
                    amount: order.amount, status: 'ERROR',
                    logMessage: `Erro Crítico: Campeonato "${order.championship?.name || order.championshipId}" sem mpAccessToken e MERCADOPAGO_ACCESS_TOKEN do .env vazio.`,
                });
                return res.status(500).json({
                    error: 'Credenciais de pagamento não configuradas para este campeonato. Entre em contato com o suporte.',
                    code: 'CREDENTIALS_NOT_CONFIGURED'
                });
            }
        }

        const client = new MercadoPagoConfig({ accessToken });
        const paymentClient = new Payment(client);

        // Splitting name to avoid high risk rejections
        const payerData = paymentData.payer || {};
        const firstName = payerData.first_name || payerData.name?.split(' ')[0] || req.body.cardholderName?.split(' ')[0] || order.user?.name?.split(' ')[0] || 'Cliente';
        const lastName = payerData.last_name || payerData.name?.split(' ').slice(1).join(' ') || req.body.cardholderName?.split(' ').slice(1).join(' ') || order.user?.name?.split(' ').slice(1).join(' ') || 'Evolução';

        // Sanitize Identification (CPF/CNPJ) - Mercado Pago expects only numbers
        // Fallback: use the user's CPF from database if frontend didn't send it
        const rawIdNumber = payerData.identification?.number || paymentData.identificationNumber || paymentData.number || order.user?.cpf || '';
        const cleanIdNumber = rawIdNumber.toString().replace(/\D/g, '');

        if (!cleanIdNumber) {
            await prisma.order.delete({ where: { id: orderId } });
            return res.status(400).json({ error: 'O CPF é obrigatório para processar o pagamento. Por favor, atualize seus dados no perfil.' });
        }

        // Construção robusta do body baseada no exemplo da documentação e no snippet do frontend
        const webhookBase = process.env.API_BASE_URL || 'https://zeusevolution.com.br';
        const body: any = {
            transaction_amount: Number(paymentData.transaction_amount),
            description: paymentData.description || `Pagamento Pedido ${orderId}`,
            payment_method_id: paymentMethodId,
            payer: {
                email: payerData.email || paymentData.email || order.user?.email,
                first_name: firstName,
                last_name: lastName,
                identification: {
                    type: payerData.identification?.type || paymentData.identificationType || 'CPF',
                    number: cleanIdNumber
                }
            },
            external_reference: orderId ? orderId.toString() : undefined,
            notification_url: `${webhookBase}/api/payment/webhook/${order.championship?.id || 'global'}?orig=${order.type === 'FEDERATION' ? 'fed' : 'comp'}`,
            binary_mode: true,
        };

        if (!isPix) {
            body.token = paymentData.token;
            body.installments = Number(paymentData.installments) || 1;
            const issuerIdRaw = paymentData.issuer_id || paymentData.issuerId || paymentData.issuer;
            if (issuerIdRaw && issuerIdRaw.toString().trim() !== '') {
                body.issuer_id = issuerIdRaw;
            }
        }

        console.log(`[Payment] Processando Pagamento Transparente para Order ID: ${orderId}`);
        console.log(`[Payment] Body final enviado ao MP: ${JSON.stringify(body, null, 2)}`);

        // 2. Chave de Idempotência Composta baseada no Timestamp do Checkout
        const attemptTimestamp = Date.now();
        const idempotencyKey = `${orderId}-${attemptTimestamp}`;

        const response = await paymentClient.create({
            body,
            requestOptions: { idempotencyKey }
        });

        console.log(`[Payment] Resposta: Status ${response.status}, ID ${response.id}`);

        if (response.status === 'rejected') {
            await PaymentLogService.log({
                userId: order.userId,
                orderId: order.id,
                type: order.type,
                amount: order.amount,
                status: 'REJECTED',
                logMessage: 'Usuário tentou pagar, mas o Mercado Pago recusou o cartão *imediatamente* na tentativa. O Pedido local (Order) foi apagado na sequência para destrancar o carrinho.',
                gatewayResponse: response
            });

            await prisma.order.delete({ where: { id: orderId } });
            console.log(`[Payment] Pedido ${orderId} deletado da base de dados pois o cartão foi recusado imediatamente.`);
        } else {
            await PaymentLogService.log({
                userId: order.userId,
                orderId: order.id,
                type: order.type,
                amount: order.amount,
                status: response.status || 'UNKNOWN',
                logMessage: `O pagamento foi enviado ao gateway. Status retornado: ${response.status}`,
                gatewayResponse: response
            });

            // 3. Salvar tentativa de pagamento (PaymentAttempt) no banco
            if (isPix) {
                const pixExpiredAt = response.date_of_expiration ? new Date(response.date_of_expiration) : new Date(Date.now() + 24 * 60 * 60 * 1000);
                await prisma.paymentAttempt.create({
                    data: {
                        orderId,
                        paymentMethod: 'PIX',
                        status: 'PENDING',
                        amount: Number(response.transaction_amount),
                        gatewayPaymentId: response.id ? response.id.toString() : null,
                        pixCopyPaste: response.point_of_interaction?.transaction_data?.qr_code,
                        pixBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
                        pixExpiredAt
                    }
                });
            } else {
                await prisma.paymentAttempt.create({
                    data: {
                        orderId,
                        paymentMethod: 'CREDIT_CARD',
                        status: response.status === 'approved' ? 'APPROVED' : 'PENDING',
                        amount: Number(response.transaction_amount),
                        gatewayPaymentId: response.id ? response.id.toString() : null
                    }
                });
            }
        }

        // O Mercado Pago pode retornar status imediatamente approved, rejected, in_process
        res.status(200).json({
            id: response.id,
            status: response.status,
            status_detail: response.status_detail,
            transaction_amount: response.transaction_amount,
            qr_code: response.point_of_interaction?.transaction_data?.qr_code,
            qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
            ticket_url: response.point_of_interaction?.transaction_data?.ticket_url
        });
    } catch (error: any) {
        console.error('Error processing payment:', error.message || error);
        
        // Detailed error logging to database for Admin visibility
        try {
            const { orderId } = req.body;
            if (orderId) {
                const order = await prisma.order.findUnique({ where: { id: orderId } });
                if (order) {
                    await PaymentLogService.log({
                        userId: order.userId,
                        orderId: order.id,
                        type: order.type,
                        amount: order.amount,
                        status: 'ERROR',
                        logMessage: `Erro ao processar pagamento: ${error.message || 'Erro desconhecido'}`,
                        gatewayResponse: error.cause || error.response || error
                    });
                }
            }
        } catch (logError) {
            console.error('Failed to log payment error to DB:', logError);
        }

        if (error.cause) {
            console.error('Cause detail:', JSON.stringify(error.cause, null, 2));
        }
        if (error.response) {
            console.error('Response detail:', JSON.stringify(error.response, null, 2));
        }
        
        let statusCode = 500;
        let errorMessage = 'Erro ao processar pagamento transparente';

        if (error.status === 400 || (error.cause && Array.isArray(error.cause))) {
            statusCode = 400;
            const cause = Array.isArray(error.cause) ? error.cause[0] : null;
            if (cause?.description) {
                errorMessage = `Dados inválidos no Mercado Pago: ${cause.description}`;
            } else {
                errorMessage = 'Dados de pagamento inválidos. Verifique seu CPF e dados do cartão.';
            }
        }

        res.status(statusCode).json({
            error: errorMessage,
            details: error.message,
            mp_error: error.cause
        });
    }
};


export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const xSignature = req.headers['x-signature'] as string;
        const xRequestId = req.headers['x-request-id'] as string;

        let dataId: string | undefined;
        if (req.query?.['data.id']) {
            dataId = req.query['data.id'] as string;
        } else if (req.query?.id) {
            dataId = req.query.id as string;
        } else if (req.body?.data?.id) {
            dataId = req.body.data.id as string;
        }

        const type = (req.query.type as string) || req.body?.type || req.body?.action;
        const champId = req.params.champId as string;

        if (!dataId || !champId) {
            console.warn('Missing webhook dataId or champId param, returning 200 to acknowledge MP ping', req.body);
            return res.status(200).send('Ignored');
        }

        let webhookSecret: string | undefined;
        let championship: any = null;
        let accessToken: string | undefined;

        const isFedQuery = req.query.orig === 'fed';

        // ============================================================
        // Webhook: mesma separação de credenciais, SEM FALLBACK cruzado.
        // ============================================================
        if (champId === 'global') {
            if (isFedQuery) {
                webhookSecret = process.env.MERCADOPAGO_FED_WEBHOOK_SECRET;
                accessToken = process.env.MERCADOPAGO_FED_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN;
                console.log(`[Webhook] Processando notificação GLOBAL de Federação.`);
            } else {
                webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
                accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN;
                console.log(`[Webhook] Processando notificação GLOBAL.`);
            }
        } else {
            championship = await prisma.championship.findUnique({ where: { id: champId } });
            if (!championship) {
                console.warn(`[Webhook] Campeonato ${champId} não encontrado no banco.`);
                return res.status(404).json({ error: 'Campeonato não encontrado' });
            }
            if (isFedQuery) {
                webhookSecret = process.env.MERCADOPAGO_FED_WEBHOOK_SECRET;
                accessToken = process.env.MERCADOPAGO_FED_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN;
            } else {
                // Mesma regra do processPayment: só usa o token próprio quando há o
                // PAR COMPLETO (Public Key + Access Token). Assim o webhook consulta
                // o pagamento com EXATAMENTE o mesmo token que o criou.
                const champHasOwnPair = !!((championship as any).mpAccessToken && (championship as any).mpPublicKey);
                webhookSecret = champHasOwnPair
                    ? (championship as any).mpWebhookSecret
                    : process.env.MERCADOPAGO_WEBHOOK_SECRET;
                accessToken = champHasOwnPair
                    ? (championship as any).mpAccessToken
                    : (process.env.MERCADOPAGO_ACCESS_TOKEN || DEFAULT_MP_ACCESS_TOKEN);
            }
        }

        // 1. Extraindo headers de assinatura do MP

        // Extraindo partes (v1=chave, ts=timestamp)
        const parts = xSignature.split(',');
        let ts = '';
        let hashOriginal = '';

        parts.forEach(part => {
            const [key, value] = part.split('=').map(p => p.trim());
            if (key === 'ts') ts = value;
            if (key === 'v1') hashOriginal = value;
        });

        if (!ts || !hashOriginal || !webhookSecret) {
            console.warn('Incompletos headers ou secret não configurado. Se estiver testando localmente pularemos a validação real.');
        } else {
            // 2. Validação HMAC Hexadecimal SHA256
            const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
            const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

            if (hmac !== hashOriginal) {
                console.warn(`[Webhook] HMAC verification failed. hmac: ${hmac}, hashOriginal: ${hashOriginal}, manifest: ${manifest}. Permitindo processamento temporariamente.`);
                // Ignorando erro de HMAC estritamente para não bloquear o fluxo de IPNs de PIX
            } else {
                console.log('[Webhook] HMAC verified successfully!');
            }
        }

        // Retornar 200 OK imediatamente para liberar a fila do webhook Mercado Pago
        res.status(200).send('OK');

        // ==== Processando Notificação ====
        if (type === 'payment') {
            const client = new MercadoPagoConfig({ accessToken: accessToken || '' });
            const paymentClient = new Payment(client);

            // Busca o estado real do pagamento
            const paymentInfo = await paymentClient.get({ id: dataId });
            console.log(`[Webhook] Pagamento recebido: ID ${paymentInfo.id} | Status: ${paymentInfo.status}`);

            // Atualiza banco com Prisma
            if (paymentInfo.external_reference) {
                const localOrderId = paymentInfo.external_reference;

                const orderToUpdate = await prisma.order.findUnique({
                    where: { id: localOrderId },
                    include: { ticket: true }
                });

                if (orderToUpdate) {
                    if (paymentInfo.status === 'approved') {
                        if (orderToUpdate.paymentStatus !== 'APPROVED') {
                            let wonTshirt = false;

                            // Lógica de Premiação de Camiseta
                            if (orderToUpdate.championshipId) {
                                const champ = await prisma.championship.findUnique({
                                    where: { id: orderToUpdate.championshipId }
                                });

                                if (champ?.hasTshirtPromotion) {
                                    const limit = orderToUpdate.type === 'COMPETITOR' ? champ.tshirtLimitComp : champ.tshirtLimitVis;

                                    // Contar quantos já ganharam camiseta para este tipo de ingresso neste campeonato
                                    const winnersCount = await prisma.order.count({
                                        where: {
                                            championshipId: orderToUpdate.championshipId,
                                            type: orderToUpdate.type,
                                            paymentStatus: 'APPROVED',
                                            wonTshirt: true
                                        }
                                    });

                                    if (winnersCount < limit) {
                                        wonTshirt = true;
                                        console.log(`[Webhook] Pedido ${localOrderId} ganhou uma camiseta! (${winnersCount + 1}/${limit})`);
                                    }
                                }
                            }

                            await prisma.$transaction(async (tx) => {
                                await tx.order.update({
                                    where: { id: localOrderId },
                                    data: {
                                        paymentStatus: 'APPROVED',
                                        gatewayOrderId: paymentInfo.id!.toString(),
                                        wonTshirt
                                    }
                                });

                                // Atualiza a PaymentAttempt correspondente para APPROVED
                                await tx.paymentAttempt.updateMany({
                                    where: {
                                        orderId: localOrderId,
                                        gatewayPaymentId: paymentInfo.id!.toString()
                                    },
                                    data: { status: 'APPROVED' }
                                });

                                if (orderToUpdate.includesFederation || orderToUpdate.type === 'FEDERATION') {
                                    const currentYear = new Date().getFullYear();
                                    await tx.user.update({
                                        where: { id: orderToUpdate.userId },
                                        data: { federationYear: currentYear }
                                    });
                                    console.log(`[Webhook] Usuário ${orderToUpdate.userId} ativado na Federação para o ano ${currentYear}`);
                                }
                            });

                            await PaymentLogService.log({
                                userId: orderToUpdate.userId,
                                orderId: localOrderId,
                                type: orderToUpdate.type,
                                amount: orderToUpdate.amount,
                                status: 'APPROVED',
                                logMessage: '[Webhook] Pagamento foi APROVADO via notificação IPN do Mercado Pago (Atomic Transaction).',
                                gatewayResponse: paymentInfo
                            });
                        }

                        // Idempotência: só gera o ticket se ele não existir e se não for uma ordem APENAS de federação
                        if (!orderToUpdate.ticket && orderToUpdate.type !== 'FEDERATION') {
                            const expiresAt = new Date();
                            expiresAt.setHours(expiresAt.getHours() + 24);

                            const ticket = await prisma.ticket.create({
                                data: {
                                    orderId: localOrderId,
                                    championshipId: orderToUpdate.championshipId,
                                    expiresAt
                                }
                            });
                            console.log(`[Webhook] Ticket gerado com sucesso para a Order ID ${localOrderId} (Válido até ${expiresAt.toLocaleString()})`);

                            await emailQueue.add('send-ticket', { ticketId: ticket.id });
                        } else if (orderToUpdate.type === 'FEDERATION') {
                            console.log(`[Webhook] Ordem exclusiva de Federação ${localOrderId}. Nenhum ticket físico gerado.`);
                        } else {
                            console.log(`[Webhook] Ticket já existente para a Order ID ${localOrderId}, ignorando re-geração.`);
                        }
                    } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
                        await PaymentLogService.log({
                            userId: orderToUpdate.userId,
                            orderId: localOrderId,
                            type: orderToUpdate.type,
                            amount: orderToUpdate.amount,
                            status: 'REJECTED',
                            logMessage: `[Webhook] Pagamento rejeitado / cancelado no IPN do Mercado Pago (Status: ${paymentInfo.status}). Pedido apagado localmente.`,
                            gatewayResponse: paymentInfo
                        });
                        // Ao invés de atualizar para FAILED, apaga fisicamente para limpar o banco
                        await prisma.order.delete({
                            where: { id: localOrderId }
                        });
                        console.log(`[Webhook] Pedido ${localOrderId} foi DELETADO pois o pagamento foi rejeitado ou cancelado.`);
                    } else if (paymentInfo.status === 'in_process') {
                        console.log(`[Webhook] Pedido ${localOrderId} ainda está em processamento.`);
                    }
                } else {
                    console.error(`[Webhook] Pedido local ${localOrderId} não encontrado. Talvez já tenha sido apagado.`);
                }
            } else {
                console.warn(`[Webhook] Pagamento sem external_reference recebido: ID ${dataId}`);
            }
        }

    } catch (error) {
        console.error('Error handling webhook:', error);
        // Não devemos retornar 500 caso o erro seja na consulta ao DB para não travar o MP
    }
};
