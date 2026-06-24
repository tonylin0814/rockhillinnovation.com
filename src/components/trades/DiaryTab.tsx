"use client";

import { Loader2, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { addDiaryEntry, deleteDiaryEntry, updateDiaryEntry } from "@/app/actions/trade-diary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { buildDownloadUrl } from "@/lib/download";
import type { TradeDiaryEntry } from "@/types";

export function DiaryTab({
  canManage,
  entries,
  tradeId,
}: {
  tradeId: string;
  entries: TradeDiaryEntry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TradeDiaryEntry | null>(null);
  const [content, setContent] = useState("");
  const [removedIndices, setRemovedIndices] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openAdd() {
    setEditingEntry(null);
    setContent("");
    setRemovedIndices([]);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(entry: TradeDiaryEntry) {
    setEditingEntry(entry);
    setContent(entry.content);
    setRemovedIndices([]);
    setError(null);
    setDialogOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("removed_indices", removedIndices.join(","));
    setError(null);

    startTransition(async () => {
      const result = editingEntry
        ? await updateDiaryEntry(editingEntry.id, tradeId, formData)
        : await addDiaryEntry(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(editingEntry ? "Diary entry updated" : "Diary entry added");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleDelete(entryId: string) {
    startTransition(async () => {
      const result = await deleteDiaryEntry(entryId, tradeId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Diary entry deleted");
      router.refresh();
    });
  }

  const visibleAttachments =
    editingEntry?.attachments.filter((_, index) => !removedIndices.includes(index)) ?? [];

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]" onClick={openAdd} size="sm" type="button">
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      ) : null}

      {entries.length ? (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={entry.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">
                    {entry.author_name} -{" "}
                    {new Date(entry.created_at).toLocaleString(undefined, {
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {entry.updated_at !== entry.created_at ? " (edited)" : ""}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#0d1b34]">{entry.content}</p>
                  {entry.attachments.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.attachments.map((attachment) => (
                        <a
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
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
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button className="h-8 w-8" onClick={() => openEdit(entry)} size="icon" type="button" variant="ghost">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit diary entry</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="h-8 w-8" size="icon" type="button" variant="ghost">
                          <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
                          <span className="sr-only">Delete diary entry</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete diary entry?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(entry.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          No diary entries yet.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "New Diary Entry"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="diary-content">Note</Label>
              <Textarea
                id="diary-content"
                name="content"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write a note about this trade..."
                required
                rows={5}
                value={content}
              />
            </div>

            {editingEntry && visibleAttachments.length ? (
              <div className="space-y-2">
                <Label>Existing Attachments</Label>
                <div className="flex flex-wrap gap-2">
                  {editingEntry.attachments.map((attachment, index) =>
                    removedIndices.includes(index) ? null : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                        key={attachment.onedrive_url}
                      >
                        {attachment.name}
                        <button
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => setRemovedIndices((current) => [...current, index])}
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{editingEntry ? "Add More Files" : "Attachments"} (up to 5)</Label>
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <input
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                    className="block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium"
                    key={index}
                    name={editingEntry ? `new_attachment_${index}` : `attachment_${index}`}
                    type="file"
                  />
                ))}
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingEntry ? "Save" : "Add Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
