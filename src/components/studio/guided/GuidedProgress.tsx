export const guidedStepNames = ['حال‌وهوا', 'خانواده‌ها', 'دمای حسی', 'تصویر', 'نت‌ها', 'بازبینی'] as const;

const formatStep = new Intl.NumberFormat('fa-IR');

export function GuidedProgress({
  step,
  onReview,
}: {
  step: number;
  onReview: (step: number) => void;
}) {
  const stepNumber = formatStep.format(step + 1);
  const total = formatStep.format(guidedStepNames.length);
  const current = guidedStepNames[step];

  return (
    <div className="guided-progress-wrap">
      <div className="guided-progress-copy" aria-live="polite" aria-atomic="true">
        <span>مرحلهٔ {stepNumber} از {total}</span>
        <span>{current}</span>
      </div>
      <div
        className="guided-progress-track"
        role="progressbar"
        aria-label="پیشرفت استودیوی هدایت‌شده"
        aria-valuemin={1}
        aria-valuemax={guidedStepNames.length}
        aria-valuenow={step + 1}
        aria-valuetext={`مرحلهٔ ${stepNumber} از ${total}، ${current}`}
      >
        <span style={{ width: `${((step + 1) / guidedStepNames.length) * 100}%` }} />
      </div>
      <ol className="guided-progress-steps" aria-label="مراحل کشف رایحه">
        {guidedStepNames.map((name, index) => {
          const complete = index < step;
          const indicator = <>
            <span className="guided-progress-marker" aria-hidden="true">{complete ? '✓' : formatStep.format(index + 1)}</span>
            <span>{name}</span>
          </>;

          return (
            <li key={name} aria-current={index === step ? 'step' : undefined}>
              {complete
                ? <button type="button" onClick={() => onReview(index)} aria-label={`بازبینی مرحلهٔ ${name}`}>{indicator}</button>
                : <span>{indicator}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
