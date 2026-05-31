import { memo } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../lib/animations';

/**
 * Gradient horizontal divider with a soft center glow.
 * Used between major sections for visual rhythm.
 * Ported from NullPay frontend.
 */
export const GlowDivider = memo(function GlowDivider() {
    return (
        <div className="relative w-full h-px overflow-visible my-16">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-px bg-gradient-to-r from-transparent via-purple-500/60 to-transparent blur-[1px]" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-2 bg-purple-500/10 rounded-full blur-xl" />
        </div>
    );
});

/**
 * Section label: mono uppercase text with horizontal decorative lines.
 * Ported from NullPay frontend.
 */
export const SectionLabel = memo(function SectionLabel({
    children,
    color = 'text-white/40',
}: {
    children: React.ReactNode;
    color?: string;
}) {
    return (
        <motion.span
            variants={fadeInUp}
            className={`font-mono text-[10px] uppercase tracking-[0.35em] font-semibold ${color} inline-flex items-center gap-2`}
        >
            <span className="w-6 h-px bg-current opacity-40" />
            {children}
            <span className="w-6 h-px bg-current opacity-40" />
        </motion.span>
    );
});
