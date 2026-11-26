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
const retryReply: QuickReply = {
  id: 'practice-retry',
  aliases: [],
  text: 'Could you say one of my practice questions again?',
};

export function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\+/g, ' plus ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

function normalizeAlias(text: string): string {
  // Myanmar transcription can vary word spacing and use either set of digits.
  return normalizeQuestion(text)
    .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - 0x1040))
    .replace(/(?<=\p{Script=Myanmar}) +| +(?=\p{Script=Myanmar})/gu, '');
}

try {
  const catalog = JSON.parse(readFileSync(new URL('replies.json', assetDirectory), 'utf8')) as QuickReply[];
  for (const reply of catalog) {
    for (const alias of reply.aliases) replies.set(normalizeAlias(alias), reply);
  }
} catch (err) {
  logger.warn({ err }, 'Voice quick replies unavailable; continuing with Gemini Live');
}

function loadReply(reply: QuickReply) {
  try {
    let pcm = pcmCache.get(reply.id);
    if (!pcm) {
      pcm = readFileSync(new URL(`${reply.id}.pcm`, assetDirectory));
      if (!pcm.length || pcm.length % 2 !== 0) throw new Error('Invalid PCM length');
      pcmCache.set(reply.id, pcm);
    }
    return { id: reply.id, text: reply.text, pcm, requiresPreviousReply: reply.requiresPreviousReply };
  } catch (err) {
    logger.warn({ err, replyId: reply.id }, 'Could not load prerecorded voice reply');
    return undefined;
  }
}

export function getQuickReply(question: string, previousReplyId?: string) {
  const reply = replies.get(normalizeAlias(question));
  if (!reply || (reply.requiresPreviousReply && reply.requiresPreviousReply !== previousReplyId)) return undefined;
  return loadReply(reply);
}

export function getRetryReply() {
  return loadReply(retryReply);
}
