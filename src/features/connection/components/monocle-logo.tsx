interface MonocleLogoProps {
  className?: string;
}

export function MonocleLogo({ className }: MonocleLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      className={className}
    >
      <g transform="matrix(1, 0, 0, 1, -17.869001, 7.127486)">
        {/* Connecting lines - drawn first so circles cover them */}
        <g className="stroke-current fill-none" strokeWidth={15}>
          <path d="M 190.479 130.633 L 363.669 242.457" />
          <path d="M 266.174 428.077 L 365.603 235.34" />
          <path d="M 262.125 424.483 L 417.704 371.881" />
          <path d="M 361.648 239.273 L 416.538 380.261" />
        </g>

        {/* Main monocle circle */}
        <g transform="matrix(1, 0, 0, 1, 12.608, -13.388)">
          <ellipse
            className="fill-muted stroke-muted"
            strokeWidth={42}
            cx="179.625"
            cy="145.696"
            rx="100"
            ry="100"
          />
          <ellipse
            className="fill-muted stroke-current"
            strokeWidth={30}
            cx="179.625"
            cy="145.696"
            rx="100"
            ry="100"
          />
        </g>

        {/* Small node - bottom right */}
        <g>
          <ellipse
            className="fill-muted stroke-muted"
            strokeWidth={25}
            cx="413.505"
            cy="371.368"
            rx="30"
            ry="30"
          />
          <ellipse
            className="fill-muted stroke-current"
            strokeWidth={15}
            cx="413.505"
            cy="371.368"
            rx="30"
            ry="30"
          />
        </g>

        {/* Small node - middle */}
        <g>
          <ellipse
            className="fill-muted stroke-muted"
            strokeWidth={25}
            cx="362.453"
            cy="240.748"
            rx="30"
            ry="30"
          />
          <ellipse
            className="fill-muted stroke-current"
            strokeWidth={15}
            cx="362.453"
            cy="240.748"
            rx="30"
            ry="30"
          />
        </g>

        {/* Small node - bottom left */}
        <g>
          <ellipse
            className="fill-muted stroke-muted"
            strokeWidth={25}
            cx="267.236"
            cy="423.437"
            rx="30"
            ry="30"
          />
          <ellipse
            className="fill-muted stroke-current"
            strokeWidth={15}
            cx="267.236"
            cy="423.437"
            rx="30"
            ry="30"
          />
        </g>
      </g>
    </svg>
  );
}
