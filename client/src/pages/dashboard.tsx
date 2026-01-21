import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { MetricCard, MetricCardSkeleton } from "@/components/metric-card";
import { TunnelTable, exportTunnelsToCSV } from "@/components/tunnel-table";
import { FiltersPanel } from "@/components/filters-panel";
import { FirewallSettings } from "@/components/firewall-settings";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardStats, VPNTunnel, Firewall, InsertFirewall, TunnelState } from "@shared/schema";
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFirewall, setSelectedFirewall] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isPolling, setIsPolling] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 60000,
  });

  const { data: tunnels = [], isLoading: tunnelsLoading } = useQuery<VPNTunnel[]>({
    queryKey: ["/api/tunnels"],
    refetchInterval: 60000,
  });

  const { data: firewalls = [], isLoading: firewallsLoading } = useQuery<Firewall[]>({
    queryKey: ["/api/firewalls"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/refresh");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tunnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firewalls"] });
      toast({
        title: "Refresh complete",
        description: "VPN tunnel status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh failed",
        description: "Could not fetch latest VPN status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addFirewallMutation = useMutation({
    mutationFn: async (data: InsertFirewall) => {
      return apiRequest("POST", "/api/firewalls", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firewalls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tunnels"] });
      toast({
        title: "Firewall added",
        description: "The firewall has been configured successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to add firewall",
        description: "Could not add the firewall. Please check your settings.",
        variant: "destructive",
      });
    },
  });

  const updateFirewallMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertFirewall> }) => {
      return apiRequest("PATCH", `/api/firewalls/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firewalls"] });
      toast({
        title: "Firewall updated",
        description: "The firewall settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update firewall",
        description: "Could not update the firewall settings.",
        variant: "destructive",
      });
    },
  });

  const deleteFirewallMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/firewalls/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firewalls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tunnels"] });
      toast({
        title: "Firewall removed",
        description: "The firewall has been removed from monitoring.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to remove firewall",
        description: "Could not remove the firewall.",
        variant: "destructive",
      });
    },
  });

  const filteredTunnels = useMemo(() => {
    return tunnels.filter((tunnel) => {
      const matchesSearch = 
        searchQuery === "" ||
        tunnel.tunnelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tunnel.peerIp.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tunnel.firewallName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFirewall = 
        selectedFirewall === "all" || 
        tunnel.firewallId === selectedFirewall;

      const matchesStatus = 
        selectedStatus === "all" || 
        tunnel.ipsecState === selectedStatus;

      return matchesSearch && matchesFirewall && matchesStatus;
    });
  }, [tunnels, searchQuery, selectedFirewall, selectedStatus]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedFirewall !== "all") count++;
    if (selectedStatus !== "all") count++;
    return count;
  }, [searchQuery, selectedFirewall, selectedStatus]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedFirewall("all");
    setSelectedStatus("all");
  };

  const handleRefresh = () => {
    setIsPolling(true);
    refreshMutation.mutate(undefined, {
      onSettled: () => {
        setTimeout(() => setIsPolling(false), 500);
      },
    });
  };

  const connectedFirewalls = firewalls.filter((fw) => fw.isConnected).length;

  return (
    <div className="min-h-screen bg-background">
      <Header
        isPolling={isPolling || refreshMutation.isPending}
        onRefresh={handleRefresh}
        isRefreshing={refreshMutation.isPending}
        onOpenSettings={() => setSettingsOpen(true)}
        connectedFirewalls={connectedFirewalls}
        totalFirewalls={firewalls.length}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                title="Total Tunnels"
                value={stats?.totalTunnels ?? 0}
                icon={Shield}
                variant="default"
              />
              <MetricCard
                title="Active (UP)"
                value={stats?.upTunnels ?? 0}
                icon={CheckCircle}
                variant="success"
                description={stats?.totalTunnels ? `${Math.round(((stats?.upTunnels ?? 0) / stats.totalTunnels) * 100)}% of tunnels` : undefined}
              />
              <MetricCard
                title="Down"
                value={stats?.downTunnels ?? 0}
                icon={XCircle}
                variant="danger"
              />
              <MetricCard
                title="Flapping"
                value={stats?.flappingTunnels ?? 0}
                icon={AlertTriangle}
                variant="warning"
              />
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">VPN Tunnels</h2>
              <p className="text-sm text-muted-foreground">
                {filteredTunnels.length} tunnel{filteredTunnels.length !== 1 ? "s" : ""} 
                {activeFiltersCount > 0 && ` (filtered from ${tunnels.length})`}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => exportTunnelsToCSV(filteredTunnels)}
              disabled={filteredTunnels.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <FiltersPanel
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedFirewall={selectedFirewall}
            onFirewallChange={setSelectedFirewall}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            firewalls={firewalls}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={clearFilters}
          />

          <TunnelTable 
            tunnels={filteredTunnels} 
            isLoading={tunnelsLoading || firewallsLoading} 
          />
        </div>
      </main>

      <FirewallSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        firewalls={firewalls}
        onAddFirewall={async (data) => {
          await addFirewallMutation.mutateAsync(data);
        }}
        onUpdateFirewall={async (id, data) => {
          await updateFirewallMutation.mutateAsync({ id, data });
        }}
        onDeleteFirewall={async (id) => {
          await deleteFirewallMutation.mutateAsync(id);
        }}
      />
    </div>
  );
}
