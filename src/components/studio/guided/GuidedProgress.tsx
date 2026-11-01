const stepNames = ['حال‌وهوا', 'خانواده‌ها', 'دمای حسی', 'تصویر', 'نت‌ها', 'بازبینی'] as const;

export function GuidedProgress({ step }: { step: number }) {
  return (
    <div className="guided-progress-wrap">
      <div className="guided-progress-copy" aria-live="polite" aria-atomic="true">
        <span>مرحلهٔ {new Intl.NumberFormat('fa-IR').format(step + 1)} از ۶</span>
        <span>{stepNames[step]}</span>
      </div>
      <div
        className="guided-progress-track"
        role="progressbar"
        aria-label="پیشرفت استودیوی هدایت‌شده"
        aria-valuemin={1}
        aria-valuemax={6}
        aria-valuenow={step + 1}
        aria-valuetext={`مرحلهٔ ${step + 1} از ۶: ${stepNames[step]}`}
      >
        <span style={{ width: `${((step + 1) / 6) * 100}%` }} />
      </div>
      <ol className="guided-progress-steps" aria-hidden="true">
        {stepNames.map((name, index) => (
          <li key={name} data-state={index === step ? 'current' : index < step ? 'complete' : 'upcoming'}>
            <span>{new Intl.NumberFormat('fa-IR').format(index + 1)}</span>
            <small>{name}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}
