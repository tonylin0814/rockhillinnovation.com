import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-8 backdrop-blur">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Rock Hill Innovation</p>
        <p className="text-sm font-medium text-[#0d1b34]">Trade operations workspace</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right text-sm sm:block">
          <p className="font-medium text-[#0d1b34]">Tony</p>
          <p className="text-xs text-slate-500">Admin</p>
        </div>
        <Avatar>
          <AvatarFallback className="bg-[#0d1b34] text-white">RH</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
