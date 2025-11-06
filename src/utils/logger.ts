/**
 * Structured Production Logger
 * Replaces console.log with structured, searchable logging
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogContext {
  userId?: string;
  transactionId?: string;
  orderId?: string;
  chainId?: number;
  component?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private log(level: LogLevel, message: string, data?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data,
      environment: import.meta.env.MODE
    };

    const logString = JSON.stringify(logEntry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`[${level.toUpperCase()}]`, logString);
        break;
      case LogLevel.INFO:
        console.log(`[${level.toUpperCase()}]`, logString);
        break;
      case LogLevel.WARN:
        console.warn(`[${level.toUpperCase()}]`, logString);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(`[${level.toUpperCase()}]`, logString);
        break;
    }
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any) {
    this.log(LogLevel.ERROR, message, {
      error: error?.message || error,
      stack: error?.stack,
      ...error
    });
  }

  critical(message: string, error?: Error | any) {
    this.log(LogLevel.CRITICAL, message, {
      error: error?.message || error,
      stack: error?.stack,
      ...error
    });
  }
}

export const logger = new Logger();
