import { useEffect, useState } from 'react';

export function useDesignSystem() {
  const [accentColor, setAccentColor] = useState('#ffffff');

  useEffect(() => {
    async function initTheme() {
      if (window.electronAPI) {
        try {
          const accent = await window.electronAPI.getSystemAccent();
          // Electron returns hex often without # or slightly differently depending on OS
          const formattedAccent = accent.startsWith('#') ? accent : `#${accent}`;
          
          setAccentColor(formattedAccent);
          
          // Inject into CSS Variables
          document.documentElement.style.setProperty('--color-primary', formattedAccent);
          
          // Also handle overlay updates for titlebar if needed
          window.electronAPI.updateTitleBarOverlay({
            color: '#00000000',
            symbolColor: '#ffffff'
          });
        } catch (e) {
          console.error('[DESIGN] Failed to sync system theme:', e);
        }
      }
    }

    initTheme();
  }, []);

  return { accentColor };
}
