import { 
  type Firewall, 
  type InsertFirewall, 
  type VPNTunnel, 
  type DashboardStats,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { pollFirewall } from "./paloalto-api";

export interface IStorage {
  getFirewalls(): Promise<Firewall[]>;
  getFirewall(id: string): Promise<Firewall | undefined>;
  createFirewall(firewall: InsertFirewall): Promise<Firewall>;
  updateFirewall(id: string, firewall: Partial<InsertFirewall>): Promise<Firewall | undefined>;
  deleteFirewall(id: string): Promise<boolean>;
  getTunnels(): Promise<VPNTunnel[]>;
  getTunnelsByFirewall(firewallId: string): Promise<VPNTunnel[]>;
  setTunnels(firewallId: string, tunnels: VPNTunnel[]): Promise<void>;
  getStats(): Promise<DashboardStats>;
  refreshAll(): Promise<{ errors: string[] }>;
  refreshFirewall(id: string): Promise<{ success: boolean; error?: string }>;
}

export class MemStorage implements IStorage {
  private firewalls: Map<string, Firewall>;
  private tunnels: Map<string, VPNTunnel[]>;

  constructor() {
    this.firewalls = new Map();
    this.tunnels = new Map();
  }

  async getFirewalls(): Promise<Firewall[]> {
    return Array.from(this.firewalls.values());
  }

  async getFirewall(id: string): Promise<Firewall | undefined> {
    return this.firewalls.get(id);
  }

  async createFirewall(insertFirewall: InsertFirewall): Promise<Firewall> {
    const id = randomUUID();
    const firewall: Firewall = {
      ...insertFirewall,
      id,
      isConnected: false,
      lastPolled: null,
    };
    this.firewalls.set(id, firewall);
    this.tunnels.set(id, []);
    
    this.refreshFirewall(id).catch((err) => {
      console.error(`Initial poll failed for ${firewall.name}:`, err);
    });
    
    return firewall;
  }

  async updateFirewall(id: string, updates: Partial<InsertFirewall>): Promise<Firewall | undefined> {
    const existing = this.firewalls.get(id);
    if (!existing) return undefined;

    const updated: Firewall = {
      ...existing,
      ...updates,
    };
    this.firewalls.set(id, updated);
    return updated;
  }

  async deleteFirewall(id: string): Promise<boolean> {
    const deleted = this.firewalls.delete(id);
    this.tunnels.delete(id);
    return deleted;
  }

  async getTunnels(): Promise<VPNTunnel[]> {
    const allTunnels: VPNTunnel[] = [];
    Array.from(this.tunnels.values()).forEach((tunnelList) => {
      allTunnels.push(...tunnelList);
    });
    return allTunnels;
  }

  async getTunnelsByFirewall(firewallId: string): Promise<VPNTunnel[]> {
    return this.tunnels.get(firewallId) || [];
  }

  async setTunnels(firewallId: string, tunnels: VPNTunnel[]): Promise<void> {
    this.tunnels.set(firewallId, tunnels);
  }

  async getStats(): Promise<DashboardStats> {
    const allTunnels = await this.getTunnels();
    const firewalls = await this.getFirewalls();

    return {
      totalTunnels: allTunnels.length,
      upTunnels: allTunnels.filter((t) => t.ipsecState === "up").length,
      downTunnels: allTunnels.filter((t) => t.ipsecState === "down").length,
      flappingTunnels: allTunnels.filter((t) => t.ipsecState === "flapping").length,
      totalFirewalls: firewalls.length,
      connectedFirewalls: firewalls.filter((f) => f.isConnected).length,
    };
  }

  async refreshFirewall(id: string): Promise<{ success: boolean; error?: string }> {
    const firewall = this.firewalls.get(id);
    if (!firewall) {
      return { success: false, error: "Firewall not found" };
    }

    console.log(`Polling firewall: ${firewall.name} (${firewall.mgmtIp})`);
    
    try {
      const result = await pollFirewall(firewall);
      
      const updatedFirewall: Firewall = {
        ...firewall,
        isConnected: result.isConnected,
        lastPolled: new Date().toISOString(),
      };
      this.firewalls.set(id, updatedFirewall);

      if (result.isConnected) {
        this.tunnels.set(id, result.tunnels);
        console.log(`Successfully polled ${firewall.name}: ${result.tunnels.length} tunnels found`);
        return { success: true };
      } else {
        console.log(`Failed to poll ${firewall.name}: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      const updatedFirewall: Firewall = {
        ...firewall,
        isConnected: false,
        lastPolled: new Date().toISOString(),
      };
      this.firewalls.set(id, updatedFirewall);
      
      console.error(`Error polling firewall ${firewall.name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async refreshAll(): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    const firewallEntries = Array.from(this.firewalls.entries());
    
    for (const [id, firewall] of firewallEntries) {
      const result = await this.refreshFirewall(id);
      if (!result.success && result.error) {
        errors.push(`${firewall.name}: ${result.error}`);
      }
    }

    return { errors };
  }
}

export const storage = new MemStorage();
