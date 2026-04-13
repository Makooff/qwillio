import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { logger } from './logger';

let io: SocketServer | null = null;

export function initSocket(server: Server) {
  io = new SocketServer(server, {
    cors: {
      origin: [
        'https://qwillio.com',
        'https://www.qwillio.com',
        'http://localhost:5173',
      ],
      credentials: true,
    },
  });

  io.on('connection', (socket: any) => {
    logger.info(`[Socket] Client connected: ${socket.id}`);
    socket.on('disconnect', () =>
      logger.debug(`[Socket] Client disconnected: ${socket.id}`)
    );
  });

  logger.info('[Socket] WebSocket server initialized');
  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

export function emitEvent(event: string, data: any) {
  if (io) io.emit(event, data);
}
