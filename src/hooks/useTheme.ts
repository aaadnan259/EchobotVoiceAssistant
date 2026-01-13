import { useEffect } from 'react';
import { useSettings } from './useSettings';
import { getThemeById } from '../utils/themes';

export const useTheme = () => {
    const { settings } = useSettings();

    useEffect(() => {
        const theme = getThemeById(settings.theme);

        // 1. Set Type (Dark/Light) Class
        if (theme.type === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // 2. Set CSS Variables
        const root = document.documentElement;

        // Colors
        root.style.setProperty('--theme-primary', theme.colors.primary);
        root.style.setProperty('--theme-secondary', theme.colors.secondary);
        root.style.setProperty('--theme-bg', theme.colors.background);
        root.style.setProperty('--theme-surface', theme.colors.surface);
        root.style.setProperty('--theme-text', theme.colors.text);
        root.style.setProperty('--theme-text-muted', theme.colors.textMuted);
        root.style.setProperty('--theme-border', theme.colors.border);
        root.style.setProperty('--theme-error', theme.colors.error);
        root.style.setProperty('--theme-success', theme.colors.success);

        // Orb
        root.style.setProperty('--orb-gradient-1', theme.orb.gradient[0]);
        root.style.setProperty('--orb-gradient-2', theme.orb.gradient[1] || theme.orb.gradient[0]);
        root.style.setProperty('--orb-gradient-3', theme.orb.gradient[2] || theme.orb.gradient[0]);
        root.style.setProperty('--orb-glow', theme.orb.glowColor);

        // Meta Theme Color (for mobile storage bar)
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme.colors.background);
        }

    }, [settings.theme]);
};
