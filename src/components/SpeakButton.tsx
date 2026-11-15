'use client';

/**
 * Read-aloud button.
 *
 * Purpose: speak a piece of text in the elder's language using the
 * browser's built-in speech, so the day's plan can be heard instead of
 * read. The button is hidden when the browser cannot speak.
 */
import { useEffect, useState } from 'react';

export interface SpeakButtonProps {
   text: string;
   /** Speech language tag, such as "hi-IN". */
   lang: string;
   startLabel: string;
   stopLabel: string;
}

const SPEECH_RATE = 0.9;

export function SpeakButton({
   text,
   lang,
   startLabel,
   stopLabel,
}: SpeakButtonProps) {
   const [supported, setSupported] = useState(false);
   const [speaking, setSpeaking] = useState(false);

   useEffect(() => {
      // ----- Speech support is only known in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported('speechSynthesis' in window);
      return () => {
         if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
         }
      };
   }, []);

   if (!supported) {
      return null;
   }

   /** Purpose: start or stop reading. Side effect: browser speech. */
   function toggle(): void {
      if (speaking) {
         window.speechSynthesis.cancel();
         setSpeaking(false);
         return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = SPEECH_RATE;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
   }

   return (
      <button
         type="button"
         className="btn warn"
         onClick={toggle}
         aria-pressed={speaking}
      >
         <span aria-hidden="true">{speaking ? '■' : '▶'}</span>
         {speaking ? stopLabel : startLabel}
      </button>
   );
}
