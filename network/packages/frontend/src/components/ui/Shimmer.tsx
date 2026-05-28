import React from 'react';
import { cn } from '../../utils/helpers';

interface ShimmerProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
}

export const Shimmer = ({ className, width, height, style }: ShimmerProps) => {
    return (
        <div
            className={cn(
                "animate-pulse bg-white/5 rounded-md relative overflow-hidden",
                "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                className
            )}
            style={{
                width: width,
                height: height,
                ...style
            }}
        />
    );
};
