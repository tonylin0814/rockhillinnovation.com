"use client";

import { useLanguage } from "@/context/LanguageContext";

function lookup(source: unknown, path: string): string | undefined {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, source) as string | undefined;
}

export function T({ fallback, k }: { fallback: string; k: string }) {
  const { t } = useLanguage();

  return <>{lookup(t, k) ?? fallback}</>;
}
