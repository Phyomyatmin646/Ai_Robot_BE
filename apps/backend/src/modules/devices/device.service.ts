import { deviceRepository, DeviceRepository } from './device.repository.js';
import { IDevice } from './device.model.js';
import { generateApiKey, hashToken } from '../../utils/crypto.js';
import { NotFoundError, ConflictError, UnauthorizedError } from '../../shared/errors.js';
import { DeviceRegistrationRequest, DeviceStatus, DeviceConfig } from '@ai-robot/shared-types';
import { settingsRepository } from '../settings/settings.repository.js';

export class DeviceService {
  constructor(private readonly deviceRepo: DeviceRepository = deviceRepository) {}

  async register(
    userId: string,
    data: DeviceRegistrationRequest
  ): Promise<{ device: IDevice; apiKey: string }> {
    const existing = await this.deviceRepo.findByMac(data.macAddress);
    if (existing) {
      throw new ConflictError('A device with this MAC address is already registered');
    }

    const rawApiKey = generateApiKey();
    const apiKeyHash = hashToken(rawApiKey);

    const device = await this.deviceRepo.create({
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      name: data.name || 'ESP32 AI Robot',
      deviceType: data.deviceType,
      status: DeviceStatus.OFFLINE,
      apiKeyHash,
      firmwareVersion: data.firmwareVersion,
      hardwareVersion: data.hardwareVersion,
      macAddress: data.macAddress.toUpperCase(),
      capabilities: data.capabilities,
    });

    // Create device settings
    await settingsRepository.createDeviceSettings(device.id, userId, {
      voice: {
        provider: 'gemini',
        model: 'gemini-2.0-flash-live',
        voiceId: 'Puck',
        language: 'en',
        speed: 1.0,
        volume: 80,
        responseMode: 'auto',
      },
      sound: {
        masterVolume: 80,
        isMuted: false,
        outputVolume: 80,
        notificationVolume: 70,
        feedbackSoundsEnabled: true,
      },
      display: {
        brightness: 80,
        isOn: true,
        sleepTimeoutSeconds: 300,
        theme: 'dark',
      },
      device: {
        name: device.name,
        firmwareAutoUpdate: false,
        heartbeatIntervalSeconds: 15,
        logLevel: 'info',
      },
    });

    return { device, apiKey: rawApiKey };
  }

  async verifyDeviceCredentials(deviceId: string, rawApiKey: string): Promise<IDevice> {
    const device = await this.deviceRepo.findByIdWithSecret(deviceId);
    if (!device) {
      throw new UnauthorizedError('Device not found or invalid credentials');
    }

    const providedHash = hashToken(rawApiKey);
    if (providedHash !== device.apiKeyHash) {
      throw new UnauthorizedError('Invalid device authentication key');
    }

    return device;
  }

  async getById(deviceId: string, userId?: string): Promise<IDevice> {
    const device = await this.deviceRepo.findById(deviceId);
    if (!device) throw new NotFoundError('Device');
    if (userId && device.userId.toString() !== userId) {
      throw new NotFoundError('Device');
    }
    return device;
  }

  async getUserDevices(userId: string): Promise<IDevice[]> {
    return this.deviceRepo.findByUser(userId);
  }

  async updateConfig(deviceId: string, userId: string, config: Partial<DeviceConfig>): Promise<IDevice> {
    const device = await this.getById(deviceId, userId);
    const updated = await this.deviceRepo.updateById(device.id, {
      $set: {
        'config.volumeLevel': config.volumeLevel ?? device.config.volumeLevel,
        'config.brightnessLevel': config.brightnessLevel ?? device.config.brightnessLevel,
        'config.ledEnabled': config.ledEnabled ?? device.config.ledEnabled,
        'config.audioChunkSize': config.audioChunkSize ?? device.config.audioChunkSize,
        'config.heartbeatInterval': config.heartbeatInterval ?? device.config.heartbeatInterval,
      },
    });
    return updated!;
  }

  async delete(deviceId: string, userId: string): Promise<void> {
    const device = await this.getById(deviceId, userId);
    await this.deviceRepo.deleteById(device.id);
  }
}

export const deviceService = new DeviceService();

