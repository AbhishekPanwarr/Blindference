import { useEffect } from 'react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';

/**
 * Cursor-tracking animated grid background for the hero section.
 * A global faint grid is always visible; a violet active grid
 * glows only within a ~180 px radius of the cursor via a radial mask.
 *
 * Ported from NullPay frontend.
 */
export default function HeroGrid() {
    const mouseX = useMotionValue(-1000);
    const mouseY = useMotionValue(-1000);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const gridEl = document.getElementById('hero-grid');
            if (gridEl) {
                const { left, top } = gridEl.getBoundingClientRect();
                mouseX.set(e.clientX - left);
                mouseY.set(e.clientY - top);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY]);

    const mobileGridMask =
        'radial-gradient(180px circle at 50% 42%, black 0%, transparent 100%)';

    return (
        <div
            id="hero-grid"
            className="absolute inset-0 z-0 overflow-hidden bg-[#030303] pointer-events-none"
        >
            {/* Global faint background grid */}
            <motion.div
                className="absolute inset-0 opacity-20 pointer-events-none"
                animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
                transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
                style={{
                    backgroundImage:
                        'linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage:
                        'radial-gradient(ellipse 80% 100% at 50% 50%, #000 10%, transparent 100%)',
                    WebkitMaskImage:
                        'radial-gradient(ellipse 80% 100% at 50% 50%, #000 10%, transparent 100%)',
                }}
            />

            {/* Glowing active violet grid lines localized to cursor */}
            <motion.div
                className="absolute inset-0 pointer-events-none opacity-[0.45]"
                animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
                transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
                style={{
                    backgroundImage:
                        'linear-gradient(to right, #A855F7 1px, transparent 1px), linear-gradient(to bottom, #6366F1 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage: useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
                    WebkitMaskImage: useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
                }}
            />

            {/* Mobile fallback mask (centered, no cursor tracking) */}
            <motion.div
                className="absolute inset-0 pointer-events-none opacity-[0.24] md:hidden"
                animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
                transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
                style={{
                    backgroundImage:
                        'linear-gradient(to right, #A855F7 1px, transparent 1px), linear-gradient(to bottom, #6366F1 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage: mobileGridMask,
                    WebkitMaskImage: mobileGridMask,
                }}
            />
        </div>
    );
}
