export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Wat heb ik nog thuis">
      <rect width="64" height="64" rx="18" fill="#1F5B45" />
      <path d="M16 30l16-13 16 13v17a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V30z" fill="#F5F3EE" />
      <rect x="22" y="33" width="9" height="11" rx="2" fill="#F6E7D3" />
      <rect x="33" y="33" width="9" height="11" rx="2" fill="#DCEBF3" />
      <rect x="22" y="44" width="20" height="2" fill="#1F5B45" opacity="0.25" />
    </svg>
  )
}
