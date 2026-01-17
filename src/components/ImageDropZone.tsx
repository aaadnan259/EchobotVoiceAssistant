import React from 'react';
import { Upload } from 'lucide-react';

interface ImageDropZoneProps {
    isDragging: boolean;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    children: React.ReactNode;
    className?: string;  // Accept className prop for flex layout support
}

export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
    isDragging,
    onDrop,
    onDragOver,
    onDragLeave,
    children,
    className = ''  // Destructure with default empty string
}) => {
    return (
        <div
            className={`relative ${className}`}  // Spread className instead of hardcoding w-full h-full
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
        >
            {children}

            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 rounded-2xl border-2 border-dashed border-purple-500 bg-purple-500/10 backdrop-blur-sm flex flex-col items-center justify-center animate-[fadeIn_0.2s]">
                    <div className="bg-white dark:bg-[#1E2335] p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Upload size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Drop images here</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Supported: PNG, JPG, WEBP</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
