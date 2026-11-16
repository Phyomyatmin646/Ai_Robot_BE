import { z } from 'zod';

export const SUPPORTED_RFID_SCHEMA_VERSIONS = ['1.0'];

export const MAX_RFID_PAYLOAD_BYTES = 4096;

export const RfidCardDataSchema = z.object({
  schemaVersion: z
    .string()
    .min(1, 'schemaVersion cannot be empty')
    .max(10, 'schemaVersion too long')
    .default('1.0'),
  cardUid: z.string().max(64).optional(),
  cardType: z.string().max(50).default('educational'),
  language: z
    .enum(['my', 'en', 'burmese', 'english'])
    .default('my'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters'),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(50, 'Category cannot exceed 50 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  facts: z
    .array(z.string().max(200, 'Fact item cannot exceed 200 characters'))
    .max(10, 'Cannot exceed 10 facts')
    .optional(),
  learningPrompt: z
    .string()
    .max(300, 'Learning prompt cannot exceed 300 characters')
    .optional(),
});

export type ValidatedRfidCardData = z.infer<typeof RfidCardDataSchema>;

export const RfidScanPayloadSchema = z.object({
  cardUid: z.string().max(64).optional(),
  cardData: z.union([RfidCardDataSchema, z.string().max(MAX_RFID_PAYLOAD_BYTES)]),
});

export type ValidatedRfidScanPayload = z.infer<typeof RfidScanPayloadSchema>;
