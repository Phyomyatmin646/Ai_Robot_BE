import { BaseRepository } from '../../shared/base.repository.js';
import { IAudioMetadata, AudioMetadataModel } from './audio.model.js';
import { getGridFSBucket } from '../../config/database.js';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';

export class AudioRepository extends BaseRepository<IAudioMetadata> {
  constructor() {
    super(AudioMetadataModel);
  }

  async uploadToGridFS(filename: string, stream: Readable, contentType: string): Promise<string> {
    const bucket = getGridFSBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
    });

    return new Promise((resolve, reject) => {
      stream
        .pipe(uploadStream)
        .on('finish', () => resolve(uploadStream.id.toString()))
        .on('error', reject);
    });
  }

  getDownloadStreamFromGridFS(gridFSId: string, options?: { start?: number; end?: number }): mongoose.mongo.GridFSBucketReadStream {
    const bucket = getGridFSBucket();
    return bucket.openDownloadStream(new mongoose.Types.ObjectId(gridFSId), options);
  }

  async deleteFromGridFS(gridFSId: string): Promise<void> {
    const bucket = getGridFSBucket();
    await bucket.delete(new mongoose.Types.ObjectId(gridFSId));
  }
}

export const audioRepository = new AudioRepository();
