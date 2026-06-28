"use client";

import { Loader2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { addDiaryEntry } from "@/app/actions/trade-diary";
import { completeMilestone, uncompleteMilestone } from "@/app/actions/trade-milestones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
import { buildDownloadUrl } from "@/lib/download";
import type { MilestoneKey, TradeDiaryEntry, TradeMilestone } from "@/types";

export function MilestoneStepDialog({
  canManage,
  diaryEntries,
  label,
  milestone,
  milestoneKey,
  onOpenChange,
  open,
  tradeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeId: string;
  milestoneKey: MilestoneKey;
  label: string;
  milestone: TradeMilestone | null;
  diaryEntries: TradeDiaryEntry[];
  canManage: boolean;
}) {
  const { language } = useLanguage();
  const text =
    language === "zh"
      ? {
          addNote: "新增備註",
          attachments: "附件",
          attachmentsHelp: "每次最多上傳 10 個檔案。之後可以再新增更多。",
          cancel: "取消",
          complete: "標記完成",
          completed: "已完成",
          completedToast: "里程碑已完成",
          history: "歷史紀錄",
          noHistory: "此步驟尚無備註。",
          notCompleted: "尚未完成",
          notePlaceholder: "輸入此步驟的備註...",
          reopen: "標記未完成",
          reopenedToast: "里程碑已重新開啟",
          saveNote: "儲存備註",
          selectedFiles: "個檔案已選取",
          tooManyFiles: "一次最多只能選 10 個檔案。",
        }
      : {
          addNote: "Add Note",
          attachments: "Attachments",
          attachmentsHelp: "Upload up to 10 files at once. You can add more later.",
          cancel: "Cancel",
          complete: "Mark Complete",
          completed: "Completed",
          completedToast: "Milestone completed",
          history: "History",
          noHistory: "No notes for this step yet.",
          notCompleted: "Not completed",
          notePlaceholder: "Add a note about this step...",
          reopen: "Mark Incomplete",
          reopenedToast: "Milestone reopened",
          saveNote: "Save Note",
          selectedFiles: "files selected",
          tooManyFiles: "You can select up to 10 files at once.",
        };
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const isComplete = Boolean(milestone?.completed_at);

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = isComplete
        ? await uncompleteMilestone(tradeId, milestoneKey)
        : await completeMilestone(tradeId, milestoneKey, note || undefined);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(isComplete ? text.reopenedToast : text.completedToast);
      setNote("");
      router.refresh();
    });
  }

  function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("milestone_key", milestoneKey);
    setError(null);

    startTransition(async () => {
      const result = await addDiaryEntry(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(text.saveNote);
      setNote("");
      setSelectedFileCount(0);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <p className="text-sm text-slate-500">
            {isComplete ? text.completed : text.notCompleted}
            {milestone?.completed_by ? ` · ${milestone.completed_by}` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {canManage ? (
            <form className="space-y-4" onSubmit={handleNoteSubmit}>
              <input name="milestone_key" type="hidden" value={milestoneKey} />
              <div className="space-y-2">
                <Label htmlFor="milestone-note">{text.addNote}</Label>
                <Textarea
                  id="milestone-note"
                  name="content"
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={text.notePlaceholder}
                  required
                  rows={4}
                  value={note}
                />
              </div>
              <div className="space-y-2">
                <Label>{text.attachments}</Label>
                <p className="text-xs text-slate-500">{text.attachmentsHelp}</p>
                <input
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  className="block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium"
                  multiple
                  name="attachment_0"
                  onChange={(event) => {
                    const count = event.target.files?.length ?? 0;
                    if (count > 10) {
                      event.target.value = "";
                      setSelectedFileCount(0);
                      setError(text.tooManyFiles);
                      return;
                    }
                    setError(null);
                    setSelectedFileCount(count);
                  }}
                  type="file"
                />
                {selectedFileCount ? (
                  <p className="text-xs text-slate-500">
                    {selectedFileCount} {text.selectedFiles}
                  </p>
                ) : null}
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-between gap-2">
                <Button disabled={pending} onClick={handleComplete} type="button" variant="outline">
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isComplete ? text.reopen : text.complete}
                </Button>
                <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={pending} type="submit">
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {text.saveNote}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[#0d1b34]">{text.history}</h4>
            {diaryEntries.length ? (
              <ul className="space-y-3">
                {diaryEntries.map((entry) => (
                  <li className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={entry.id}>
                    <p className="text-xs font-medium text-slate-500">
                      {entry.author_name} ·{" "}
                      {new Date(entry.created_at).toLocaleString(undefined, {
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#0d1b34]">{entry.content}</p>
                    {entry.attachments.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.attachments.map((attachment) => (
                          <a
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            download
                            href={buildDownloadUrl(attachment.onedrive_url, attachment.name)}
                            key={attachment.onedrive_url}
                          >
                            <Paperclip className="h-3 w-3" />
                            {attachment.name}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                {text.noHistory}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            {text.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
