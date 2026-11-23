import { readFileSync } from 'node:fs';
import { logger } from '../../utils/logger.js';

interface QuickReply {
  id: string;
  aliases: string[];
  requiresPreviousReply?: string;
  text: string;
}

const assetDirectory = new URL('../../../assets/quick-replies/', import.meta.url);
const replies = new Map<string, QuickReply>();
const pcmCache = new Map<string, Buffer>();

export function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

try {
  const catalog = JSON.parse(readFileSync(new URL('replies.json', assetDirectory), 'utf8')) as QuickReply[];
  for (const reply of catalog) {
    for (const alias of reply.aliases) replies.set(normalizeQuestion(alias), reply);
  }
} catch (err) {
  logger.warn({ err }, 'Voice quick replies unavailable; continuing with Gemini Live');
}

export function getQuickReply(question: string, previousReplyId?: string): { id: string; text: string; pcm: Buffer } | undefined {
  const reply = replies.get(normalizeQuestion(question));
  if (!reply || (reply.requiresPreviousReply && reply.requiresPreviousReply !== previousReplyId)) return undefined;
  try {
    let pcm = pcmCache.get(reply.id);
    if (!pcm) {
      pcm = readFileSync(new URL(`${reply.id}.pcm`, assetDirectory));
      if (!pcm.length || pcm.length % 2 !== 0) throw new Error('Invalid PCM length');
      pcmCache.set(reply.id, pcm);
    }
    return { id: reply.id, text: reply.text, pcm };
  } catch (err) {
    logger.warn({ err, replyId: reply.id }, 'Could not load prerecorded voice reply');
    return undefined;
  }
}
