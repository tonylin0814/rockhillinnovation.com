"use client";

import { Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAiConfig } from "@/app/actions/ai-configs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AiConfig } from "@/types";

const roleLabels: Record<string, string> = {
  "prompt.admin": "Admin",
  "prompt.manager": "Manager",
  "prompt.partner": "Partner",
  "prompt.user": "User",
};

export function AiConfigCard({ config }: { config: AiConfig }) {
  const [value, setValue] = useState(config.value);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateAiConfig(config.key, value);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Judy prompt saved");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{roleLabels[config.key] ?? config.key}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          className="min-h-36"
          disabled={isPending}
          onChange={(event) => setValue(event.currentTarget.value)}
          value={value}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Last updated: {new Date(config.updated_at).toLocaleString()}</p>
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={save} size="sm" type="button">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
