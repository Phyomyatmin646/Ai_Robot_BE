import { BaseRepository } from '../../shared/base.repository.js';
import { IRfidLearningLog, RfidLearningLogModel } from './rfid.model.js';

export class RfidRepository extends BaseRepository<IRfidLearningLog> {
  constructor() {
    super(RfidLearningLogModel);
  }
}

export const rfidRepository = new RfidRepository();
