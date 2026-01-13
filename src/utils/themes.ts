import { Theme } from '../types';

export const THEMES: Theme[] = [
    {
        id: 'light',
        name: 'Daylight',
        type: 'light',
        colors: {
            primary: '#7c3aed', // Violet 600
            secondary: '#e5e7eb', // Gray 200
            background: '#f9fafb', // Gray 50
            surface: '#ffffff',
            text: '#111827', // Gray 900
            textMuted: '#6b7280', // Gray 500
            border: '#e5e7eb', // Gray 200
            error: '#ef4444',
            success: '#22c55e',
        },
        orb: {
            gradient: ['#7c3aed', '#db2777', '#f59e0b'],
            glowColor: 'rgba(124, 58, 237, 0.3)',
        },
    },
    {
        id: 'dark',
        name: 'Midnight',
        type: 'dark',
        colors: {
            primary: '#8b5cf6', // Violet 500
            secondary: '#374151', // Gray 700
            background: '#0B0D18',
            surface: '#1f2937', // Gray 800
            text: '#f9fafb', // Gray 50
            textMuted: '#9ca3af', // Gray 400
            border: 'rgba(255, 255, 255, 0.1)',
            error: '#f87171',
            success: '#4ade80',
        },
        orb: {
            gradient: ['#8b5cf6', '#d946ef', '#f97316'],
            glowColor: 'rgba(139, 92, 246, 0.4)',
        },
    },
    {
        id: 'forest',
        name: 'Forest',
        type: 'dark',
        colors: {
            primary: '#10b981', // Emerald 500
            secondary: '#134e4a', // Teal 900
            background: '#022c22', // Emerald 950
            surface: '#064e3b', // Emerald 900
            text: '#ecfdf5', // Emerald 50
            textMuted: '#6ee7b7', // Emerald 300
            border: '#059669', // Emerald 600
            error: '#f87171',
            success: '#34d399',
        },
        orb: {
            gradient: ['#10b981', '#34d399', '#064e3b'],
            glowColor: 'rgba(16, 185, 129, 0.4)',
        },
    },
    {
        id: 'sunset',
        name: 'Sunset',
        type: 'dark',
        colors: {
            primary: '#f59e0b', // Amber 500
            secondary: '#7c2d12', // Orange 900
            background: '#431407', // Orange 950
            surface: '#7c2d12', // Orange 900
            text: '#fff7ed', // Orange 50
            textMuted: '#fdba74', // Orange 300
            border: '#c2410c', // Orange 700
            error: '#ef4444',
            success: '#22c55e',
        },
        orb: {
            gradient: ['#f59e0b', '#ef4444', '#7c2d12'],
            glowColor: 'rgba(245, 158, 11, 0.4)',
        },
    },
    {
        id: 'ocean',
        name: 'Deep Ocean',
        type: 'dark',
        colors: {
            primary: '#0ea5e9', // Sky 500
            secondary: '#0c4a6e', // Sky 900
            background: '#082f49', // Sky 950
            surface: '#0c4a6e', // Sky 900
            text: '#f0f9ff', // Sky 50
            textMuted: '#7dd3fc', // Sky 300
            border: '#0284c7', // Sky 600
            error: '#f43f5e',
            success: '#10b981',
        },
        orb: {
            gradient: ['#0ea5e9', '#3b82f6', '#1d4ed8'],
            glowColor: 'rgba(14, 165, 233, 0.4)',
        },
    },
];

export const getThemeById = (id: string): Theme => {
    return THEMES.find(t => t.id === id) || THEMES[0]; // Fallback to Light
};
