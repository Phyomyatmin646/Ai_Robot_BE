import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI is not set in .env file!');
  process.exit(1);
}

const RfidCardSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, uppercase: true },
    itemKey: {
      type: String,
      required: true,
      enum: ['apple', 'elephant', 'cat', 'dog', 'banana'],
    },
    nameEn: { type: String, required: true },
    nameMm: { type: String, required: true },
    imageKey: { type: String, default: 'apple' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'rfid_cards' }
);

const RfidCard = mongoose.models.RfidCard || mongoose.model('RfidCard', RfidCardSchema);

async function registerCard() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB successfully!');

  // Card UID from your PN532 scan
  const myCardUid = '7AE7CC5B';

  const card = await RfidCard.findOneAndUpdate(
    { uid: myCardUid },
    {
      uid: myCardUid,
      itemKey: 'apple',
      nameEn: 'Apple',
      nameMm: 'ပန်းသီး',
      imageKey: 'apple',
      enabled: true,
    },
    { upsert: true, new: true }
  );

  console.log('\n======================================================');
  console.log(`✅ SUCCESS: Card ${card.uid} registered!`);
  console.log(`   Item Key : ${card.itemKey}`);
  console.log(`   English  : ${card.nameEn}`);
  console.log(`   Myanmar  : ${card.nameMm}`);
  console.log(`   Status   : ${card.enabled ? 'Enabled' : 'Disabled'}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

registerCard().catch((err) => {
  console.error('❌ Registration failed:', err);
  process.exit(1);
});
