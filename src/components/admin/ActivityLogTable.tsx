import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TradeActivityLog } from "@/types";

const actionClasses: Record<TradeActivityLog["action"], string> = {
  created: "border-green-200 bg-green-50 text-green-700",
  deleted: "border-red-200 bg-red-50 text-red-700",
  updated: "border-blue-200 bg-blue-50 text-blue-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export async function ActivityLogTable({ tradeId }: { tradeId?: string }) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("trade_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (tradeId) {
    query = query.eq("trade_id", tradeId);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as TradeActivityLog[];

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm text-slate-500">{formatDate(row.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-[#0d1b34]">{row.user_name}</div>
                    <Badge className="mt-1 border-slate-200 bg-slate-100 text-slate-700" variant="outline">
                      {row.user_role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={actionClasses[row.action]} variant="outline">
                      {row.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{row.target_table}</TableCell>
                  <TableCell className="text-sm">{row.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-6 py-10 text-sm text-slate-500">No activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
