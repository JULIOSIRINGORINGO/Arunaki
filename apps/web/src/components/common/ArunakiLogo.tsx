import React from "react";

interface ArunakiLogoProps {
  className?: string;
  size?: number | string;
  fill?: string;
}

export const ArunakiLogo: React.FC<ArunakiLogoProps> = ({
  className = "w-6 h-6",
  size,
  fill = "currentColor",
}) => {
  const sizeStyle = size ? { width: size, height: size } : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2437.88 2001.03"
      className={className}
      style={sizeStyle}
      fill={fill}
    >
      <path d="M1340.28 420.55l339.35 433.11 -323.68 -721.46c-62.74,-139.84 -255.96,-196.98 -352.79,-29.26l-985.77 1707.41c-62.04,107.45 52.76,236.82 173.43,173.43l2211.35 -1161.69 -1468.82 545.89c-88.37,32.84 -152.13,-55.96 -110.14,-122.92l517.07 -824.49zm-733.34 1580.48c381.02,-197.02 750.31,-418.63 1143.07,-591.07 105.55,-46.34 289.64,-4.49 373.66,120.8l314.22 468.56 -540.11 0c-37.4,-64.78 -23.68,-87.51 -112.21,-194.35 -88.52,-106.84 -261.75,-127.08 -375.68,-86.93l-802.95 282.98z" />
    </svg>
  );
};
