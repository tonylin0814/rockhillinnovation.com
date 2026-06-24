"use client";

import { Label } from "@/components/ui/label";
import type { UserClientAccess } from "@/types";

export type ClientAccessClient = {
  id: string;
  code: string;
  name: string;
};

export type ClientAccessState = Record<string, { enabled: boolean; accessLevel: "read" | "edit" }>;

export function buildClientAccessState(
  clients: ClientAccessClient[],
  grants: UserClientAccess[] = []
): ClientAccessState {
  const grantMap = new Map(grants.map((grant) => [grant.client_id, grant.access_level]));

  return clients.reduce<ClientAccessState>((state, client) => {
    const accessLevel = grantMap.get(client.id);
    state[client.id] = {
      accessLevel: accessLevel ?? "read",
      enabled: Boolean(accessLevel),
    };
    return state;
  }, {});
}

export function UserClientAccessFields({
  clients,
  disabled,
  onChange,
  value,
}: {
  clients: ClientAccessClient[];
  disabled: boolean;
  value: ClientAccessState;
  onChange: (value: ClientAccessState) => void;
}) {
  function updateClient(clientId: string, patch: Partial<ClientAccessState[string]>) {
    onChange({
      ...value,
      [clientId]: {
        accessLevel: value[clientId]?.accessLevel ?? "read",
        enabled: value[clientId]?.enabled ?? false,
        ...patch,
      },
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-sm font-semibold text-[#0d1b34]">Client Access</p>
        <p className="text-xs text-slate-500">Choose which clients this user can see.</p>
      </div>
      <div className="max-h-64 space-y-3 overflow-auto pr-1">
        {clients.map((client) => {
          const row = value[client.id] ?? { accessLevel: "read", enabled: false };

          return (
            <div className="rounded-md border border-slate-200 bg-white p-3" key={client.id}>
              <div className="flex items-start gap-3">
                <input
                  checked={row.enabled}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  disabled={disabled}
                  id={`client-${client.id}`}
                  onChange={(event) => updateClient(client.id, { enabled: event.currentTarget.checked })}
                  type="checkbox"
                />
                <div className="min-w-0 flex-1">
                  <Label className="font-medium text-[#0d1b34]" htmlFor={`client-${client.id}`}>
                    {client.code} - {client.name}
                  </Label>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        checked={row.accessLevel === "read"}
                        className="h-4 w-4 border-slate-300"
                        disabled={disabled || !row.enabled}
                        id={`client-${client.id}-read`}
                        onChange={() => updateClient(client.id, { accessLevel: "read" })}
                        type="radio"
                      />
                      <Label className="text-xs" htmlFor={`client-${client.id}-read`}>
                        Read
                      </Label>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={row.accessLevel === "edit"}
                        className="h-4 w-4 border-slate-300"
                        disabled={disabled || !row.enabled}
                        id={`client-${client.id}-edit`}
                        onChange={() => updateClient(client.id, { accessLevel: "edit" })}
                        type="radio"
                      />
                      <Label className="text-xs" htmlFor={`client-${client.id}-edit`}>
                        Edit
                      </Label>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!clients.length ? <p className="text-sm text-slate-500">No active clients available.</p> : null}
      </div>
    </div>
  );
}
