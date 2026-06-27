"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveTradeShareholders } from "@/app/actions/trades";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TradeShareholder } from "@/types";

type VendorOption = {
  id: string;
  name: string;
  code: string;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type EditableShareholder = {
  id?: string;
  user_id: string;
  person_name: string;
  split_pct: string;
  invoices_through_entity: boolean;
  expense_vendor_id: string;
};

function rowsFromShareholders(shareholders: TradeShareholder[]): EditableShareholder[] {
  return shareholders.map((shareholder) => ({
    id: shareholder.id,
    user_id: shareholder.user_id ?? "none",
    person_name: shareholder.person_name,
    split_pct: String(shareholder.split_pct),
    invoices_through_entity: shareholder.invoices_through_entity,
    expense_vendor_id: shareholder.expense_vendor_id ?? "none",
  }));
}

function totalSplit(rows: Pick<EditableShareholder, "split_pct">[]) {
  return rows.reduce((total, row) => total + (Number(row.split_pct) || 0), 0);
}

function totalClass(total: number) {
  return Math.abs(total - 100) <= 0.01 ? "text-green-700" : "text-red-700";
}

export function ShareholderRulesEditor({
  availableUsers,
  availableVendors,
  canManage,
  initialShareholders,
  tradeId,
}: {
  tradeId: string;
  initialShareholders: TradeShareholder[];
  availableUsers: UserOption[];
  availableVendors: VendorOption[];
  canManage: boolean;
}) {
  const { language } = useLanguage();
  const text = language === "zh"
    ? {
        actions: "操作",
        addPerson: "新增人員",
        cancel: "取消",
        editSplitRules: "編輯分成規則",
        invoicesThroughEntity: "透過公司實體開票",
        noRules: "尚無利潤分成規則。",
        none: "無",
        percentHelp: "百分比總和必須為 100%",
        person: "人員",
        personName: "人員姓名",
        profitSplitRules: "利潤分成規則",
        removeShareholder: "移除股東",
        save: "儲存",
        selectUser: "選擇使用者",
        selectVendor: "選擇費用廠商",
        splitPct: "分成 %",
        total: "合計",
        useTextName: "使用文字姓名",
        vendor: "費用廠商",
        yes: "是",
        no: "否",
      }
    : {
        actions: "Actions",
        addPerson: "Add Person",
        cancel: "Cancel",
        editSplitRules: "Edit Split Rules",
        invoicesThroughEntity: "Invoices Through Entity",
        noRules: "No profit split rules yet.",
        none: "None",
        percentHelp: "Percentages must sum to 100%",
        person: "Person",
        personName: "Person name",
        profitSplitRules: "Profit Split Rules",
        removeShareholder: "Remove shareholder",
        save: "Save",
        selectUser: "Select user",
        selectVendor: "Select vendor",
        splitPct: "Split %",
        total: "Total",
        useTextName: "Use text name",
        vendor: "Vendor",
        yes: "Yes",
        no: "No",
      };
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableShareholder[]>(() => rowsFromShareholders(initialShareholders));
  const [isPending, startTransition] = useTransition();

  const vendorById = useMemo(
    () => new Map(availableVendors.map((vendor) => [vendor.id, vendor])),
    [availableVendors]
  );
  const userById = useMemo(() => new Map(availableUsers.map((user) => [user.id, user])), [availableUsers]);
  const total = totalSplit(rows);
  const isTotalValid = Math.abs(total - 100) <= 0.01;

  function updateRow(index: number, patch: Partial<EditableShareholder>) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((currentRows) => [
      ...currentRows,
      {
        user_id: "none",
        person_name: "",
        split_pct: "0",
        invoices_through_entity: false,
        expense_vendor_id: "none",
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  }

  function resetRows() {
    setRows(rowsFromShareholders(initialShareholders));
  }

  function handleSave() {
    if (!isTotalValid) {
      return;
    }

    startTransition(async () => {
      const result = await saveTradeShareholders(
        tradeId,
        rows.map((row) => ({
          id: row.id,
          user_id: row.user_id !== "none" ? row.user_id : null,
          person_name: row.person_name,
          split_pct: Number(row.split_pct) || 0,
          invoices_through_entity: row.invoices_through_entity,
          expense_vendor_id:
            row.invoices_through_entity && row.expense_vendor_id !== "none" ? row.expense_vendor_id : null,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Profit split rules saved");
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{text.profitSplitRules}</CardTitle>
        {canManage && !isEditing ? (
          <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
            {text.editSplitRules}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{text.person}</TableHead>
              <TableHead>{text.splitPct}</TableHead>
              <TableHead>{text.invoicesThroughEntity}</TableHead>
              <TableHead>{text.vendor}</TableHead>
              {isEditing ? <TableHead className="text-right">{text.actions}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row, index) => {
                const vendor = row.expense_vendor_id === "none" ? null : vendorById.get(row.expense_vendor_id);

                return (
                  <TableRow key={row.id ?? `new-${index}`}>
                    <TableCell>
                      {isEditing ? (
                        <div className="grid gap-2">
                          <Select
                            onValueChange={(value) => {
                              const selectedUser = value === "none" ? null : userById.get(value);
                              updateRow(index, {
                                user_id: value,
                                person_name: selectedUser?.name ?? row.person_name,
                              });
                            }}
                            value={row.user_id}
                          >
                            <SelectTrigger className="min-w-56">
                              <SelectValue placeholder={text.selectUser} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{text.useTextName}</SelectItem>
                              {availableUsers.map((availableUser) => (
                                <SelectItem key={availableUser.id} value={availableUser.id}>
                                  {availableUser.name} ({availableUser.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.user_id === "none" ? (
                            <Input
                              onChange={(event) => updateRow(index, { person_name: event.currentTarget.value })}
                              placeholder={text.personName}
                              value={row.person_name}
                            />
                          ) : null}
                        </div>
                      ) : (
                        row.person_name
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          className="w-28"
                          min="0.01"
                          onChange={(event) => updateRow(index, { split_pct: event.currentTarget.value })}
                          step="0.01"
                          type="number"
                          value={row.split_pct}
                        />
                      ) : (
                        `${Number(row.split_pct) || 0}%`
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <label className="flex items-center gap-2 text-sm text-[#0d1b34]">
                          <input
                            checked={row.invoices_through_entity}
                            className="h-4 w-4 rounded border-slate-300"
                            onChange={(event) =>
                              updateRow(index, {
                                invoices_through_entity: event.currentTarget.checked,
                                expense_vendor_id: event.currentTarget.checked ? row.expense_vendor_id : "none",
                              })
                            }
                            type="checkbox"
                          />
                          {text.yes}
                        </label>
                      ) : row.invoices_through_entity ? (
                        vendor ? `${text.yes} (${vendor.code})` : text.yes
                      ) : (
                        text.no
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing && row.invoices_through_entity ? (
                        <Select
                          onValueChange={(value) => updateRow(index, { expense_vendor_id: value })}
                          value={row.expense_vendor_id}
                        >
                          <SelectTrigger className="min-w-56">
                            <SelectValue placeholder={text.selectVendor} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{text.none}</SelectItem>
                            {availableVendors.map((availableVendor) => (
                              <SelectItem key={availableVendor.id} value={availableVendor.id}>
                                {availableVendor.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : vendor ? (
                        vendor.code
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    {isEditing ? (
                      <TableCell className="text-right">
                        <Button
                          aria-label={text.removeShareholder}
                          onClick={() => removeRow(index)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="text-slate-500" colSpan={isEditing ? 5 : 4}>
                  {text.noRules}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">{text.total}</TableCell>
              <TableCell className={`font-semibold ${totalClass(total)}`}>{total.toFixed(2)}%</TableCell>
              <TableCell colSpan={isEditing ? 3 : 2} />
            </TableRow>
          </TableFooter>
        </Table>

        {isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={addRow} type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {text.addPerson}
            </Button>
            <div className="flex justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  resetRows();
                  setIsEditing(false);
                }}
                type="button"
                variant="outline"
              >
                {text.cancel}
              </Button>
              <span title={!isTotalValid ? text.percentHelp : undefined}>
                <Button
                  className="bg-[#0d1b34] hover:bg-[#13294d]"
                  disabled={isPending || !isTotalValid}
                  onClick={handleSave}
                  type="button"
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {text.save}
                </Button>
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
