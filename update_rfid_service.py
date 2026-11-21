import re

svc_path = r'C:\Users\USER\Desktop\Ai_Robot_BE_CICD\apps\backend\src\modules\rfid\rfid.service.ts'

with open(svc_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add import for RfidCardModel
import_target = "import { IRfidLearningLog } from './rfid.model.js';"
import_replacement = "import { IRfidLearningLog } from './rfid.model.js';\nimport { RfidCardModel } from './rfid-card.model.js';"

assert import_target in code, "import_target not found"
code = code.replace(import_target, import_replacement)

# 2. Add UID lookup in handleRfidScan
scan_target = '''  async handleRfidScan(
    deviceId: string,
    userId: string,
    rawPayload: unknown
  ): Promise<{
    success: boolean;
    data?: RfidLearningStartEvent;
    error?: RfidErrorEvent;
  }> {
    const startTime = Date.now();
    const scanId = `rfid_${deviceId}_${startTime}`;'''

scan_replacement = '''  async handleRfidScan(
    deviceId: string,
    userId: string,
    rawPayload: unknown
  ): Promise<{
    success: boolean;
    data?: RfidLearningStartEvent;
    error?: RfidErrorEvent;
  }> {
    const startTime = Date.now();
    const scanId = `rfid_${deviceId}_${startTime}`;

    // 0. Check for Direct UID Learning Card Scan from ESP32
    const payloadObj = (rawPayload && typeof rawPayload === 'object') ? (rawPayload as Record<string, unknown>) : {};
    const rawUid = (payloadObj.cardUid as string | undefined) || (payloadObj.uid as string | undefined);

    if (rawUid && !payloadObj.title) {
      const cardUid = rawUid.replace(/\\s+/g, '').toUpperCase();
      const isDuplicate = await this.isDuplicateScan(deviceId, cardUid, 2500);
      if (isDuplicate) {
        logger.info({ deviceId, cardUid }, 'Duplicate RFID card scan ignored');
        return { success: false };
      }

      const card = await RfidCardModel.findOne({ uid: cardUid, enabled: true });
      if (card) {
        logger.info({ deviceId, cardUid, item: card.itemKey, nameEn: card.nameEn }, 'Matched registered RFID Learning Card');
        sendControlMessageToEsp32(deviceId, 'rfid:result', {
          cardUid,
          found: true,
          itemKey: card.itemKey,
          nameEn: card.nameEn,
          nameMm: card.nameMm,
        });

        dashboardBroadcast.emitRfidScan(deviceId, userId, {
          deviceId,
          scanId,
          cardUid,
          title: card.nameEn,
          category: card.itemKey,
          timestamp: startTime,
        });

        return { success: true };
      } else {
        logger.warn({ deviceId, cardUid }, 'Unregistered RFID card scanned. Register in MongoDB collection memo_robot.rfid_cards');
        sendControlMessageToEsp32(deviceId, 'rfid:result', {
          cardUid,
          found: false,
        });
        return { success: false };
      }
    }'''

assert scan_target in code, "scan_target not found"
code = code.replace(scan_target, scan_replacement)

with open(svc_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Successfully updated rfid.service.ts with MongoDB Learning Card lookup!")
