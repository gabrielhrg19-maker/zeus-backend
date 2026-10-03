import { Queue } from 'bullmq';
import Redis from 'ioredis';

let queueInstance: any = {
    add: async (name: string, data: any) => {
        console.log(`[Queue Mock] Job '${name}' ignorado (sem Redis configurado).`);
        return null;
    }
};

if (process.env.REDIS_URL) {
    try {
        const redisConnection = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            retryStrategy() {
                return null;
            }
        });

        redisConnection.on('error', () => {});

        queueInstance = new Queue('emails', {
            connection: redisConnection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                },
                removeOnComplete: true,
                removeOnFail: false
            }
        });
    } catch (err) {
        console.warn('[Queue] Erro ao inicializar fila de e-mails:', err);
    }
}

export const emailQueue = queueInstance;
