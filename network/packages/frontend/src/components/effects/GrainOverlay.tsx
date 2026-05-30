import { memo } from 'react';

/**
 * Subtle film-grain noise overlay.
 * Renders a fixed full-screen SVG noise texture at z-index 999.
 * Ported from NullPay frontend for premium texture feel.
 */
export const GrainOverlay = memo(function GrainOverlay() {
    return (
        <div
            className="pointer-events-none fixed inset-0 z-[999] opacity-[0.032]"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
                backgroundSize: '128px 128px',
            }}
        />
    );
});
