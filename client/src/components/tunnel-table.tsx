import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import type { VPNTunnel } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Shield, ArrowDownToLine, ArrowUpFromLine, Clock, Server, Download, Info, Lock, Key } from "lucide-react";

interface TunnelTableProps {
  tunnels: VPNTunnel[];
  isLoading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "—";
  }
}

function TrafficBar({ bytesIn, bytesOut }: { bytesIn: number; bytesOut: number }) {
  const total = bytesIn + bytesOut;
  if (total === 0) return <span className="text-muted-foreground text-xs">No traffic</span>;
  
  const inPercent = (bytesIn / total) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
          <span className="font-mono">{formatBytes(bytesIn)}</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpFromLine className="h-3 w-3 text-blue-500" />
          <span className="font-mono">{formatBytes(bytesOut)}</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
        <div 
          className="h-full bg-emerald-500 transition-all" 
          style={{ width: `${inPercent}%` }} 
        />
        <div 
          className="h-full bg-blue-500 transition-all" 
          style={{ width: `${100 - inPercent}%` }} 
        />
      </div>
    </div>
  );
}

function TunnelDetailsDialog({ tunnel }: { tunnel: VPNTunnel }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-tunnel-details-${tunnel.id}`}>
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {tunnel.tunnelName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Peer IP</span>
              <p className="font-mono">{tunnel.peerIp}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Firewall</span>
              <p>{tunnel.firewallName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">IKE State</span>
              <StatusBadge state={tunnel.ikeState} size="sm" />
            </div>
            <div>
              <span className="text-muted-foreground">IPSec State</span>
              <StatusBadge state={tunnel.ipsecState} size="sm" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-primary" />
              Phase 1 (IKE) Parameters
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-md">
              <div>
                <span className="text-muted-foreground">Encryption</span>
                <p className="font-mono">{tunnel.phase1Encryption}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Authentication</span>
                <p className="font-mono">{tunnel.phase1Authentication}</p>
              </div>
              <div>
                <span className="text-muted-foreground">DH Group</span>
                <p className="font-mono">{tunnel.phase1DhGroup}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lifetime</span>
                <p className="font-mono">{tunnel.phase1Lifetime}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="h-4 w-4 text-primary" />
              Phase 2 (IPSec) Parameters
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-md">
              <div>
                <span className="text-muted-foreground">Encryption</span>
                <p className="font-mono">{tunnel.phase2Encryption}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Authentication</span>
                <p className="font-mono">{tunnel.phase2Authentication}</p>
              </div>
              <div>
                <span className="text-muted-foreground">DH Group</span>
                <p className="font-mono">{tunnel.phase2DhGroup}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lifetime</span>
                <p className="font-mono">{tunnel.phase2Lifetime}</p>
              </div>
              <div>
                <span className="text-muted-foreground">PFS</span>
                <p className="font-mono">{tunnel.phase2Pfs}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              Traffic Statistics
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-md">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                <div>
                  <span className="text-muted-foreground">Bytes In</span>
                  <p className="font-mono">{formatBytes(tunnel.bytesIn)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4 text-blue-500" />
                <div>
                  <span className="text-muted-foreground">Bytes Out</span>
                  <p className="font-mono">{formatBytes(tunnel.bytesOut)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function exportTunnelsToCSV(tunnels: VPNTunnel[]) {
  const headers = [
    "Tunnel Name",
    "Firewall",
    "Peer IP",
    "IKE State",
    "IPSec State",
    "Phase 1 Encryption",
    "Phase 1 Authentication",
    "Phase 1 DH Group",
    "Phase 1 Lifetime",
    "Phase 2 Encryption",
    "Phase 2 Authentication",
    "Phase 2 DH Group",
    "Phase 2 Lifetime",
    "Phase 2 PFS",
    "Bytes In",
    "Bytes Out",
    "Last Checked",
  ];

  const rows = tunnels.map(tunnel => [
    tunnel.tunnelName,
    tunnel.firewallName,
    tunnel.peerIp,
    tunnel.ikeState,
    tunnel.ipsecState,
    tunnel.phase1Encryption,
    tunnel.phase1Authentication,
    tunnel.phase1DhGroup,
    tunnel.phase1Lifetime,
    tunnel.phase2Encryption,
    tunnel.phase2Authentication,
    tunnel.phase2DhGroup,
    tunnel.phase2Lifetime,
    tunnel.phase2Pfs,
    tunnel.bytesIn.toString(),
    tunnel.bytesOut.toString(),
    tunnel.lastChecked,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `vpn-tunnels-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function TunnelTable({ tunnels, isLoading }: TunnelTableProps) {
  if (isLoading) {
    return <TunnelTableSkeleton />;
  }

  if (tunnels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Shield className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">No VPN Tunnels</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          No tunnels match your current filters, or no firewalls are configured yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="font-medium">Tunnel Name</TableHead>
              <TableHead className="font-medium">Firewall</TableHead>
              <TableHead className="font-medium">Peer IP</TableHead>
              <TableHead className="font-medium">IKE State</TableHead>
              <TableHead className="font-medium">IPsec State</TableHead>
              <TableHead className="font-medium">Phase 1</TableHead>
              <TableHead className="font-medium">Phase 2</TableHead>
              <TableHead className="font-medium min-w-[160px]">Traffic</TableHead>
              <TableHead className="font-medium">Last Checked</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tunnels.map((tunnel) => (
              <TableRow 
                key={tunnel.id} 
                className={cn(
                  "transition-colors",
                  tunnel.ipsecState === "down" && "bg-red-500/5"
                )}
                data-testid={`row-tunnel-${tunnel.id}`}
              >
                <TableCell>
                  <StatusDot state={tunnel.ipsecState} />
                </TableCell>
                <TableCell className="font-medium" data-testid={`text-tunnel-name-${tunnel.id}`}>{tunnel.tunnelName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm" data-testid={`text-tunnel-firewall-${tunnel.id}`}>
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    {tunnel.firewallName}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono" data-testid={`text-tunnel-peer-${tunnel.id}`}>
                    {tunnel.peerIp}
                  </code>
                </TableCell>
                <TableCell data-testid={`badge-tunnel-ike-${tunnel.id}`}>
                  <StatusBadge state={tunnel.ikeState} size="sm" showIcon={false} />
                </TableCell>
                <TableCell data-testid={`badge-tunnel-ipsec-${tunnel.id}`}>
                  <StatusBadge state={tunnel.ipsecState} size="sm" />
                </TableCell>
                <TableCell data-testid={`text-tunnel-phase1-${tunnel.id}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs cursor-help">
                        {tunnel.phase1Encryption}/{tunnel.phase1Authentication}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <p>Enc: {tunnel.phase1Encryption}</p>
                        <p>Auth: {tunnel.phase1Authentication}</p>
                        <p>DH: {tunnel.phase1DhGroup}</p>
                        <p>Life: {tunnel.phase1Lifetime}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell data-testid={`text-tunnel-phase2-${tunnel.id}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs cursor-help">
                        {tunnel.phase2Encryption}/{tunnel.phase2Authentication}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <p>Enc: {tunnel.phase2Encryption}</p>
                        <p>Auth: {tunnel.phase2Authentication}</p>
                        <p>DH: {tunnel.phase2DhGroup}</p>
                        <p>Life: {tunnel.phase2Lifetime}</p>
                        <p>PFS: {tunnel.phase2Pfs}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell data-testid={`text-tunnel-traffic-${tunnel.id}`}>
                  <TrafficBar bytesIn={tunnel.bytesIn} bytesOut={tunnel.bytesOut} />
                </TableCell>
                <TableCell data-testid={`text-tunnel-lastchecked-${tunnel.id}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-default">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimestamp(tunnel.lastChecked)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {tunnel.lastChecked ? new Date(tunnel.lastChecked).toLocaleString() : "Never checked"}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <TunnelDetailsDialog tunnel={tunnel} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TunnelTableSkeleton() {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Tunnel Name</TableHead>
            <TableHead>Firewall</TableHead>
            <TableHead>Peer IP</TableHead>
            <TableHead>IKE State</TableHead>
            <TableHead>IPsec State</TableHead>
            <TableHead>Phase 1</TableHead>
            <TableHead>Phase 2</TableHead>
            <TableHead>Traffic</TableHead>
            <TableHead>Last Checked</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-3 w-3 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-5 w-12" /></TableCell>
              <TableCell><Skeleton className="h-5 w-14" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-6 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-6 w-6" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
