import { z } from "zod";

export const tunnelStateEnum = z.enum(["up", "down", "flapping"]);
export type TunnelState = z.infer<typeof tunnelStateEnum>;

export const apiTypeEnum = z.enum(["xml", "rest"]);
export type ApiType = z.infer<typeof apiTypeEnum>;

export const firewallSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  mgmtIp: z.string().min(1, "Management IP/FQDN is required"),
  apiKey: z.string().min(1, "API Key is required"),
  panosVersion: z.string().default("10.1"),
  apiType: apiTypeEnum.default("xml"),
  pollingInterval: z.number().min(10).max(300).default(60),
  isConnected: z.boolean().default(false),
  lastPolled: z.string().nullable().default(null),
});

export const insertFirewallSchema = firewallSchema.omit({ id: true, isConnected: true, lastPolled: true });
export type InsertFirewall = z.infer<typeof insertFirewallSchema>;
export type Firewall = z.infer<typeof firewallSchema>;

export const vpnTunnelSchema = z.object({
  id: z.string(),
  firewallId: z.string(),
  firewallName: z.string(),
  tunnelName: z.string(),
  peerIp: z.string(),
  ipsecState: tunnelStateEnum,
  ikeState: tunnelStateEnum,
  // Phase 1 (IKE) Parameters
  phase1Encryption: z.string(),
  phase1Authentication: z.string(),
  phase1DhGroup: z.string(),
  phase1Lifetime: z.string(),
  // Phase 2 (IPSec) Parameters
  phase2Encryption: z.string(),
  phase2Authentication: z.string(),
  phase2DhGroup: z.string(),
  phase2Lifetime: z.string(),
  phase2Pfs: z.string(),
  // Legacy fields for backward compatibility
  encryption: z.string(),
  authentication: z.string(),
  bytesIn: z.number(),
  bytesOut: z.number(),
  rekeyTimer: z.number().nullable(),
  lastStateChange: z.string().nullable(),
  lastChecked: z.string(),
});

export type VPNTunnel = z.infer<typeof vpnTunnelSchema>;

export const dashboardStatsSchema = z.object({
  totalTunnels: z.number(),
  upTunnels: z.number(),
  downTunnels: z.number(),
  flappingTunnels: z.number(),
  totalFirewalls: z.number(),
  connectedFirewalls: z.number(),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
