import { settingsRepository, SettingsRepository } from './settings.repository.js';
import { IUserSettings, IDeviceSettings } from './settings.model.js';
import { NotFoundError } from '../../shared/errors.js';
import { sendControlMessageToEsp32 } from '../../websocket/esp32.gateway.js';
import { dashboardBroadcast } from '../../websocket/dashboard.gateway.js';
import { DeviceCommandType } from '@ai-robot/shared-types';

export class SettingsService {
  constructor(private readonly repo: SettingsRepository = settingsRepository) {}

  async getUserSettings(userId: string): Promise<IUserSettings> {
    const settings = await this.repo.getUserSettings(userId);
    if (!settings) throw new NotFoundError('User settings');
    return settings;
  }

  async updateUserSettings(userId: string, data: Partial<IUserSettings>): Promise<IUserSettings> {
    const updated = await this.repo.updateUserSettings(userId, data);
    return updated!;
  }

  async getDeviceSettings(deviceId: string): Promise<IDeviceSettings> {
    const settings = await this.repo.getDeviceSettings(deviceId);
    if (!settings) throw new NotFoundError('Device settings');
    return settings;
  }

  async updateDeviceSettings(
    deviceId: string,
    data: Partial<IDeviceSettings>
  ): Promise<IDeviceSettings> {
    const updated = await this.repo.updateDeviceSettings(deviceId, data);
    if (!updated) throw new NotFoundError('Device settings');

    // 1. If physical hardware volume changed, dispatch hardware control command to ESP32
    if (data.sound?.masterVolume !== undefined) {
      sendControlMessageToEsp32(deviceId, 'robot:command', {
        commandId: `cmd_${Date.now()}`,
        type: DeviceCommandType.SET_VOLUME,
        payload: { volume: data.sound.masterVolume },
      });
    }

    // 2. If screen brightness changed, dispatch hardware command to ESP32
    if (data.display?.brightness !== undefined) {
      sendControlMessageToEsp32(deviceId, 'robot:command', {
        commandId: `cmd_${Date.now()}`,
        type: DeviceCommandType.SET_BRIGHTNESS,
        payload: { brightness: data.display.brightness },
      });
    }

    // 3. Sync to Dashboard via Socket.IO
    dashboardBroadcast.getDashboardSocketIO?.();

    return updated;
  }
}

export const settingsService = new SettingsService();
