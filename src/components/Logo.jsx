export function Logo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {/* amber die */}
      <rect
        x="8"
        y="8"
        width="16"
        height="16"
        transform="rotate(45 16 16)"
        fill="#E37B2A"
      />
      {/* ink strike */}
      <rect x="4" y="14" width="24" height="2" fill="#0B0B0C" />
      {/* cream verdict bar */}
      <rect x="4" y="24" width="24" height="1.5" fill="#F2ECDF" />
    </svg>
  );
}
