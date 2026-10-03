import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer): SocketIOServer {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
        console.log(`[WebSocket] Cliente conectado: ${socket.id}`);

        // Join championship room for targeted events
        socket.on('join:championship', (championshipId: string) => {
            socket.join(`championship:${championshipId}`);
            console.log(`[WebSocket] ${socket.id} entrou na sala championship:${championshipId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[WebSocket] Cliente desconectado: ${socket.id}`);
        });
    });

    console.log('[WebSocket] Socket.IO inicializado com sucesso');
    return io;
}

export function getIO(): SocketIOServer {
    if (!io) {
        throw new Error('[WebSocket] Socket.IO não inicializado. Chame initSocket() primeiro.');
    }
    return io;
}

// Helper functions to emit events
export const emitEvent = {
    // When admin changes the current category on stage
    categoryChanged: (championshipId: string, data: { currentCategoryId: string | null; categoryName?: string }) => {
        if (!io) return;
        io.to(`championship:${championshipId}`).emit('category:changed', data);
        io.emit('category:changed', { ...data, championshipId }); // Global broadcast too
    },

    // When admin finishes a category on stage
    categoryFinished: (championshipId: string, data: { categoryId: string; presentedCategoryIds: string[] }) => {
        if (!io) return;
        io.to(`championship:${championshipId}`).emit('category:finished', data);
        io.emit('category:finished', { ...data, championshipId });
    },

    // When an athlete advances stage
    athleteAdvanced: (championshipId: string, data: { athleteId: string; stageName?: string }) => {
        if (!io) return;
        io.to(`championship:${championshipId}`).emit('athlete:advanced', data);
    },

    // When a judge submits scores
    scoresSubmitted: (championshipId: string, data: { judgeId: string; categoryId: string; status: string }) => {
        if (!io) return;
        io.to(`championship:${championshipId}`).emit('scores:submitted', data);
        io.emit('scores:submitted', { ...data, championshipId });
    },

    // When admin approves/publishes session
    sessionUpdated: (championshipId: string, data: { sessionId: string; status: string; categoryId: string }) => {
        if (!io) return;
        io.to(`championship:${championshipId}`).emit('session:updated', data);
        io.emit('session:updated', { ...data, championshipId });
    },

    // When results are published
    resultsPublished: (championshipId: string, data: { categoryId: string }) => {
        if (!io) return;
        io.to(`championship:${championshipId}`).emit('results:published', data);
        io.emit('results:published', { ...data, championshipId });
    },

    // Generic refresh signal
    dataRefresh: (scope: string) => {
        if (!io) return;
        io.emit('data:refresh', { scope, timestamp: Date.now() });
    }
};
