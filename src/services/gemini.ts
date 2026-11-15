/**
 * Gemini reader.
 *
 * Purpose: ask Gemini to read a prescription photo or PDF and return the
 * medicines as JSON. The reply is only a proposal; it is checked by the
 * domain code and a person confirms it before anything is saved. Side
 * effect: sends the file to the Gemini API. The file is never logged.
 */
import { GoogleGenAI } from '@google/genai';
import { geminiApiKey, geminiModel } from '@/config/env';
import type { Result } from '@/domain/types';

const READ_TIMEOUT_MS = 60_000;
const DATA_ENCODING = 'base64';
const NOT_SET_UP =
   'Reading prescriptions is not set up yet. Please type the medicine in.';
const READ_FAILED =
   'The prescription could not be read. Try a clearer photo, or type the ' +
   'medicine in.';

const PROMPT = [
   'Read the medicines written on this prescription.',
   'Reply with JSON only, no other text, in exactly this form:',
   '{ "medicines": [ { "name": "", "strength": "", "purpose": "",',
   '"anchors": [], "food": "", "unitsPerDose": 1 } ] }',
   'Rules:',
   '- Copy only what is written. Never guess a medicine or a dose.',
   '- "purpose" is what the medicine is for, in plain words, under 8 words.',
   '- "anchors" is a subset of: wake, breakfast, lunch, evening, dinner, sleep.',
   '- "food" is one of: before, after, with, any.',
   '- "unitsPerDose" is a whole number of tablets or units per dose.',
   '- If something is unclear, leave that field empty instead of guessing.',
].join('\n');

/** Purpose: true when a Gemini API key is configured. */
export function geminiAvailable(): boolean {
   return geminiApiKey() !== '';
}

/** Purpose: a short description of a failure, without any file content. */
function describeError(cause: unknown): string {
   if (cause instanceof SyntaxError) {
      return 'the reply was not valid JSON';
   }
   if (cause instanceof Error) {
      return cause.message;
   }
   return 'unknown error';
}

/**
 * Purpose: read the medicines on a prescription. Side effect: calls the
 * Gemini API. Never throws; failures come back as an error message.
 */
export async function extractPrescription(
   bytes: Buffer,
   mime: string,
): Promise<Result<unknown>> {
   if (!geminiAvailable()) {
      return { ok: false, error: NOT_SET_UP };
   }
   try {
      const ai = new GoogleGenAI({
         apiKey: geminiApiKey(),
         httpOptions: { timeout: READ_TIMEOUT_MS },
      });
      const response = await ai.models.generateContent({
         model: geminiModel(),
         contents: [
            {
               role: 'user',
               parts: [
                  {
                     inlineData: {
                        mimeType: mime,
                        data: bytes.toString(DATA_ENCODING),
                     },
                  },
                  { text: PROMPT },
               ],
            },
         ],
         config: { responseMimeType: 'application/json', temperature: 0 },
      });
      return { ok: true, value: JSON.parse(response.text ?? '') as unknown };
   } catch (cause) {
      console.error('Prescription read failed:', describeError(cause));
      return { ok: false, error: READ_FAILED };
   }
}
