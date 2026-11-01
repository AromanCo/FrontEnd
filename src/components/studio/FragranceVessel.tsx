import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { ScentMood } from '@/lib/studio/presentation';

const colors: Record<ScentMood, string> = {
  floral: '#C8AECF',
  fresh: '#A8C2B5',
  woody: '#806C7B',
  warm: '#D6AD72',
  green: '#93A58A',
  neutral: '#D8C6CE',
};

export function FragranceVessel({ mood = 'neutral', title = 'پیش‌نمایش مفهومی آرومان', decorative = false }: { mood?: ScentMood; title?: string; decorative?: boolean }) {
  const id = useId().replaceAll(':', '');
  return (
    <div className="bottle vessel-art" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : title} data-mood={mood} style={{ '--bottle-color': colors[mood] } as CSSProperties}>
      <svg viewBox="0 0 240 320" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".86" />
            <stop offset=".38" stopColor="var(--bottle-color)" stopOpacity=".72" />
            <stop offset="1" stopColor="#745d78" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#fff" stopOpacity=".84" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="120" cy="293" rx="72" ry="12" fill="#382a3d" opacity=".12" />
        <rect x="91" y="14" width="58" height="31" rx="7" fill="#302434" />
        <path d="M103 43h34v20h-34z" fill="#d6ad72" />
        <path d="M81 62c0-8 7-14 15-14h48c8 0 15 6 15 14v18c0 8 23 16 29 32 5 13 7 33 7 52v87c0 25-15 39-39 39H84c-24 0-39-14-39-39v-87c0-19 2-39 7-52 6-16 29-24 29-32z" fill={`url(#${id}-glass)`} stroke="#806782" strokeWidth="3" />
        <path d="M66 139c3-20 11-29 24-37 5-4 9-9 10-15h5c-5 20-14 27-24 35-5 5-7 15-8 30v87c0 18 6 27 18 31-16-2-25-13-25-32z" fill={`url(#${id}-shine)`} />
        <path d="M71 176h98v47H71z" fill="#f7f2ec" fillOpacity=".9" />
        <text x="120" y="196" textAnchor="middle" fill="#382a3d" fontFamily="Georgia,serif" fontSize="13" letterSpacing="3">AROMAN</text>
        <text x="120" y="212" textAnchor="middle" fill="#806782" fontFamily="Georgia,serif" fontSize="7" letterSpacing="1.5">PERSONAL ATELIER</text>
      </svg>
      <span className="sr-only">این بطری تصویرسازی مفهومی است.</span>
    </div>
  );
}
