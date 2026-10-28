import { XIcon } from "lucide-react";
import { dismissRecentThread } from "~/hooks/useRecentThreads";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { RecentThreadEntry } from "./recentThreads.logic";

export function RecentThreadDismissButton({ entry }: { readonly entry: RecentThreadEntry }) {
  return (
    <span className="shrink-0 opacity-0 focus-within:opacity-100 group-hover/recent:opacity-100 max-sm:opacity-100">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label={`Dismiss ${entry.thread.title} from Recent`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                dismissRecentThread(entry);
              }}
            />
          }
        >
          <XIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup>Dismiss from Recent</TooltipPopup>
      </Tooltip>
    </span>
  );
}
