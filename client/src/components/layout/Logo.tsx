const logo = '/logo.svg';

interface LogoProps {
  size?: number | string;
  className?: string;
}

export function Logo({ size = 48, className }: LogoProps) {
  return (
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}