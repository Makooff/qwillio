import winston from 'winston';
import Transport from 'winston-transport';
import { env } from './env';
import { addLog } from './log-store';

/** Custom transport — captures logs in the in-memory ring buffer */
class MemoryTransport extends Transport {
  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));
    addLog({
      timestamp: info.timestamp || new Date().toISOString(),
      level: info.level as 'error' | 'warn' | 'info' | 'debug',
      message: typeof info.message === 'string' ? info.message : JSON.stringify(info.message),
      service: info.service,
      stack: info.stack,
    });
    callback();
  }
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'qwillio' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new MemoryTransport(),
  ],
});
