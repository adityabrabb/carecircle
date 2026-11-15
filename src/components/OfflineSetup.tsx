'use client';

/**
 * Offline setup.
 *
 * Purpose: register the service worker that keeps the elder's plan
 * readable with no internet, and ask it to clear saved pages when nobody
 * is signed in, so health data does not stay on a shared phone. Renders
 * nothing.
 */
import { useEffect } from 'react';

const SERVICE_WORKER_URL = '/sw.js';
const PURGE_MESSAGE = 'purge';

export interface OfflineSetupProps {
   signedIn: boolean;
}

/** Purpose: register the offline worker and purge it when signed out. */
export function OfflineSetup({ signedIn }: OfflineSetupProps) {
   useEffect(() => {
      if (!('serviceWorker' in navigator)) {
         return;
      }
      // ----- Registration and purge run after the page is shown.
      void setUpWorker(signedIn);
   }, [signedIn]);

   return null;
}

/**
 * Purpose: register the worker and, when signed out, clear its saved
 * pages. Side effect: registers a service worker and posts a message to
 * it. Errors are logged and ignored so the page keeps working.
 */
async function setUpWorker(signedIn: boolean): Promise<void> {
   try {
      await navigator.serviceWorker.register(SERVICE_WORKER_URL);
      if (signedIn) {
         return;
      }
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage(PURGE_MESSAGE);
   } catch (error) {
      console.warn('Offline support is not available.', error);
   }
}
