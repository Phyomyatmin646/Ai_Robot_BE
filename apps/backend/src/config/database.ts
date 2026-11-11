import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let isConnected = false;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return mongoose;
  }

  const options: mongoose.ConnectOptions = {
    dbName: config.MONGODB_DB_NAME,
    autoIndex: config.isDev,
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
      isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    const conn = await mongoose.connect(config.MONGODB_URI, options);
    return conn;
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected cleanly');
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export function getGridFSBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error('Database not connected. Cannot access GridFS.');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'audio_files',
  });
}
