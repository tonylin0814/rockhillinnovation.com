"use client";

import { ChevronDown, ChevronRight, Edit, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createDevelopmentCost,
  createDevelopmentVersion,
  deleteDevelopmentCost,
  deleteDevelopmentVersion,
  updateDevelopmentCost,
  updateDevelopmentVersion,
} from "@/app/actions/development";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  DevelopmentCostType,
  DevelopmentVersionStatus,
  Product,
  TradeDevelopmentCost,
  TradeDevelopmentVersion,
} from "@/types";

type ProductOption = Pick<Product, "id" | "code" | "name_english">;

type DevelopmentGroup = {
  key: string;
  productId: string | null;
  productNameOverride: string | null;
  product: TradeDevelopmentVersion["product"] | null;
  versions: TradeDevelopmentVersion[];
  costs: TradeDevelopmentCost[];
};

const statusClasses: Record<DevelopmentVersionStatus, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  sent_to_producer: "border-blue-200 bg-blue-50 text-blue-700",
  sample_received: "border-amber-200 bg-amber-50 text-amber-700",
  client_approved: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  in_correction: "border-orange-200 bg-orange-50 text-orange-700",
};

const statusLabels: Record<DevelopmentVersionStatus, string> = {
  draft: "Draft",
  sent_to_producer: "Sent to Producer",
  sample_received: "Sample Received",
  client_approved: "Client Approved",
  rejected: "Rejected",
  in_correction: "In Correction",
};

const costTypeLabels: Record<DevelopmentCostType, string> = {
  molding: "Molding / Tooling",
  sample: "Sample Production",
  express_shipping: "Express Shipping",
  other: "Other",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatAmount(value: number | null) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function statusBadge(status: DevelopmentVersionStatus) {
  return (
    <Badge className={statusClasses[status]} variant="outline">
      {statusLabels[status]}
    </Badge>
  );
}

function DeleteButton({
  action,
  disabled,
  label,
}: {
  action: () => Promise<{ success?: true; error?: string }>;
  disabled?: boolean;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await action();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${label} deleted`);
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled || isPending} size="icon" type="button" variant="ghost">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VersionDialog({
  children,
  defaultProductId,
  defaultProductNameOverride,
  products,
  tradeId,
  version,
}: {
  children: ReactNode;
  defaultProductId?: string | null;
  defaultProductNameOverride?: string | null;
  products: ProductOption[];
  tradeId: string;
  version?: TradeDevelopmentVersion;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [productId, setProductId] = useState(version?.product_id ?? defaultProductId ?? "none");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = version
        ? await updateDevelopmentVersion(version.id, formData)
        : await createDevelopmentVersion(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(version ? "Version updated" : "Version added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{version ? "Edit Version" : "Add Version"}</DialogTitle>
          <DialogDescription>Track product development files, samples, and approvals.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <input name="trade_id" type="hidden" value={tradeId} />
          <div className="space-y-2">
            <Label>Product</Label>
            <Select disabled={isPending} name="product_id" onValueChange={setProductId} value={productId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use text override</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name_english}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {productId === "none" ? (
            <div className="space-y-2">
              <Label htmlFor="product_name_override">Product Name</Label>
              <Input
                defaultValue={version?.product_name_override ?? defaultProductNameOverride ?? ""}
                disabled={isPending}
                id="product_name_override"
                name="product_name_override"
              />
            </div>
          ) : (
            <input name="product_name_override" type="hidden" value="" />
          )}
          <div className="space-y-2">
            <Label htmlFor="version_label">Version Label</Label>
            <Input
              defaultValue={version?.version_label ?? ""}
              disabled={isPending}
              id="version_label"
              name="version_label"
              placeholder="v1.0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select defaultValue={version?.status ?? "draft"} disabled={isPending} name="status">
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabels) as DevelopmentVersionStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="change_summary">Change Summary</Label>
            <Textarea
              defaultValue={version?.change_summary ?? ""}
              disabled={isPending}
              id="change_summary"
              name="change_summary"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="file_onedrive_url">Design File URL</Label>
            <Input
              defaultValue={version?.file_onedrive_url ?? ""}
              disabled={isPending}
              id="file_onedrive_url"
              name="file_onedrive_url"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={version?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>
          {error ? <p className="text-sm font-medium text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CostDialog({
  children,
  cost,
  tradeId,
  versions,
}: {
  children: ReactNode;
  cost?: TradeDevelopmentCost;
  tradeId: string;
  versions: TradeDevelopmentVersion[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = cost ? await updateDevelopmentCost(cost.id, formData) : await createDevelopmentCost(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(cost ? "Cost updated" : "Cost added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cost ? "Edit Development Cost" : "Add Development Cost"}</DialogTitle>
          <DialogDescription>Track sample, tooling, shipping, and other development costs.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <input name="trade_id" type="hidden" value={tradeId} />
          <div className="space-y-2">
            <Label>Cost Type</Label>
            <Select defaultValue={cost?.cost_type ?? "sample"} disabled={isPending} name="cost_type">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(costTypeLabels) as DevelopmentCostType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {costTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Link to Version</Label>
            <Select defaultValue={cost?.version_id ?? "none"} disabled={isPending} name="version_id">
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.version_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input defaultValue={cost?.description ?? ""} disabled={isPending} id="description" name="description" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount_rmb">Amount (RMB)</Label>
            <Input defaultValue={cost?.amount_rmb ?? ""} disabled={isPending} id="amount_rmb" min="0" name="amount_rmb" step="0.01" type="number" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount_cad">Amount (CAD)</Label>
            <Input defaultValue={cost?.amount_cad ?? ""} disabled={isPending} id="amount_cad" min="0" name="amount_cad" step="0.01" type="number" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount_usd">Amount (USD)</Label>
            <Input defaultValue={cost?.amount_usd ?? ""} disabled={isPending} id="amount_usd" min="0" name="amount_usd" step="0.01" type="number" />
          </div>
          <label className="flex items-center gap-2 pt-8 text-sm font-medium text-[#0d1b34]">
            <input
              defaultChecked={cost?.is_absorbed ?? true}
              disabled={isPending}
              name="is_absorbed"
              type="checkbox"
              value="true"
            />
            Absorbed into trade?
          </label>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={cost?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>
          {error ? <p className="text-sm font-medium text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function summarizeCosts(costs: TradeDevelopmentCost[], absorbed: boolean) {
  return costs
    .filter((cost) => cost.is_absorbed === absorbed)
    .reduce(
      (totals, cost) => ({
        cad: totals.cad + (cost.amount_cad ?? 0),
        rmb: totals.rmb + (cost.amount_rmb ?? 0),
        usd: totals.usd + (cost.amount_usd ?? 0),
      }),
      { cad: 0, rmb: 0, usd: 0 }
    );
}

export function DevelopmentTab({
  availableProducts,
  canManage,
  devCosts,
  devVersions,
  tradeId,
}: {
  availableProducts: ProductOption[];
  canManage: boolean;
  devCosts: TradeDevelopmentCost[];
  devVersions: TradeDevelopmentVersion[];
  tradeId: string;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const versionById = useMemo(() => new Map(devVersions.map((version) => [version.id, version])), [devVersions]);
  const groups = useMemo<DevelopmentGroup[]>(() => {
    const groupMap = new Map<string, DevelopmentGroup>();

    for (const version of devVersions) {
      const key = `${version.product_id ?? "none"}::${version.product_name_override ?? ""}`;
      const existing = groupMap.get(key);

      if (existing) {
        existing.versions.push(version);
      } else {
        groupMap.set(key, {
          key,
          product: version.product ?? null,
          productId: version.product_id,
          productNameOverride: version.product_name_override,
          versions: [version],
          costs: [],
        });
      }
    }

    const unlinkedCosts: TradeDevelopmentCost[] = [];

    for (const cost of devCosts) {
      const version = cost.version_id ? versionById.get(cost.version_id) : null;

      if (!version) {
        unlinkedCosts.push(cost);
        continue;
      }

      const key = `${version.product_id ?? "none"}::${version.product_name_override ?? ""}`;
      groupMap.get(key)?.costs.push(cost);
    }

    if (unlinkedCosts.length) {
      groupMap.set("__unlinked__", {
        key: "__unlinked__",
        product: null,
        productId: null,
        productNameOverride: "General Development",
        versions: [],
        costs: unlinkedCosts,
      });
    }

    return Array.from(groupMap.values()).map((group) => ({
      ...group,
      costs: group.costs.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      versions: group.versions.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
  }, [devCosts, devVersions, versionById]);
  const absorbedTotals = summarizeCosts(devCosts, true);
  const invoiceTotals = summarizeCosts(devCosts, false);

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (!groups.length) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#0d1b34]">Development</h2>
            <p className="text-sm text-slate-500">No development versions or costs yet.</p>
          </div>
          {canManage ? (
            <VersionDialog products={availableProducts} tradeId={tradeId}>
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Version
              </Button>
            </VersionDialog>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage ? (
          <VersionDialog products={availableProducts} tradeId={tradeId}>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Version
            </Button>
          </VersionDialog>
        ) : null}
      </div>

      {groups.map((group) => {
        const latestVersion = group.versions[group.versions.length - 1];
        const title = group.product
          ? `${group.product.code} - ${group.product.name_english}`
          : group.productNameOverride ?? "General Development";
        const isExpanded = expandedGroups.has(group.key);

        return (
          <Card className="border-slate-200 shadow-sm" key={group.key}>
            <button
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
              onClick={() => toggleGroup(group.key)}
              type="button"
            >
              <div className="flex min-w-0 items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#0d1b34]">{title}</p>
                  <p className="text-xs text-slate-500">{group.versions.length} versions</p>
                </div>
              </div>
              {latestVersion ? statusBadge(latestVersion.status) : <Badge variant="outline">No version</Badge>}
            </button>

            {isExpanded ? (
              <CardContent className="space-y-6 border-t border-slate-100 pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#0d1b34]">Version History</h3>
                    {canManage ? (
                      <VersionDialog
                        defaultProductId={group.productId}
                        defaultProductNameOverride={group.productNameOverride}
                        products={availableProducts}
                        tradeId={tradeId}
                      >
                        <Button size="sm" variant="outline">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Version
                        </Button>
                      </VersionDialog>
                    ) : null}
                  </div>
                  {group.versions.length ? (
                    <div className="space-y-3">
                      {group.versions.map((version) => (
                        <div className="rounded-lg border border-slate-200 p-3" key={version.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-[#0d1b34]">{version.version_label}</p>
                              <p className="text-xs text-slate-500">{formatDate(version.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {statusBadge(version.status)}
                              {version.file_onedrive_url ? (
                                <Button asChild size="icon" variant="ghost">
                                  <a href={version.file_onedrive_url} rel="noreferrer" target="_blank">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              ) : null}
                              {canManage ? (
                                <>
                                  <VersionDialog products={availableProducts} tradeId={tradeId} version={version}>
                                    <Button size="icon" variant="ghost">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </VersionDialog>
                                  <DeleteButton
                                    action={() => deleteDevelopmentVersion(version.id, tradeId)}
                                    label="version"
                                  />
                                </>
                              ) : null}
                            </div>
                          </div>
                          {version.change_summary ? (
                            <p className="mt-3 text-sm text-slate-600">{version.change_summary}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No versions yet.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#0d1b34]">Development Costs</h3>
                    {canManage ? (
                      <CostDialog tradeId={tradeId} versions={group.versions}>
                        <Button size="sm" variant="outline">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Cost
                        </Button>
                      </CostDialog>
                    ) : null}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">RMB</TableHead>
                        <TableHead className="text-right">CAD</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                        <TableHead>Absorbed?</TableHead>
                        <TableHead>Link to Version</TableHead>
                        {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.costs.length ? (
                        group.costs.map((cost) => {
                          const linkedVersion = cost.version_id ? versionById.get(cost.version_id) : null;
                          return (
                            <TableRow key={cost.id}>
                              <TableCell>{costTypeLabels[cost.cost_type]}</TableCell>
                              <TableCell>{cost.description ?? "-"}</TableCell>
                              <TableCell className="text-right">{formatAmount(cost.amount_rmb)}</TableCell>
                              <TableCell className="text-right">{formatAmount(cost.amount_cad)}</TableCell>
                              <TableCell className="text-right">{formatAmount(cost.amount_usd)}</TableCell>
                              <TableCell>{cost.is_absorbed ? "Yes" : "No"}</TableCell>
                              <TableCell>{linkedVersion?.version_label ?? "-"}</TableCell>
                              {canManage ? (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <CostDialog cost={cost} tradeId={tradeId} versions={group.versions}>
                                      <Button size="icon" variant="ghost">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </CostDialog>
                                    <DeleteButton action={() => deleteDevelopmentCost(cost.id, tradeId)} label="cost" />
                                  </div>
                                </TableCell>
                              ) : null}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell className="text-slate-500" colSpan={canManage ? 8 : 7}>
                            No development costs yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            ) : null}
          </Card>
        );
      })}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <h3 className="text-sm font-semibold text-[#0d1b34]">Cost Summary</h3>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total absorbed</p>
            <p className="mt-2 text-sm text-[#0d1b34]">
              RMB {absorbedTotals.rmb.toFixed(2)} | CAD {absorbedTotals.cad.toFixed(2)} | USD{" "}
              {absorbedTotals.usd.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To invoice client</p>
            <p className="mt-2 text-sm text-[#0d1b34]">
              RMB {invoiceTotals.rmb.toFixed(2)} | CAD {invoiceTotals.cad.toFixed(2)} | USD{" "}
              {invoiceTotals.usd.toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
