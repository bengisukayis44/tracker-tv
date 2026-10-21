"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import { characterLabel, type CastMember } from "@/lib/cast";
import { cn } from "@/lib/utils";

/** Round actor photo, or an icon when TMDB has none. */
export function CastAvatar({ member, className }: { member: CastMember | undefined; className?: string }) {
  return (
    <span className={cn("bg-muted relative inline-flex size-10 shrink-0 overflow-hidden rounded-full", className)}>
      {member?.profileUrl ? (
        <Image src={member.profileUrl} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <UserRound className="text-muted-foreground m-auto size-5" />
      )}
    </span>
  );
}

/** "Favori karakterin": one character from the cast, or none. Choosing the selected one again clears it. */
export function CharacterPicker({
  cast,
  value,
  onChange,
}: {
  cast: CastMember[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <ul className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
      {cast.map((member) => {
        const selected = member.id === value;
        return (
          <li key={member.id}>
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`${characterLabel(member)} (${member.name})`}
              onClick={() => onChange(selected ? null : member.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors",
                selected ? "border-primary bg-primary/10" : "hover:bg-accent",
              )}
            >
              <CastAvatar member={member} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{characterLabel(member)}</span>
                <span className="text-muted-foreground block truncate text-xs">{member.name}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
