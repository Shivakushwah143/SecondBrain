export interface User {
  id: string;
  username: string;
  createdAt?: string;
  telegramChatId?: string;
  telegramUsername?: string;
}

export interface Reminder {
  _id: string;
  title: string;
  description?: string;
  reminderTime: string;
  repeat: 'once' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  telegramChatId?: string;
  userId: string;
}

export interface Content {
  _id: string;
  title: string;
  link: string;
  type: 'youtube' | 'twitter' | 'pdf';
  userId: string;
  tags: string[];
  createdAt: string;
}

export type Captures = Content;
export interface PDFCollection {
  _id: string;
  name: string;
  originalName: string;
  uploadDate: string;
  chunks: number;
  vectorCollectionName: string;
}

export interface Stats {
  totalCaptures: number;
  totalLibraries: number;
  totalCollections: number;
  recentActivity: number;
  activeReminders: number;
}

export interface TelegramBotStatus {
  isActive: boolean;
}

export type DashboardTab = 'dashboard' | 'content' | 'pdf' | 'ai' | 'reminders' | 'telegram' | 'notion' | 'share';
export type OverviewTab = DashboardTab;

export type ReminderRepeat = Reminder['repeat'];

export interface NewReminder {
  title: string;
  description: string;
  reminderTime: string;
  repeat: ReminderRepeat;
}
