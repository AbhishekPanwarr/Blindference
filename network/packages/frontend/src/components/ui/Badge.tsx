import * as React from "react";
import { cn } from "../../utils/helpers";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses: Record<string, string> = {
    default: "border-transparent bg-violet-500 text-white",
    secondary: "border-transparent bg-white/10 text-white/80",
    destructive: "border-transparent bg-red-500 text-white",
    outline: "text-white/80",
    success: "border-transparent bg-white/15 text-white",
    warning: "border-transparent bg-amber-500/20 text-amber-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
