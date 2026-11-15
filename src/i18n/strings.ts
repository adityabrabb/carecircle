/**
 * Elder-facing text in English and Hindi.
 *
 * Purpose: the words on the screens the elder uses every day, so they
 * can read and hear their plan in their own language. Family and
 * caretaker management screens stay in English.
 */
import type { Language, RoutineAnchor } from '@/domain/types';

const STRINGS = {
   en: {
      todayTitle: 'Today',
      greeting: 'Namaste',
      nothingDue: 'Nothing more to take right now.',
      dueNow: 'Due now',
      comingUp: 'Coming up',
      done: 'Done today',
      took: 'I took it',
      skip: 'I will skip this',
      unsure: 'Not sure if I took it',
      gaveIt: 'I saw it taken',
      assumeIt: 'I believe it was taken',
      handling: 'I am handling this',
      readAloud: 'Read aloud',
      stopReading: 'Stop reading',
      beforeFood: 'before food',
      afterFood: 'after food',
      withFood: 'with food',
      anyFood: '',
      taken: 'Taken',
      skipped: 'Skipped by choice',
      unsureStatus: 'Not sure',
      unconfirmed: 'Not confirmed yet',
      skipReason: 'Why are you skipping? (optional)',
      forWhat: 'For',
      take: 'Take',
      largerText: 'Larger text',
      normalText: 'Normal text',
   },
   hi: {
      todayTitle: 'आज',
      greeting: 'नमस्ते',
      nothingDue: 'अभी कोई दवा लेनी बाकी नहीं है।',
      dueNow: 'अभी लेनी है',
      comingUp: 'आगे',
      done: 'आज हो गया',
      took: 'मैंने ले ली',
      skip: 'मैं यह नहीं लूँगा',
      unsure: 'याद नहीं कि ली या नहीं',
      gaveIt: 'मैंने लेते हुए देखा',
      assumeIt: 'मुझे लगता है ले ली',
      handling: 'मैं देख रहा हूँ',
      readAloud: 'पढ़कर सुनाएँ',
      stopReading: 'पढ़ना बंद करें',
      beforeFood: 'खाने से पहले',
      afterFood: 'खाने के बाद',
      withFood: 'खाने के साथ',
      anyFood: '',
      taken: 'ले ली',
      skipped: 'अपनी मर्ज़ी से छोड़ी',
      unsureStatus: 'पक्का नहीं',
      unconfirmed: 'अभी पुष्टि नहीं हुई',
      skipReason: 'क्यों छोड़ रहे हैं? (ज़रूरी नहीं)',
      forWhat: 'किसलिए',
      take: 'लें',
      largerText: 'बड़े अक्षर',
      normalText: 'सामान्य अक्षर',
   },
} as const;

export type StringKey = keyof (typeof STRINGS)['en'];

const ANCHOR_LABELS: Record<Language, Record<RoutineAnchor, string>> = {
   en: {
      wake: 'On waking',
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      evening: 'Evening',
      dinner: 'Dinner',
      sleep: 'Bedtime',
   },
   hi: {
      wake: 'सुबह उठकर',
      breakfast: 'नाश्ता',
      lunch: 'दोपहर का खाना',
      evening: 'शाम',
      dinner: 'रात का खाना',
      sleep: 'सोते समय',
   },
};

/** Purpose: the text for a key in the given language. */
export function t(language: Language, key: StringKey): string {
   return STRINGS[language][key];
}

/** Purpose: the name of a routine anchor in the given language. */
export function anchorLabel(
   language: Language,
   anchor: RoutineAnchor,
): string {
   return ANCHOR_LABELS[language][anchor];
}

/** Purpose: the speech-synthesis language tag for a language. */
export function speechTag(language: Language): string {
   return language === 'hi' ? 'hi-IN' : 'en-IN';
}
