import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Firewall, InsertFirewall, VPNTunnel, DashboardStats } from "@shared/schema";
import { pollFirewall } from "./paloalto-api";
import type { IStorage } from "./storage";

interface PersistedData {
  firewalls: Record<string, Firewall>;
}

export class FileStorage implements IStorage {
  private dataFile: string;
  private firewalls: Map<string, Firewall>;
  private tunnels: Map<string, VPNTunnel[]>;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.dataFile = join(dataDir, "firewalls.json");
    this.firewalls = new Map();
    this.tunnels = new Map();
    this.load();
  }

  private load(): void {
    if (!existsSync(this.dataFile)) return;
    try {
      const raw = readFileSync(this.dataFile, "utf-8");
      const data: PersistedData = JSON.parse(raw);
      for (const [id, fw] of Object.entries(data.firewalls || {})) {
        this.firewalls.set(id, fw);
        this.tunnels.set(id, []);
      }
      console.log(`[FileStorage] Loaded ${this.firewalls.size} firewall(s) from ${this.dataFile}`);
    } catch (err) {
      console.error("[FileStorage] Failed to load data file:", err);
    }
  }

  private save(): void {
    try {
      const data: PersistedData = {
        firewalls: Object.fromEntries(this.firewalls),
      };
      writeFileSync(this.dataFile, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("[FileStorage] Failed to save data file:", err);
    }
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
    this.save();

    this.refreshFirewall(id).catch((err) => {
      console.error(`Initial poll failed for ${firewall.name}:`, err);
    });

    return firewall;
  }

  async updateFirewall(id: string, updates: Partial<InsertFirewall>): Promise<Firewall | undefined> {
    const existing = this.firewalls.get(id);
    if (!existing) return undefined;
    const updated: Firewall = { ...existing, ...updates };
    this.firewalls.set(id, updated);
    this.save();
    return updated;
  }

  async deleteFirewall(id: string): Promise<boolean> {
    const deleted = this.firewalls.delete(id);
    this.tunnels.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  async getTunnels(): Promise<VPNTunnel[]> {
    const all: VPNTunnel[] = [];
    for (const list of this.tunnels.values()) all.push(...list);
    return all;
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
    if (!firewall) return { success: false, error: "Firewall not found" };

    console.log(`Polling firewall: ${firewall.name} (${firewall.mgmtIp})`);
    try {
      const result = await pollFirewall(firewall);
      const updated: Firewall = {
        ...firewall,
        isConnected: result.isConnected,
        lastPolled: new Date().toISOString(),
      };
      this.firewalls.set(id, updated);
      this.save();

      if (result.isConnected) {
        this.tunnels.set(id, result.tunnels);
        console.log(`Successfully polled ${firewall.name}: ${result.tunnels.length} tunnels found`);
        return { success: true };
      } else {
        console.log(`Failed to poll ${firewall.name}: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      const updated: Firewall = {
        ...firewall,
        isConnected: false,
        lastPolled: new Date().toISOString(),
      };
      this.firewalls.set(id, updated);
      this.save();
      console.error(`Error polling firewall ${firewall.name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async refreshAll(): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    for (const [id, firewall] of this.firewalls.entries()) {
      const result = await this.refreshFirewall(id);
      if (!result.success && result.error) {
        errors.push(`${firewall.name}: ${result.error}`);
      }
    }
    return { errors };
  }
}
