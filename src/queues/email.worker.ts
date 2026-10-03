import { TicketService } from '../services/ticket.service';
import { EmailService } from '../services/email.service';

export const startEmailWorker = () => {
    if (!process.env.REDIS_URL) {
        console.log('[Worker] REDIS_URL não configurada. Worker de emails desativado (sem Redis).');
        return null;
    }

    try {
        const { Worker, Job } = require('bullmq');
        const Redis = require('ioredis');

        const redisConnection = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            retryStrategy() {
                return null;
            }
        });

        redisConnection.on('error', () => {});

        const worker = new Worker('emails', async (job: any) => {
            console.log(`[Worker] Processando job ${job.id} de tipo ${job.name}`);
            
            if (job.name === 'send-ticket') {
                const { ticketId } = job.data;
                console.log(`[Worker] Gerando ticket e enviando email para o Ticket ID: ${ticketId}`);
                await TicketService.generateAndSendTicket(ticketId);
            } else if (job.name === 'send-password-reset') {
                const { email, name, resetLink } = job.data;
                console.log(`[Worker] Enviando email de recuperação de senha para: ${email}`);
                await EmailService.sendPasswordResetEmail(email, name, resetLink);
            }
        }, {
            connection: redisConnection,
            concurrency: 2
        });

        console.log('[Worker] Worker de Emails inicializado.');
        return worker;
    } catch (err) {
        console.warn('[Worker] Erro ao inicializar worker de emails:', err);
        return null;
    }
};
