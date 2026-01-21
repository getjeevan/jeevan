import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { RefreshCw, Settings, Shield, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  isPolling: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshed?: string | null;
  onOpenSettings: () => void;
  connectedFirewalls: number;
  totalFirewalls: number;
}

export function Header({ 
  isPolling, 
  onRefresh, 
  isRefreshing, 
  lastRefreshed,
  onOpenSettings,
  connectedFirewalls,
  totalFirewalls,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">VPNWatch</h1>
              <p className="text-xs text-muted-foreground">Palo Alto S2S Monitor</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 text-sm" data-testid="status-firewall-connection">
            {connectedFirewalls > 0 ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-muted-foreground" data-testid="text-firewall-status">
                  {connectedFirewalls}/{totalFirewalls} firewalls connected
                </span>
              </>
            ) : totalFirewalls > 0 ? (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground" data-testid="text-firewall-status">No firewalls connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground" data-testid="text-firewall-status">No firewalls configured</span>
              </>
            )}
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing || totalFirewalls === 0}
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Validate Now"}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onOpenSettings}
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <ThemeToggle />
        </div>
      </div>

      {isPolling && (
        <div className="h-0.5 w-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-[slide_1.5s_ease-in-out_infinite]" 
            style={{
              animation: "slide 1.5s ease-in-out infinite",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </header>
  );
}
