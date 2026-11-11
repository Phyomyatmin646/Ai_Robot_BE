import { BaseRepository } from '../../shared/base.repository.js';
import { IUserSettings, IDeviceSettings, UserSettingsModel, DeviceSettingsModel } from './settings.model.js';
import mongoose from 'mongoose';

export class SettingsRepository {
  private readonly userSettingsRepo = new (class extends BaseRepository<IUserSettings> {
    constructor() {
      super(UserSettingsModel);
    }
  })();

  private readonly deviceSettingsRepo = new (class extends BaseRepository<IDeviceSettings> {
    constructor() {
      super(DeviceSettingsModel);
    }
  })();

  async getUserSettings(userId: string): Promise<IUserSettings | null> {
    return this.userSettingsRepo.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  }

  async createUserSettings(userId: string, data: Partial<IUserSettings>): Promise<IUserSettings> {
    return this.userSettingsRepo.create({
      userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
      ...data,
    });
  }

  async updateUserSettings(userId: string, data: Partial<IUserSettings>): Promise<IUserSettings | null> {
    return this.userSettingsRepo.updateById(
      userId,
      { $set: data },
      { new: true, upsert: true }
    );
  }

  async getDeviceSettings(deviceId: string): Promise<IDeviceSettings | null> {
    return this.deviceSettingsRepo.findOne({ deviceId: new mongoose.Types.ObjectId(deviceId) });
  }

  async createDeviceSettings(
    deviceId: string,
    userId: string,
    data: Partial<IDeviceSettings>
  ): Promise<IDeviceSettings> {
    return this.deviceSettingsRepo.create({
      deviceId: new mongoose.Types.ObjectId(deviceId) as unknown as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
      ...data,
    });
  }

  async updateDeviceSettings(
    deviceId: string,
    data: Partial<IDeviceSettings>
  ): Promise<IDeviceSettings | null> {
    return this.deviceSettingsRepo.updateOne(
      { deviceId: new mongoose.Types.ObjectId(deviceId) },
      { $set: data }
    ).then(() => this.getDeviceSettings(deviceId));
  }
}

export const settingsRepository = new SettingsRepository();
