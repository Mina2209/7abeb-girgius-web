interface FlatIconProps {
  iconClass: string;
  className?: string;
}

export function FlatIcon({ iconClass, className = "w-5 h-5" }: FlatIconProps) {
  return <i className={`fi ${iconClass} ${className}`} />;
}
