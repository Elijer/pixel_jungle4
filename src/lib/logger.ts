import fs from 'fs';
import path from 'path';
import { dirname } from './utilities.js';

class Logger {
  logFilePath: string

  constructor(logFilePath: string) {
    this.logFilePath = logFilePath;
  }

  log(message: string, level = 'INFO') {
    const date = new Date()
    const timestamp2 = date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 2 });
    const logEntry = `[${timestamp2}] [${level}] ${message}`;

    console.log(logEntry);

    fs.appendFile(this.logFilePath, logEntry + "\n", (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
    });
  }

  info = (message: string) => this.log(message, 'INFO');
  warn = (message: string) => this.log(message, 'WARN');
  error = (message: string) => this.log(message, 'ERROR');

}

const logger = new Logger(path.join(dirname(), '../../app.log'));

export const log = logger.log.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);