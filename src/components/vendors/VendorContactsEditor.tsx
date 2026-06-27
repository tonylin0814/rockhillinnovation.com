"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateVendor } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VendorContact } from "@/types";

const emptyContact: VendorContact = {
  name: "",
  role: "",
  email: "",
  phone: "",
};

type VendorContactRow = VendorContact & { _key: string };

function createContactRow(contact?: Partial<VendorContact>, index = 0): VendorContactRow {
  return {
    ...emptyContact,
    ...contact,
    _key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  };
}

function stripContactKey(contact: VendorContactRow): VendorContact {
  const { _key, ...cleanContact } = contact;
  return cleanContact;
}

export function VendorContactsEditor({
  initialContacts,
  vendorId,
}: {
  initialContacts: VendorContact[];
  vendorId: string;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [contacts, setContacts] = useState<VendorContactRow[]>(() => initialContacts.map(createContactRow));
  const [isPending, startTransition] = useTransition();
  const text =
    language === "zh"
      ? {
          addContact: "新增聯絡人",
          cancel: "取消",
          editContacts: "編輯聯絡人",
          email: "電子郵件",
          name: "姓名",
          noContacts: "尚無聯絡人。",
          phone: "電話",
          removeContact: "移除聯絡人",
          role: "職稱",
          saveContacts: "儲存聯絡人",
          saved: "聯絡人已儲存",
        }
      : {
          addContact: "Add Contact",
          cancel: "Cancel",
          editContacts: "Edit Contacts",
          email: "Email",
          name: "Name",
          noContacts: "No contacts yet.",
          phone: "Phone",
          removeContact: "Remove contact",
          role: "Role",
          saveContacts: "Save Contacts",
          saved: "Contacts saved",
        };

  function updateContact(index: number, field: keyof VendorContact, value: string) {
    setContacts((current) =>
      current.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact))
    );
  }

  function addContact() {
    setContacts((current) => [...current, createContactRow(undefined, current.length)]);
  }

  function removeContact(index: number) {
    setContacts((current) => current.filter((_, contactIndex) => contactIndex !== index));
  }

  function cancelEdit() {
    setContacts(initialContacts.map(createContactRow));
    setIsEditing(false);
  }

  function saveContacts() {
    const formData = new FormData();
    formData.set("contacts", JSON.stringify(contacts.map(stripContactKey)));

    startTransition(async () => {
      const result = await updateVendor(vendorId, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(text.saved);
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {isEditing ? (
          <>
            <Button disabled={isPending} onClick={addContact} type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {text.addContact}
            </Button>
            <Button disabled={isPending} onClick={cancelEdit} type="button" variant="outline">
              {text.cancel}
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={saveContacts}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {text.saveContacts}
            </Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)} type="button" variant="outline">
            {text.editContacts}
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{text.name}</TableHead>
            <TableHead>{text.role}</TableHead>
            <TableHead>{text.email}</TableHead>
            <TableHead>{text.phone}</TableHead>
            {isEditing ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length ? (
            contacts.map((contact, index) => (
              <TableRow key={contact._key}>
                {(["name", "role", "email", "phone"] as const).map((field) => (
                  <TableCell key={field}>
                    {isEditing ? (
                      <Input
                        disabled={isPending}
                        onChange={(event) => updateContact(index, field, event.currentTarget.value)}
                        type={field === "email" ? "email" : "text"}
                        value={contact[field]}
                      />
                    ) : (
                      contact[field] || "—"
                    )}
                  </TableCell>
                ))}
                {isEditing ? (
                  <TableCell>
                    <Button
                      aria-label={text.removeContact}
                      disabled={isPending}
                      onClick={() => removeContact(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={isEditing ? 5 : 4}>
                {text.noContacts}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
