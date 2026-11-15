/**
 * Reading forms.
 *
 * Purpose: the "Record a reading" forms on the health page. Each
 * number form is described once as data (its fields, limits and
 * button) and drawn by one component, so the forms cannot drift apart.
 */
import { addReadingAction } from '@/app/actions/health';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@/constants/care';
import { READING_LIMITS } from '@/domain/readingForm';
import type { ReadingKind } from '@/domain/types';

interface NumberFieldSpec {
   id: string;
   name: string;
   label: string;
   limits: { readonly min: number; readonly max: number };
   decimal?: boolean;
}

interface NumberFormSpec {
   kind: ReadingKind;
   slug: string;
   title: string;
   fields: readonly NumberFieldSpec[];
   save: string;
}

const WHOLE_STEP = 1;
const DECIMAL_STEP = 0.1;

const NUMBER_FORMS: readonly NumberFormSpec[] = [
   {
      kind: 'bloodPressure',
      slug: 'bp',
      title: 'Blood pressure',
      fields: [
         {
            id: 'bp-systolic',
            name: 'systolic',
            label: 'Top number (systolic)',
            limits: READING_LIMITS.systolic,
         },
         {
            id: 'bp-diastolic',
            name: 'diastolic',
            label: 'Bottom number (diastolic)',
            limits: READING_LIMITS.diastolic,
         },
      ],
      save: 'Save blood pressure',
   },
   {
      kind: 'glucose',
      slug: 'sugar',
      title: 'Blood sugar',
      fields: [
         {
            id: 'sugar-value',
            name: 'value',
            label: 'Blood sugar, mg/dL',
            limits: READING_LIMITS.glucose,
         },
      ],
      save: 'Save blood sugar',
   },
   {
      kind: 'weight',
      slug: 'weight',
      title: 'Weight',
      fields: [
         {
            id: 'weight-value',
            name: 'value',
            label: 'Weight, kg',
            limits: READING_LIMITS.weight,
            decimal: true,
         },
      ],
      save: 'Save weight',
   },
];

/** Purpose: one number input with its label and allowed range. */
function NumberField({ field }: { field: NumberFieldSpec }) {
   return (
      <div>
         <label htmlFor={field.id}>{field.label}</label>
         <input
            id={field.id}
            name={field.name}
            type="number"
            inputMode={field.decimal ? 'decimal' : 'numeric'}
            step={field.decimal ? DECIMAL_STEP : WHOLE_STEP}
            min={field.limits.min}
            max={field.limits.max}
            required
         />
      </div>
   );
}

/** Purpose: one reading form: its number fields, a note and a button. */
function NumberForm({ spec }: { spec: NumberFormSpec }) {
   const titleId = `record-${spec.slug}-title`;
   return (
      <form
         className="stack card"
         action={addReadingAction}
         aria-labelledby={titleId}
      >
         <h3 id={titleId}>{spec.title}</h3>
         <input type="hidden" name="kind" value={spec.kind} />
         {spec.fields.map((field) => (
            <NumberField key={field.id} field={field} />
         ))}
         <div>
            <label htmlFor={`${spec.slug}-note`}>Note (optional)</label>
            <input
               id={`${spec.slug}-note`}
               name="note"
               type="text"
               maxLength={MAX_TEXT_LENGTH}
            />
         </div>
         <button className="btn" type="submit">
            {spec.save}
         </button>
      </form>
   );
}

/** Purpose: the symptom form, a single line of free text. */
function SymptomForm() {
   return (
      <form
         className="stack card"
         action={addReadingAction}
         aria-labelledby="record-symptom-title"
      >
         <h3 id="record-symptom-title">Symptom</h3>
         <input type="hidden" name="kind" value="symptom" />
         <div>
            <label htmlFor="symptom-note">What do you notice?</label>
            <input
               id="symptom-note"
               name="note"
               type="text"
               maxLength={MAX_NAME_LENGTH}
               required
            />
         </div>
         <button className="btn" type="submit">
            Save symptom
         </button>
      </form>
   );
}

export function ReadingForms() {
   return (
      <div className="field-grid">
         {NUMBER_FORMS.map((spec) => (
            <NumberForm key={spec.kind} spec={spec} />
         ))}
         <SymptomForm />
      </div>
   );
}
