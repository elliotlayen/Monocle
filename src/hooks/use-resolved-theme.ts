import { useEffect, useState } from "react";
import { useTheme } from "@/providers/theme-provider";

export type ResolvedTheme = "dark" | "light";

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function useResolvedTheme(): ResolvedTheme {
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? getSystemTheme() : theme
  );

  useEffect(() => {
    if (theme !== "system") {
      setResolvedTheme(theme);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateResolvedTheme = () =>
      setResolvedTheme(mediaQuery.matches ? "dark" : "light");

    updateResolvedTheme();
    mediaQuery.addEventListener("change", updateResolvedTheme);
    return () => mediaQuery.removeEventListener("change", updateResolvedTheme);
  }, [theme]);

  return resolvedTheme;
}
