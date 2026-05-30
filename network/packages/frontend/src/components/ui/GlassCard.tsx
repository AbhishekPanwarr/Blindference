import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "../../utils/helpers";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    variant?: "heavy" | "default" | "light";
    hoverEffect?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ children, className, variant = "default", hoverEffect = true, ...props }, ref) => {
        const variants = {
            default: "bg-[#080808]/80 backdrop-blur-xl border border-white/[0.12] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]",
            heavy: "bg-[#02040a]/80 backdrop-blur-2xl border border-white/[0.08] shadow-2xl",
            light: "bg-white/[0.03] backdrop-blur-lg border border-white/[0.08] shadow-lg",
        };

        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={cn(
                    "rounded-3xl relative overflow-hidden group",
                    variants[variant],
                    hoverEffect && "hover:border-white/[0.2] transition-colors duration-300",
                    className
                )}
                {...props}
            >
                {hoverEffect && (
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
                )}
                <div className="relative z-10">{children}</div>
            </motion.div>
        );
    }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
