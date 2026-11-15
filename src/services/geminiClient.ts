/**
 * Gemini client.
 *
 * Purpose: build the one Gemini client the app uses. On Google Cloud it
 * signs in through Vertex AI with the service account, so no API key is
 * stored anywhere. Elsewhere it uses an API key when one is configured.
 */
import { GoogleGenAI } from '@google/genai';
import { geminiApiKey, vertexSettings } from '@/config/env';

/** Purpose: true when Gemini can be called in this environment. */
export function geminiConfigured(): boolean {
   return vertexSettings() !== null || geminiApiKey() !== '';
}

/**
 * Purpose: a Gemini client with a request timeout, or null when neither
 * Vertex AI nor an API key is configured.
 */
export function geminiClient(timeoutMs: number): GoogleGenAI | null {
   const httpOptions = { timeout: timeoutMs };
   const vertex = vertexSettings();
   if (vertex) {
      return new GoogleGenAI({
         vertexai: true,
         project: vertex.project,
         location: vertex.location,
         httpOptions,
      });
   }
   const apiKey = geminiApiKey();
   return apiKey ? new GoogleGenAI({ apiKey, httpOptions }) : null;
}
