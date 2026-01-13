import React from 'react';
import { THEMES } from '../utils/themes';
import { Check } from 'lucide-react';

interface ThemePickerProps {
    currentThemeId: string;
    onSelect: (themeId: string) => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({ currentThemeId, onSelect }) => {
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {THEMES.map((theme) => {
                const isActive = theme.id === currentThemeId;

                return (
                    <button
                        key={theme.id}
                        onClick={() => onSelect(theme.id)}
                        className={`relative group rounded-xl border-2 transition-all duration-200 overflow-hidden text-left
                            ${isActive
                                ? 'border-purple-600 ring-2 ring-purple-600/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        {/* Preview Header (Simulates App Bar) */}
                        <div
                            className="h-12 w-full flex items-center px-3 gap-2"
                            style={{ backgroundColor: theme.colors.background }}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.error }} />
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                        </div>

                        {/* Preview Body (Simulates Content) */}
                        <div
                            className="p-3 h-16 flex flex-col gap-2"
                            style={{ backgroundColor: theme.colors.surface }}
                        >
                            <div
                                className="h-2 w-3/4 rounded-full opacity-50"
                                style={{ backgroundColor: theme.colors.text }}
                            />
                            <div
                                className="h-2 w-1/2 rounded-full opacity-30"
                                style={{ backgroundColor: theme.colors.text }}
                            />
                        </div>

                        {/* Label */}
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/50 to-transparent flex justify-between items-end">
                            <span className={`text-xs font-medium px-2 py-1 rounded-md bg-white/90 text-black shadow-sm`}>
                                {theme.name}
                            </span>
                            {isActive && (
                                <div className="bg-purple-600 text-white rounded-full p-1 shadow-sm">
                                    <Check size={12} strokeWidth={3} />
                                </div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
