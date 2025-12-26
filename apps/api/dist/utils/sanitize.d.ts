/**
 * Sanitizes a TTS message for safety and appropriateness
 * Returns null if the message should be rejected entirely
 */
export declare function sanitizeTtsMessage(message: string, maxLength: number): string | null;
/**
 * Sanitizes a poll question
 */
export declare function sanitizePollQuestion(question: string): string;
/**
 * Sanitizes poll options
 */
export declare function sanitizePollOptions(options: string[]): string[];
/**
 * Generate a request ID for logging
 */
export declare function generateRequestId(): string;
/**
 * Redact sensitive data from logs
 */
export declare function redactSensitive(obj: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=sanitize.d.ts.map