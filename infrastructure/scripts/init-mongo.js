// MongoDB Initialization Script for AI Voice Assistant Robot Platform

db = db.getSiblingDB('ai-robot');

print('Initializing ai-robot MongoDB database...');

// Create collections
db.createCollection('users');
db.createCollection('devices');
db.createCollection('devicesessions');
db.createCollection('conversations');
db.createCollection('messages');
db.createCollection('audiometadatas');
db.createCollection('todos');
db.createCollection('reminders');
db.createCollection('notifications');
db.createCollection('usersettings');
db.createCollection('devicesettings');
db.createCollection('knowledgedocuments');
db.createCollection('knowledgechunks');
db.createCollection('toolexecutionlogs');

// Indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.devices.createIndex({ macAddress: 1 }, { unique: true });
db.devices.createIndex({ userId: 1, status: 1 });
db.conversations.createIndex({ userId: 1, lastMessageAt: -1 });
db.messages.createIndex({ conversationId: 1, createdAt: 1 });
db.todos.createIndex({ userId: 1, status: 1, dueDate: 1 });
db.todos.createIndex({ title: 'text', description: 'text' });
db.reminders.createIndex({ userId: 1, status: 1, scheduledAt: 1 });
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.knowledgechunks.createIndex({ content: 'text' });

print('MongoDB collections and standard indexes created successfully.');

