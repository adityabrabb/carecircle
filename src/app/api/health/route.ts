/**
 * Health check.
 *
 * Purpose: answer the host's health probe without touching storage or
 * signing anyone in. A free host keeps the service awake while this
 * returns, so it stays cheap and public.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
   return NextResponse.json({ ok: true });
}
