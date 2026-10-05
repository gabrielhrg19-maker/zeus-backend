import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket } from './socket';
import authRoutes from './routes/auth.routes';
import championshipRoutes from './routes/championships.routes';
import orderRoutes from './routes/orders.routes';
import ticketRoutes from './routes/tickets.routes';
import creditCardRoutes from './routes/creditCards.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import uploadRoutes from './routes/upload.routes';
import eventRoutes from './routes/event.routes';
import collaboratorRoutes from './routes/collaborator.routes';
import partnerRoutes from './routes/partner.routes';
import siteSettingRoutes from './routes/siteSetting.routes';
import { startEmailWorker } from './queues/email.worker';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket
initSocket(httpServer);

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/championships', championshipRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/credit-cards', creditCardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/collaborators', collaboratorRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/site-settings', siteSettingRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[${new Date().toISOString()}] EXPRESS UNHANDLED ERROR:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
});

process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] UNCAUGHT EXCEPTION:`, error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] UNHANDLED REJECTION at:`, promise, 'reason:', reason);
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server API is running on http://0.0.0.0:${PORT}`);
    console.log(`[WebSocket] Socket.IO listening on port ${PORT}`);
    
    // Start background email queue worker
    startEmailWorker();
});
