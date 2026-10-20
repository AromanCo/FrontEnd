import { FragranceVessel } from '@/components/studio/FragranceVessel';

export function AtelierHeroArtwork() {
  return <div className="atelier-artwork" role="img" aria-label="تصویرسازی مفهومی آرومان با بطری شیشه‌ای و شاخه‌های گیاهی">
    <div className="atelier-artwork-wash" />
    <svg className="atelier-botanical" viewBox="0 0 640 620" aria-hidden="true" focusable="false">
      <path className="botanical-stem" d="M138 564C148 454 106 375 176 290s69-143 49-241M490 572c-78-126-33-246-115-330s-59-138-38-200" />
      <path className="botanical-stem botanical-stem-light" d="M183 353c77-23 95-65 106-121m101 182c-53-24-83-67-96-119" />
      <g className="botanical-leaves">
        <path d="M168 451c-81 11-102-40-85-99 58 15 91 43 85 99zm20-44c-15-85 29-117 87-114-4 62-31 101-87 114zM208 277c-68 8-92-35-80-85 49 13 74 38 80 85zm222 168c72 12 96-32 83-84-52 9-81 32-83 84zm-18-58c6-73-35-103-83-101 1 55 27 91 83 101zm-35-130c61 9 84-30 74-76-45 12-68 34-74 76z" />
        <path d="M152 489c-4-51 7-109 34-155m-6 14c-35-12-58-29-75-55m256 195c-8-61-16-110-50-158m96 139c3-41 14-77 39-108" />
      </g>
      <g className="botanical-blossoms">
        <path d="M254 146c-13-26 9-48 30-34 9-29 38-28 44-2 25-15 48 6 36 30 30 5 33 34 8 45 11 28-13 47-37 34-14 27-43 20-45-7-28 8-44-16-27-37-21-13-18-35 2-44zm195 48c-9-18 6-34 21-24 7-20 26-19 30-1 18-10 34 4 26 22 21 3 24 24 6 32 8 20-9 33-26 24-10 19-30 14-32-5-20 6-31-11-19-26-15-9-13-25-1-31z" />
        <circle cx="312" cy="170" r="13" /><circle cx="467" cy="215" r="9" />
      </g>
      <circle className="atelier-sun" cx="414" cy="128" r="55" />
      <circle className="atelier-orbit" cx="312" cy="326" r="236" />
      <circle className="atelier-orbit atelier-orbit-inner" cx="312" cy="326" r="202" />
    </svg>
    <span className="atelier-artwork-caption">تصویرسازی مفهومی · فضای ساخت رایحه</span>
    <div className="atelier-vessel-wrap"><FragranceVessel mood="floral" title="بطری مفهومی در تصویرسازی آرومان" decorative /></div>
    <div className="atelier-artwork-note"><span>یک مسیر، دو آغاز</span><strong>کشف کنید یا بسازید</strong><i aria-hidden="true">✳</i></div>
  </div>;
}
