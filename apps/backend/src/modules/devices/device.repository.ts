import { BaseRepository } from '../../shared/base.repository.js';
import { IDevice, IDeviceSession, DeviceModel, DeviceSessionModel } from './device.model.js';
import { DeviceStatus } from '@ai-robot/shared-types';
import mongoose from 'mongoose';

export class DeviceRepository extends BaseRepository<IDevice> {
  constructor() {
    super(DeviceModel);
  }

  async findByMac(mac: string, includeSecret = false): Promise<IDevice | null> {
    const query = this.model.findOne({ macAddress: mac.toUpperCase() });
    if (includeSecret) query.select('+apiKeyHash');
    return query.exec();
  }

  async findByIdWithSecret(id: string): Promise<IDevice | null> {
    return this.model.findById(id).select('+apiKeyHash').exec();
  }

  async findByUser(userId: string): Promise<IDevice[]> {
    return this.model.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(id: string, status: DeviceStatus, ipAddress?: string): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      lastSeen: new Date(),
    };
    if (ipAddress) update.ipAddress = ipAddress;
    await this.model.findByIdAndUpdate(id, { $set: update }).exec();
  }

  async createSession(
    deviceId: string,
    userId: string,
    connectionType: import('@ai-robot/shared-types').ConnectionType,
    ipAddress?: string,
    socketId?: string
  ): Promise<IDeviceSession> {
    // Terminate any existing active sessions
    await DeviceSessionModel.updateMany(
      { deviceId: new mongoose.Types.ObjectId(deviceId), isActive: true },
      { $set: { isActive: false, endedAt: new Date(), disconnectReason: 'new_session_started' } }
    );

    return DeviceSessionModel.create({
      deviceId: new mongoose.Types.ObjectId(deviceId),
      userId: new mongoose.Types.ObjectId(userId),
      connectionType,
      ipAddress,
      socketId,
      isActive: true,
      startedAt: new Date(),
    });
  }

  async endSession(deviceId: string, reason = 'client_disconnected'): Promise<void> {
    await DeviceSessionModel.updateMany(
      { deviceId: new mongoose.Types.ObjectId(deviceId), isActive: true },
      { $set: { isActive: false, endedAt: new Date(), disconnectReason: reason } }
    );
  }
}

export const deviceRepository = new DeviceRepository();
