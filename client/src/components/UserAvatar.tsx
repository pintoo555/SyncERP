function initial(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return n.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  userId,
  name,
  size = 28,
  className = '',
}: {
  userId: number;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const src = `/user-photos/${userId}.jpg`;
  const style = { width: size, height: size, objectFit: 'cover' as const, borderRadius: '50%' };
  return (
    <span className="d-inline-flex align-items-center justify-content-center" style={{ width: size, height: size }}>
      <img
        src={src}
        alt={name || ''}
        className={`rounded-circle ${className}`}
        style={style}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = 'none';
          const fallback = el.nextElementSibling as HTMLElement;
          if (fallback) {
            fallback.style.display = 'flex';
            fallback.textContent = name ? initial(name) : '?';
          }
        }}
      />
      <span
        className="rounded-circle align-items-center justify-content-center small fw-semibold text-white bg-secondary"
        style={{ width: size, height: size, fontSize: size * 0.4, display: 'none' }}
        aria-hidden
      />
    </span>
  );
}

export function UserAvatarWithName({ userId, name, size = 28 }: { userId: number; name: string | null; size?: number }) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <UserAvatar userId={userId} name={name} size={size} />
      <span>{name || '—'}</span>
    </span>
  );
}
