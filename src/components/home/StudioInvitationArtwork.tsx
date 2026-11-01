export function StudioInvitationArtwork() {
  return <div className="studio-invitation-art" aria-hidden="true">
    <div className="invitation-glow" />
    <svg viewBox="0 0 560 370" focusable="false">
      <path className="invitation-thread" d="M58 271c81-39 114-181 212-166 89 14 105 163 226 126" />
      <path className="invitation-thread invitation-thread-two" d="M89 89c75 31 103 193 189 193 77 0 121-112 201-124" />
      <g className="invitation-petal"><path d="M281 34c48 40 56 89 1 141-58-39-59-86-1-141z"/><path d="M422 172c-6 63-43 97-117 77-1-68 34-96 117-77z"/><path d="M161 244c52-36 101-28 126 43-53 42-99 31-126-43z"/></g>
      <circle cx="281" cy="194" r="34" className="invitation-core" />
      <circle cx="281" cy="194" r="52" className="invitation-ring" />
      <circle cx="281" cy="194" r="83" className="invitation-ring invitation-ring-wide" />
    </svg>
    <span className="invitation-caption">سه لایه · یک روایت شخصی</span>
  </div>;
}
