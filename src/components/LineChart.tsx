/**
 * Line chart.
 *
 * Purpose: draw readings over time as an inline SVG, with labelled
 * reference lines. A server component with no client script. It computes
 * no dates: the caller passes instants and labels. Each line is told
 * apart by its dash pattern and marker shape, never by colour alone.
 */

export interface ChartLine {
   label: string;
   points: { at: number; value: number }[];
   dashed?: boolean;
}

export interface LineChartProps {
   /** Used as the accessible name of the chart. */
   title: string;
   lines: ChartLine[];
   /** Horizontal guide lines, such as a general reference value. */
   reference?: { value: number; label: string }[];
   /** Unit of the values, shown in the legend. */
   unit: string;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 200;
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const AXIS_GAP = 6;
const INK = '#1e2a2e';
const PAPER = '#ffffff';
const LINE_WIDTH = 3;
const AXIS_WIDTH = 1;
const REFERENCE_WIDTH = 1.5;
const SQUARE_STROKE = 2;
const MARKER_RADIUS = 4;
const MARKER_HALF_SIDE = 5;
const DASH_PATTERN = '10 6';
const REFERENCE_PATTERN = '2 4';
const LABEL_SIZE = 12;
const LABEL_GAP = 4;
const LABEL_BASELINE = CHART_HEIGHT - 6;
/** A line needs this many points before it is drawn as a path. */
const MIN_POINTS = 2;
/** Used when every value is equal, so the scale does not divide by 0. */
const DEGENERATE_SPAN = 1;
const DECIMAL_PLACES = 1;
const EMPTY_TEXT = 'Not enough readings yet';

/** Purpose: a value as short text, with one decimal place when needed. */
function formatValue(value: number): string {
   return Number.isInteger(value)
      ? String(value)
      : value.toFixed(DECIMAL_PLACES);
}

/** Purpose: the legend wording for a line, including its shape. */
function legendText(line: ChartLine): string {
   const style = line.dashed
      ? 'Dashed line, square dots'
      : 'Solid line, round dots';
   return `${style}: ${line.label}.`;
}

/**
 * Purpose: a chart of one or more lines over time. Shows "Not enough
 * readings yet" when no line has two points to join.
 */
export function LineChart({
   title,
   lines,
   reference = [],
   unit,
}: LineChartProps) {
   const drawable = lines.some((line) => line.points.length >= MIN_POINTS);
   if (!drawable) {
      return <p className="hint">{EMPTY_TEXT}</p>;
   }

   // ----- Scales: map instants and values onto the drawing area.
   const allPoints = lines.flatMap((line) => line.points);
   const ats = allPoints.map((point) => point.at);
   const values = [
      ...allPoints.map((point) => point.value),
      ...reference.map((guide) => guide.value),
   ];
   const minAt = Math.min(...ats);
   const maxAt = Math.max(...ats);
   const minValue = Math.min(...values);
   const maxValue = Math.max(...values);
   const spanAt = maxAt > minAt ? maxAt - minAt : DEGENERATE_SPAN;
   const spanValue =
      maxValue > minValue ? maxValue - minValue : DEGENERATE_SPAN;
   const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
   const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
   const scaleX = (at: number): number =>
      PAD_LEFT + ((at - minAt) / spanAt) * plotWidth;
   const scaleY = (value: number): number =>
      PAD_TOP + (1 - (value - minValue) / spanValue) * plotHeight;
   const bottom = PAD_TOP + plotHeight;
   // ----- end scales

   return (
      <figure style={{ margin: 0 }}>
         <svg
            role="img"
            aria-label={title}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            width="100%"
            style={{ display: 'block', maxWidth: CHART_WIDTH }}
         >
            {/* ----- Axes */}
            <line
               x1={PAD_LEFT}
               x2={PAD_LEFT}
               y1={PAD_TOP}
               y2={bottom}
               stroke={INK}
               strokeWidth={AXIS_WIDTH}
            />
            <line
               x1={PAD_LEFT}
               x2={CHART_WIDTH - PAD_RIGHT}
               y1={bottom}
               y2={bottom}
               stroke={INK}
               strokeWidth={AXIS_WIDTH}
            />
            <text
               x={PAD_LEFT - AXIS_GAP}
               y={scaleY(maxValue)}
               textAnchor="end"
               dominantBaseline="middle"
               fontSize={LABEL_SIZE}
               fill={INK}
            >
               {formatValue(maxValue)}
            </text>
            <text
               x={PAD_LEFT - AXIS_GAP}
               y={scaleY(minValue)}
               textAnchor="end"
               dominantBaseline="middle"
               fontSize={LABEL_SIZE}
               fill={INK}
            >
               {formatValue(minValue)}
            </text>
            <text
               x={PAD_LEFT}
               y={LABEL_BASELINE}
               fontSize={LABEL_SIZE}
               fill={INK}
            >
               Oldest
            </text>
            <text
               x={CHART_WIDTH - PAD_RIGHT}
               y={LABEL_BASELINE}
               textAnchor="end"
               fontSize={LABEL_SIZE}
               fill={INK}
            >
               Latest
            </text>
            {/* ----- end axes */}

            {/* ----- Reference lines, each labelled */}
            {reference.map((guide) => (
               <g key={`${guide.label}-${guide.value}`}>
                  <line
                     x1={PAD_LEFT}
                     x2={CHART_WIDTH - PAD_RIGHT}
                     y1={scaleY(guide.value)}
                     y2={scaleY(guide.value)}
                     stroke={INK}
                     strokeWidth={REFERENCE_WIDTH}
                     strokeDasharray={REFERENCE_PATTERN}
                  />
                  <text
                     x={CHART_WIDTH - PAD_RIGHT}
                     y={scaleY(guide.value) - LABEL_GAP}
                     textAnchor="end"
                     fontSize={LABEL_SIZE}
                     fill={INK}
                  >
                     {guide.label}
                  </text>
               </g>
            ))}
            {/* ----- end reference lines */}

            {/* ----- Data lines and markers */}
            {lines.map((line) => {
               const ordered = [...line.points].sort(
                  (first, second) => first.at - second.at,
               );
               const path = ordered
                  .map(
                     (point, index) =>
                        `${index === 0 ? 'M' : 'L'}` +
                        `${scaleX(point.at).toFixed(1)} ` +
                        `${scaleY(point.value).toFixed(1)}`,
                  )
                  .join(' ');
               return (
                  <g key={line.label}>
                     {ordered.length >= MIN_POINTS ? (
                        <path
                           d={path}
                           fill="none"
                           stroke={INK}
                           strokeWidth={LINE_WIDTH}
                           strokeLinejoin="round"
                           strokeLinecap="round"
                           strokeDasharray={
                              line.dashed ? DASH_PATTERN : undefined
                           }
                        />
                     ) : null}
                     {ordered.map((point) =>
                        line.dashed ? (
                           <rect
                              key={point.at}
                              x={scaleX(point.at) - MARKER_HALF_SIDE}
                              y={scaleY(point.value) - MARKER_HALF_SIDE}
                              width={MARKER_HALF_SIDE * 2}
                              height={MARKER_HALF_SIDE * 2}
                              fill={PAPER}
                              stroke={INK}
                              strokeWidth={SQUARE_STROKE}
                           />
                        ) : (
                           <circle
                              key={point.at}
                              cx={scaleX(point.at)}
                              cy={scaleY(point.value)}
                              r={MARKER_RADIUS}
                              fill={INK}
                           />
                        ),
                     )}
                  </g>
               );
            })}
            {/* ----- end data lines */}
         </svg>
         <figcaption className="small">
            Values in {unit}. {lines.map(legendText).join(' ')}
         </figcaption>
      </figure>
   );
}
