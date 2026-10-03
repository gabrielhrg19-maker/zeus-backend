import { prisma } from '../prisma';

export class PaymentLogService {
    static async log(data: {
        userId: string;
        orderId?: string;
        type: string;
        amount?: number;
        status: string;
        logMessage: string;
        gatewayResponse?: any;
    }) {
        try {
            await (prisma as any).paymentLog.create({
                data: {
                    userId: data.userId,
                    orderId: data.orderId || null,
                    type: data.type,
                    amount: data.amount || null,
                    status: data.status,
                    logMessage: data.logMessage,
                    gatewayResponse: data.gatewayResponse ? JSON.stringify(data.gatewayResponse) : null
                }
            });
            console.log(`[PaymentLog] ${data.status} - ${data.logMessage}`);
        } catch (error) {
            console.error('[PaymentLog] Failed to create log:', error);
        }
    }
}
