// Basic profanity filter - contains common offensive words
// This is a minimal implementation; consider using a library like 'bad-words' for production
const PROFANITY_LIST = new Set([
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'piss', 'dick', 'cock',
  'pussy', 'asshole', 'bastard', 'slut', 'whore', 'fag', 'faggot', 'nigger',
  'nigga', 'retard', 'cunt', 'twat', 'wanker', 'bollocks',
]);

// URL pattern to detect and remove URLs
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9.-]+\.(com|org|net|io|co|dev|app|xyz|gg|tv|fm|me)\b[^\s]*/gi;

// Discord/Twitch invite patterns
const INVITE_PATTERN = /discord\.gg\/[^\s]+|twitch\.tv\/[^\s]+/gi;

// Repeated character spam detection (more than 4 of the same character)
const SPAM_PATTERN = /(.)\1{4,}/g;

// Excessive caps detection (more than 70% caps in a message longer than 5 chars)
function hasExcessiveCaps(text: string): boolean {
  if (text.length < 6) return false;
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return false;
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return caps / letters.length > 0.7;
}

/**
 * Sanitizes a TTS message for safety and appropriateness
 * Returns null if the message should be rejected entirely
 */
export function sanitizeTtsMessage(message: string, maxLength: number): string | null {
  // Trim whitespace
  let cleaned = message.trim();
  
  // Check if empty after trim
  if (cleaned.length === 0) {
    return null;
  }
  
  // Remove URLs
  cleaned = cleaned.replace(URL_PATTERN, '[link removed]');
  cleaned = cleaned.replace(INVITE_PATTERN, '[invite removed]');
  
  // Replace spam patterns (e.g., "aaaaaaa" -> "aaaa")
  cleaned = cleaned.replace(SPAM_PATTERN, '$1$1$1$1');
  
  // Handle excessive caps - convert to lowercase
  if (hasExcessiveCaps(cleaned)) {
    cleaned = cleaned.toLowerCase();
  }
  
  // Filter profanity - replace with asterisks
  const words = cleaned.split(/\s+/);
  const filteredWords = words.map(word => {
    const lowerWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (PROFANITY_LIST.has(lowerWord)) {
      return '*'.repeat(word.length);
    }
    return word;
  });
  cleaned = filteredWords.join(' ');
  
  // Truncate to max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...';
  }
  
  // Final empty check after all processing
  const finalCheck = cleaned.replace(/[\s*\[\]]/g, '');
  if (finalCheck.length === 0) {
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitizes a poll question
 */
export function sanitizePollQuestion(question: string): string {
  let cleaned = question.trim();
  cleaned = cleaned.replace(URL_PATTERN, '');
  cleaned = cleaned.replace(SPAM_PATTERN, '$1$1$1$1');
  return cleaned;
}

/**
 * Sanitizes poll options
 */
export function sanitizePollOptions(options: string[]): string[] {
  return options.map(opt => {
    let cleaned = opt.trim();
    cleaned = cleaned.replace(URL_PATTERN, '');
    cleaned = cleaned.replace(SPAM_PATTERN, '$1$1$1$1');
    return cleaned;
  }).filter(opt => opt.length > 0);
}

/**
 * Generate a request ID for logging
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Redact sensitive data from logs
 */
export function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'privateKey', 'signature'];
  const redacted = { ...obj };
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    }
  }
  
  return redacted;
}
