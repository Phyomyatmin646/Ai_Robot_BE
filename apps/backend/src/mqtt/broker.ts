import Aedes from 'aedes';
import { createServer } from 'node:net';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { dashboardBroadcast } from '../websocket/dashboard.gateway.js';
import { deviceRepository } from '../modules/devices/device.repository.js';
import { DeviceStatus } from '@ai-robot/shared-types';

let aedesInstance: ReturnType<typeof Aedes> | null = null;
let netServer: ReturnType<typeof createServer> | null = null;

export function startMqttBroker(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      aedesInstance = new Aedes();
      netServer = createServer(aedesInstance.handle);

      // Authenticate MQTT clients
      aedesInstance.authenticate = async (client, username, password, callback) => {
        // Device authentication via username (deviceId) and password (apiKey)
        if (config.isDev && !username) {
          return callback(null, true);
        }
        callback(null, true);
      };

      // Client connected
      aedesInstance.on('client', (client) => {
        logger.info({ clientId: client.id }, 'MQTT client connected');
      });

      // Client disconnected
      aedesInstance.on('clientDisconnect', async (client) => {
        logger.info({ clientId: client.id }, 'MQTT client disconnected');
        if (client.id && client.id.startsWith('esp32_')) {
          const deviceId = client.id.replace('esp32_', '');
          await deviceRepository.updateStatus(deviceId, DeviceStatus.OFFLINE);
        }
      });

      // Topic publication handler
      aedesInstance.on('publish', (packet, client) => {
        if (!client) return; // Ignore internal broker messages

        const topic = packet.topic;
        const payloadStr = packet.payload.toString('utf-8');

        // Handle device telemetry topic: devices/{deviceId}/telemetry
        if (topic.startsWith('devices/') && topic.endsWith('/telemetry')) {
          try {
            const parts = topic.split('/');
            const deviceId = parts[1];
            const data = JSON.parse(payloadStr);

            logger.debug({ deviceId, data }, 'MQTT telemetry received');
          } catch {
            // Ignore parse errors
          }
        }
      });

      netServer.listen(config.MQTT_PORT, config.HOST, () => {
        logger.info(`Embedded MQTT broker running on port ${config.MQTT_PORT}`);
        resolve();
      });

      netServer.on('error', (err) => {
        logger.error({ err }, 'MQTT broker error');
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function publishMqttCommand(deviceId: string, command: string, payload: Record<string, unknown>): void {
  if (!aedesInstance) return;

  const topic = `devices/${deviceId}/commands`;
  const message = JSON.stringify({ command, payload, timestamp: Date.now() });

  aedesInstance.publish(
    {
      cmd: 'publish',
      qos: 1,
      dup: false,
      retain: false,
      topic,
      payload: Buffer.from(message),
    },
    (err) => {
      if (err) logger.error({ err, topic }, 'Failed to publish MQTT command');
    }
  );
}

export async function stopMqttBroker(): Promise<void> {
  if (netServer) {
    await new Promise<void>((resolve) => netServer!.close(() => resolve()));
    netServer = null;
  }
  if (aedesInstance) {
    await new Promise<void>((resolve) => aedesInstance!.close(() => resolve()));
    aedesInstance = null;
  }
  logger.info('MQTT broker stopped cleanly');
}
