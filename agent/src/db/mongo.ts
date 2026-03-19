import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config';

let db: Db | null = null;

export async function getDB(): Promise<Db> {
  if (db) return db;
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db('willeth');
  console.log('[MongoDB] Connected');
  return db;
}

export interface TelegramRegistration {
  walletAddress: string; // lowercase
  chatId: string;
  createdAt: Date;
}

export interface ReminderLog {
  willAddress: string;
  chatId: string;
  sentAt: Date;
  daysRemaining: number;
}

export async function registrationsCol(): Promise<Collection<TelegramRegistration>> {
  const d = await getDB();
  return d.collection<TelegramRegistration>('telegram_registrations');
}

export async function reminderLogCol(): Promise<Collection<ReminderLog>> {
  const d = await getDB();
  return d.collection<ReminderLog>('reminder_log');
}
