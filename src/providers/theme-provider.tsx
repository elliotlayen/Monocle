import { createContext, useContext, useEffect, useState } from "react";
import {
  settingsService,
  isAccentColor,
  DEFAULT_ACCENT_COLOR,
  type AccentColor,
} from "@/features/settings/services/settings-service";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
};

const ACCENT_STORAGE_KEY = "monocle-accent";

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  accent: DEFAULT_ACCENT_COLOR,
  setAccent: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "monocle-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [accent, setAccentState] = useState<AccentColor>(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentColor(saved) ? saved : DEFAULT_ACCENT_COLOR;
  });

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // The accent applies as a data attribute; per-accent CSS in index.css
  // covers both themes declaratively, so theme flips need no JS here.
  useEffect(() => {
    const root = window.document.documentElement;
    if (accent === DEFAULT_ACCENT_COLOR) {
      delete root.dataset.accent;
    } else {
      root.dataset.accent = accent;
    }
  }, [accent]);

  useEffect(() => {
    let isMounted = true;
    settingsService
      .getSettings()
      .then((settings) => {
        if (!isMounted) return;
        if (
          settings.theme === "dark" ||
          settings.theme === "light" ||
          settings.theme === "system"
        ) {
          localStorage.setItem(storageKey, settings.theme);
          setThemeState(settings.theme);
        }
        if (isAccentColor(settings.accentColor)) {
          localStorage.setItem(ACCENT_STORAGE_KEY, settings.accentColor);
          setAccentState(settings.accentColor);
        }
      })
      .catch(() => {
        // Ignore settings load failures
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setThemeState(theme);
      settingsService.saveSettings({ theme }).catch(() => {
        // Ignore settings persistence failures
      });
    },
    accent,
    setAccent: (accent: AccentColor) => {
      localStorage.setItem(ACCENT_STORAGE_KEY, accent);
      setAccentState(accent);
      settingsService.saveSettings({ accentColor: accent }).catch(() => {
        // Ignore settings persistence failures
      });
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
