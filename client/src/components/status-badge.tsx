import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import type { TunnelState } from "@shared/schema";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  state: TunnelState;
  showIcon?: boolean;
  size?: "sm" | "default";
}

const stateConfig: Record<TunnelState, { label: string; icon: typeof CheckCircle; className: string; dotClass: string }> = {
  up: {
    label: "UP",
    icon: CheckCircle,
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    dotClass: "bg-emerald-500",
  },
  down: {
    label: "DOWN",
    icon: XCircle,
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    dotClass: "bg-red-500",
  },
  flapping: {
    label: "FLAPPING",
    icon: AlertTriangle,
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dotClass: "bg-amber-500 animate-pulse",
  },
};

export function StatusBadge({ state, showIcon = true, size = "default" }: StatusBadgeProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium uppercase tracking-wide border",
        config.className,
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      )}
    >
      {showIcon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      {config.label}
    </Badge>
  );
}

export function StatusDot({ state, size = "default" }: { state: TunnelState; size?: "sm" | "default" }) {
  const config = stateConfig[state];
  
  return (
    <span 
      className={cn(
        "inline-block rounded-full",
        config.dotClass,
        size === "sm" ? "h-2 w-2" : "h-3 w-3"
      )} 
    />
  );
}

export function ConnectionStatus({ isConnected, isPolling }: { isConnected: boolean; isPolling?: boolean }) {
  if (isPolling) {
    return (
      <Badge variant="outline" className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Polling
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        isConnected 
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          : "bg-muted text-muted-foreground border-muted-foreground/30"
      )}
    >
      <span className={cn(
        "h-2 w-2 rounded-full mr-1.5",
        isConnected ? "bg-emerald-500" : "bg-muted-foreground"
      )} />
      {isConnected ? "Connected" : "Disconnected"}
    </Badge>
  );
}
