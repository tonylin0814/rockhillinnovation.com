"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Select onValueChange={(value) => setLanguage(value as "en" | "zh")} value={language}>
      <SelectTrigger className="h-8 w-[80px] border-slate-200 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="en">EN</SelectItem>
        <SelectItem value="zh">中文</SelectItem>
      </SelectContent>
    </Select>
  );
}
