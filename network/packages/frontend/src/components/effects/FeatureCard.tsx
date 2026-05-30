import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeInScale } from '../../lib/animations';

interface FeatureCardProps {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
    accentColor: string;
    glowColor: string;
    className?: string;
}

/**
 * Feature card with animated border glow, corner blur, and top shimmer line.
 * Ported from NullPay frontend.
 */
export const FeatureCard = memo(function FeatureCard({
    icon: Icon,
    title,
    desc,
    accentColor,
    glowColor,
    className = '',
}: FeatureCardProps) {
    return (
        <motion.div variants={fadeInScale} className={`relative group ${className}`}>
            {/* Animated border glow */}
            <div
                className={`absolute -inset-[1px] rounded-2xl opacity-100 transition-all duration-700 blur-sm ${glowColor}`}
            />

            <div className="relative p-6 lg:p-7 rounded-2xl bg-[#080808]/80 backdrop-blur-sm border border-white/[0.12] transition-all duration-700 h-full overflow-hidden">
                {/* Top shimmer line */}
                <div
                    className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${accentColor} to-transparent opacity-100 transition-opacity duration-700`}
                />

                {/* Corner glow */}
                <div
                    className={`absolute -top-20 -right-20 w-40 h-40 rounded-full ${glowColor} opacity-100 transition-opacity duration-700 blur-3xl`}
                />

                {/* Icon */}
                <div
                    className={`w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.15] flex items-center justify-center mb-5 group-hover:scale-110 transition-all duration-500`}
                >
                    <Icon
                        className={`w-5 h-5 ${accentColor.replace('/50', '').replace('/40', '').replace('bg-', 'text-')}`}
                    />
                </div>

                <h3 className="text-[15px] font-bold mb-2.5 text-white tracking-tight transition-colors">
                    {title}
                </h3>
                <p className="text-white/50 text-[13px] leading-relaxed transition-colors duration-500">
                    {desc}
                </p>
            </div>
        </motion.div>
    );
});
