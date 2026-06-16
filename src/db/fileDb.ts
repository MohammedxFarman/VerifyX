import fs from 'fs';
import path from 'path';
import { User, VerificationHistory } from '../types';

const DB_FILE = path.join(process.cwd(), 'src', 'db', 'data.json');

interface DbSchema {
  users: User[];
  passwords: { [userId: string]: string }; // userId -> hashed password
  history: VerificationHistory[];
}

// Initial default state
let dbState: DbSchema = {
  users: [],
  passwords: {},
  history: [],
};

// Seed initial history item examples for demo purpose when DB is empty
const seedHistory = (): VerificationHistory[] => [
  {
    id: 'seed-1',
    userId: 'any',
    type: 'news',
    target: '"Breaking: WhatsApp forwards claim lemon water cures malware virus." Description of viral media.',
    title: 'Lemon Water Remedy Claim',
    score: 12,
    riskLevel: 'HIGH',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    details: {
      explanation: 'This is a classic medical misinformation myth. No scientific study supports this claim.',
      trustedReferences: ['WHO Fact Check', 'Alt News Health desk'],
    },
  },
  {
    id: 'seed-2',
    userId: 'any',
    type: 'website',
    target: 'http://secure-login-hdfc-banking-update.com',
    title: 'HDFC Bank Update Phishing Link',
    score: 5,
    riskLevel: 'HIGH',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    details: {
      summary: 'High probability of phishing. Non-HTTPS redirect, domain registered 2 days ago in anomalous registrar.',
      suggestions: ['Do not enter any bank credentials.', 'Report to Indian Cybercrime Cell.'],
    },
  },
  {
    id: 'seed-3',
    userId: 'any',
    type: 'image',
    target: 'Suspicious profile image from Twitter',
    title: 'Visual Verification - Twitter Profile',
    score: 87,
    riskLevel: 'LOW',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    details: {
      explanation: 'No signs of digital tampering or Photoshop manipulation found. Symmetrical noise pattern matches typical focal length.',
    },
  }
];

// Helper to ensure db dir exists and load database
function loadDb() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(data);
    } else {
      dbState.history = seedHistory();
      saveDb();
    }
  } catch (error) {
    console.error('Failed to load database file, using empty schema:', error);
    dbState = { users: [], passwords: {}, history: seedHistory() };
  }
}

function saveDb() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save to database file:', error);
  }
}

// Ensure database is initialized
loadDb();

export const FileDb = {
  getUsers: (): User[] => {
    return dbState.users;
  },

  getUserById: (id: string): User | undefined => {
    return dbState.users.find(u => u.id === id);
  },

  getUserByEmail: (email: string): User | undefined => {
    return dbState.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  createUser: (user: User, passwordHash: string): User => {
    dbState.users.push(user);
    dbState.passwords[user.id] = passwordHash;
    saveDb();
    return user;
  },

  getPasswordHash: (userId: string): string | undefined => {
    return dbState.passwords[userId];
  },

  updateUserApiKey: (userId: string, apiKey: string): User | undefined => {
    const user = dbState.users.find(u => u.id === userId);
    if (user) {
      user.apiKey = apiKey;
      saveDb();
    }
    return user;
  },

  addHistory: (record: Omit<VerificationHistory, 'id' | 'timestamp'>): VerificationHistory => {
    const newRecord: VerificationHistory = {
      ...record,
      id: 'rec_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
    };
    dbState.history.push(newRecord);
    saveDb();
    return newRecord;
  },

  getHistoryById: (id: string): VerificationHistory | undefined => {
    return dbState.history.find(h => h.id === id);
  },

  updateHistory: (id: string, updates: Partial<VerificationHistory>): VerificationHistory | undefined => {
    const idx = dbState.history.findIndex(h => h.id === id);
    if (idx === -1) return undefined;
    const existing = dbState.history[idx];
    const merged: VerificationHistory = {
      ...existing,
      ...updates,
      id: existing.id,
      timestamp: new Date().toISOString(),
    };
    dbState.history[idx] = merged;
    saveDb();
    return merged;
  },

  getHistoryByUserId: (userId: string): VerificationHistory[] => {
    // Return combined seed data and user specific data for rich demo experience
    return dbState.history.filter(h => h.userId === userId || h.userId === 'any');
  },

  deleteHistoryItem: (id: string, userId: string): boolean => {
    const initialLen = dbState.history.length;
    dbState.history = dbState.history.filter(h => !(h.id === id && (h.userId === userId || h.userId === 'any')));
    if (dbState.history.length < initialLen) {
      saveDb();
      return true;
    }
    return false;
  }
};
