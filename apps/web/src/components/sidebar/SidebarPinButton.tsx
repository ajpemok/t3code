import { PinIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SidebarPinButton({
  pinned,
  label,
  disabled,
  actionFor,
  accent = "var(--primary)",
  onClick,
}: {
  readonly pinned: boolean;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly actionFor?: string;
  readonly accent?: string | undefined;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pinned}
            disabled={disabled}
            data-sidebar-action-for={actionFor}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClick(event);
            }}
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-sidebar-muted-foreground outline-none transition-colors hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
            style={pinned ? { color: accent } : undefined}
          />
        }
      >
        <PinIcon aria-hidden className="size-3.5" fill={pinned ? "currentColor" : "none"} />
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
