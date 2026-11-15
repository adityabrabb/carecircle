/**
 * Sample-family bar.
 *
 * Purpose: on a sample circle only, let the visitor switch between the
 * elder, caretaker and family, and move the clock forward to watch
 * reminders and escalation happen. Never rendered for a real circle.
 */
import { skipDemoTime, switchDemoMember } from '@/app/actions/demo';
import { formatLocal } from '@/domain/time';
import type { CareProfile, Member } from '@/domain/types';

const SKIPS: readonly { minutes: number; label: string }[] = [
   { minutes: 30, label: '+30 min' },
   { minutes: 60, label: '+1 hour' },
   { minutes: 180, label: '+3 hours' },
   { minutes: 1440, label: '+1 day' },
];

export interface DemoBarProps {
   profile: CareProfile;
   members: readonly Member[];
   currentMemberId: string;
   now: number;
}

export function DemoBar({
   profile,
   members,
   currentMemberId,
   now,
}: DemoBarProps) {
   if (!profile.isDemo) {
      return null;
   }
   return (
      <section
         className="card tint-indigo no-print"
         aria-labelledby="demo-title"
      >
         <h2 id="demo-title">Sample family controls</h2>
         <p>
            App time is{' '}
            <strong>{formatLocal(now, profile.utcOffsetMinutes)}</strong>.
            Move the clock to see reminders go out and a missed dose climb
            from the elder to the caretaker to the family.
         </p>
         <form className="row" action={skipDemoTime}>
            <span className="small">Move clock:</span>
            {SKIPS.map((skip) => (
               <button
                  key={skip.minutes}
                  className="btn quiet small-btn"
                  type="submit"
                  name="minutes"
                  value={skip.minutes}
               >
                  {skip.label}
               </button>
            ))}
         </form>
         <form className="row" action={switchDemoMember}>
            <span className="small">View as:</span>
            {members.map((member) => (
               <button
                  key={member.id}
                  className={`btn small-btn ${
                     member.id === currentMemberId ? '' : 'quiet'
                  }`}
                  type="submit"
                  name="memberId"
                  value={member.id}
                  aria-pressed={member.id === currentMemberId}
               >
                  {member.name}
               </button>
            ))}
         </form>
      </section>
   );
}
