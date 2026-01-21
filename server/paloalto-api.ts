import type { Firewall, VPNTunnel, TunnelState } from "@shared/schema";
import { randomUUID } from "crypto";

interface IKEGatewayEntry {
  name: string;
  "peer-address"?: string;
  "local-address"?: string;
  "ike-version"?: string;
  status?: string;
  // Phase 1 parameters
  encryption?: string;
  authentication?: string;
  dhGroup?: string;
  lifetime?: string;
}

interface IPSecTunnelEntry {
  name: string;
  state: string;
  "peer-ip"?: string;
  "local-spi"?: string;
  "remote-spi"?: string;
  "enc-algo"?: string;
  "auth-algo"?: string;
  "life-time"?: string;
  "life-remain"?: string;
  "encap"?: string;
  gateway?: string;
  // Phase 2 parameters
  dhGroup?: string;
  pfs?: string;
  // Traffic counters
  bytesIn?: number;
  bytesOut?: number;
}

export class PaloAltoAPIClient {
  private firewall: Firewall;
  private baseUrl: string;

  constructor(firewall: Firewall) {
    this.firewall = firewall;
    this.baseUrl = `https://${firewall.mgmtIp}/api/`;
  }

  private async makeRequest(cmd: string): Promise<string> {
    const params = new URLSearchParams({
      type: "op",
      cmd: cmd,
      key: this.firewall.apiKey,
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/xml",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Connection timeout - firewall did not respond within 30 seconds");
      }
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const cmd = "<show><system><info></info></system></show>";
      const response = await this.makeRequest(cmd);
      return response.includes('status="success"');
    } catch (error) {
      console.error(`Connection test failed for ${this.firewall.name}:`, error);
      return false;
    }
  }

  async getIPSecTunnels(): Promise<VPNTunnel[]> {
    const tunnels: VPNTunnel[] = [];

    try {
      const ipsecCmd = "<show><vpn><ipsec-sa></ipsec-sa></vpn></show>";
      const ipsecResponse = await this.makeRequest(ipsecCmd);

      const ikeCmd = "<show><vpn><ike-sa></ike-sa></vpn></show>";
      const ikeResponse = await this.makeRequest(ikeCmd);

      console.log(`[DEBUG] IPSec SA Response (first 2000 chars):`, ipsecResponse.substring(0, 2000));
      console.log(`[DEBUG] IKE SA Response (first 2000 chars):`, ikeResponse.substring(0, 2000));
      
      const ipsecEntries = this.parseIPSecSA(ipsecResponse);
      const ikeEntries = this.parseIKESA(ikeResponse);
      
      console.log(`[DEBUG] Parsed ${ipsecEntries.length} IPSec entries, ${ikeEntries.length} IKE entries`);
      if (ipsecEntries.length > 0) {
        console.log(`[DEBUG] First IPSec entry:`, JSON.stringify(ipsecEntries[0]));
      }
      if (ikeEntries.length > 0) {
        console.log(`[DEBUG] First IKE entry:`, JSON.stringify(ikeEntries[0]));
      }

      // Build IKE map - key is gateway name, value has peer-address (the REAL peer IP)
      const ikeMap = new Map<string, IKEGatewayEntry>();
      ikeEntries.forEach((entry) => {
        ikeMap.set(entry.name, entry);
        console.log(`[DEBUG] IKE entry: name=${entry.name}, peer-address=${entry["peer-address"]}`);
      });

      // Aggregate IPSec entries by gateway (one row per VPN tunnel, not per ProxyID)
      const gatewayMap = new Map<string, IPSecTunnelEntry>();
      for (const ipsec of ipsecEntries) {
        const gatewayName = ipsec.gateway || ipsec.name.split(":")[0] || ipsec.name;
        // Keep first entry for each unique gateway
        if (!gatewayMap.has(gatewayName)) {
          gatewayMap.set(gatewayName, ipsec);
        }
      }
      
      console.log(`[DEBUG] Processing ${gatewayMap.size} unique gateways from ${ipsecEntries.length} IPSec entries`);
      
      Array.from(gatewayMap.entries()).forEach(([gatewayName, ipsec]) => {
        // Get IKE entry for additional info
        const ikeEntry = ikeMap.get(gatewayName);
        
        // Use peer IP from IPSec-SA <remote> field, fallback to IKE-SA or gateway name extraction
        let peerIp = ipsec["peer-ip"] || ikeEntry?.["peer-address"];
        
        // If still no peer IP, try to extract from gateway name
        if (!peerIp) {
          const ipMatch = gatewayName.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          peerIp = ipMatch ? ipMatch[1] : "unknown";
        }

        // If entry exists in ipsec-sa response, it's UP
        const ipsecState = this.mapState(ipsec.state);
        const ikeState = ikeEntry ? this.mapState(ikeEntry.status || "active") : ipsecState;

        // Phase 1 from IKE-SA, fallback to IPSec-SA values (same encryption often used)
        const phase1Enc = ikeEntry?.encryption || ipsec["enc-algo"] || "unknown";
        const phase1Auth = ikeEntry?.authentication || ipsec["auth-algo"] || "unknown";
        const phase1Dh = ikeEntry?.dhGroup || ipsec.dhGroup || "unknown";
        const phase1Life = ikeEntry?.lifetime || "unknown";

        const tunnel: VPNTunnel = {
          id: randomUUID(),
          firewallId: this.firewall.id,
          firewallName: this.firewall.name,
          tunnelName: gatewayName,
          peerIp: peerIp,
          ipsecState: ipsecState,
          ikeState: ikeState,
          // Phase 1 (IKE) parameters - from IKE-SA or fallback to IPSec-SA
          phase1Encryption: phase1Enc,
          phase1Authentication: phase1Auth,
          phase1DhGroup: phase1Dh,
          phase1Lifetime: phase1Life,
          // Phase 2 (IPSec) parameters from IPSec-SA
          phase2Encryption: ipsec["enc-algo"] || "unknown",
          phase2Authentication: ipsec["auth-algo"] || "unknown",
          phase2DhGroup: ipsec.dhGroup || "no-pfs",
          phase2Lifetime: ipsec["life-time"] || "unknown",
          phase2Pfs: ipsec.pfs || "Disabled",
          // Legacy fields
          encryption: ipsec["enc-algo"] || "unknown",
          authentication: ipsec["auth-algo"] || "unknown",
          bytesIn: ipsec.bytesIn || 0,
          bytesOut: ipsec.bytesOut || 0,
          rekeyTimer: ipsec["life-remain"] ? parseInt(ipsec["life-remain"], 10) : null,
          lastStateChange: ipsecState !== "up" ? new Date().toISOString() : null,
          lastChecked: new Date().toISOString(),
        };

        console.log(`[DEBUG] Created tunnel: ${tunnel.tunnelName}, peer: ${tunnel.peerIp}, P1: ${tunnel.phase1Encryption}/${tunnel.phase1Authentication}, P2: ${tunnel.phase2Encryption}/${tunnel.phase2Authentication}`);
        tunnels.push(tunnel);
      });

    } catch (error) {
      console.error(`Failed to fetch IPSec tunnels from ${this.firewall.name}:`, error);
      throw error;
    }

    return tunnels;
  }

  private parseIPSecSA(xml: string): IPSecTunnelEntry[] {
    const entries: IPSecTunnelEntry[] = [];
    
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      
      // Palo Alto actual field names: remote, enc, hash, remain, gateway, name, life
      const name = this.extractValue(entryXml, "name") || this.extractAttribute(match[0], "name") || `tunnel-${entries.length + 1}`;
      const remote = this.extractValue(entryXml, "remote")?.trim();
      const gateway = this.extractValue(entryXml, "gateway");
      const enc = this.extractValue(entryXml, "enc");
      const hash = this.extractValue(entryXml, "hash");
      const life = this.extractValue(entryXml, "life");
      const remain = this.extractValue(entryXml, "remain");
      
      // Parse traffic counters
      const bytesInStr = this.extractValue(entryXml, "inbytes") || this.extractValue(entryXml, "bytes-in") || this.extractValue(entryXml, "encap-bytes");
      const bytesOutStr = this.extractValue(entryXml, "outbytes") || this.extractValue(entryXml, "bytes-out") || this.extractValue(entryXml, "decap-bytes");
      
      // Parse Phase 2 specific fields
      const dhGroup = this.extractValue(entryXml, "dhgrp") || this.extractValue(entryXml, "dh-group") || this.extractValue(entryXml, "pfs-dh-group");
      const pfs = this.extractValue(entryXml, "pfs") || (dhGroup && dhGroup !== "no-pfs" ? "Enabled" : "Disabled");
      
      // If entry exists in ipsec-sa response, tunnel is UP
      const entry: IPSecTunnelEntry = {
        name: name,
        state: "active", // Present in ipsec-sa means it's up
        "peer-ip": remote,
        "enc-algo": enc,
        "auth-algo": hash,
        "life-remain": remain,
        "life-time": life ? `${life}s` : (remain ? `${remain}s remaining` : undefined),
        gateway: gateway,
        dhGroup: dhGroup,
        pfs: pfs,
        bytesIn: bytesInStr ? parseInt(bytesInStr, 10) : 0,
        bytesOut: bytesOutStr ? parseInt(bytesOutStr, 10) : 0,
      };

      console.log(`[DEBUG] Parsed IPSec entry: name=${entry.name}, gateway=${entry.gateway}, remote=${entry["peer-ip"]}, enc=${entry["enc-algo"]}, hash=${entry["auth-algo"]}, life=${entry["life-time"]}`);
      
      entries.push(entry);
    }

    return entries;
  }

  private parseIKESA(xml: string): IKEGatewayEntry[] {
    const entries: IKEGatewayEntry[] = [];
    
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      
      const name = this.extractValue(entryXml, "name") || this.extractAttribute(match[0], "name") || `gateway-${entries.length + 1}`;
      
      // Try to extract peer IP from various fields or from gateway name pattern
      let peerAddress = this.extractValue(entryXml, "peer-address") 
        || this.extractValue(entryXml, "peer-ip")
        || this.extractValue(entryXml, "peer")
        || this.extractValue(entryXml, "peeraddress")
        || this.extractValue(entryXml, "remote");
      
      // If no peer address found, try to extract IP from gateway name (e.g., "Gateway-Medi-204.246.139.254")
      if (!peerAddress) {
        const ipMatch = name.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch) {
          peerAddress = ipMatch[1];
        }
      }

      // Parse Phase 1 parameters - try multiple possible locations
      // Fields might be nested inside <algo> or directly under <entry>
      const algoBlock = this.extractBlock(entryXml, "algo") || entryXml;
      
      const entry: IKEGatewayEntry = {
        name: name,
        "peer-address": peerAddress,
        status: this.extractValue(entryXml, "status") || this.extractValue(entryXml, "state") || "active",
        // Phase 1 (IKE) parameters - check algo block first, then entry level
        encryption: this.extractValue(algoBlock, "enc") || this.extractValue(algoBlock, "encr") || this.extractValue(entryXml, "enc") || this.extractValue(entryXml, "encryption"),
        authentication: this.extractValue(algoBlock, "hash") || this.extractValue(algoBlock, "auth") || this.extractValue(entryXml, "hash") || this.extractValue(entryXml, "authentication"),
        dhGroup: this.extractValue(algoBlock, "dhgrp") || this.extractValue(algoBlock, "dh") || this.extractValue(entryXml, "dhgrp") || this.extractValue(entryXml, "dh-group") || this.extractValue(entryXml, "group"),
        lifetime: this.extractValue(entryXml, "life") || this.extractValue(entryXml, "lifetime") || this.extractValue(entryXml, "ikelifetime") || this.extractValue(entryXml, "expires"),
      };

      console.log(`[DEBUG] Parsed IKE entry: name=${entry.name}, peer=${entry["peer-address"]}, enc=${entry.encryption}, auth=${entry.authentication}, dh=${entry.dhGroup}, life=${entry.lifetime}`);
      entries.push(entry);
    }

    return entries;
  }

  private extractBlock(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
    const match = xml.match(regex);
    return match ? match[1] : undefined;
  }

  private extractValue(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, "i");
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private extractAttribute(xml: string, attrName: string): string | undefined {
    const regex = new RegExp(`${attrName}="([^"]*)"`, "i");
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private isProxyIdEntry(tunnelName: string): boolean {
    // Filter out Proxy ID entries (encryption domains)
    // These have patterns like: :ProxyID, -ProxyID, Proxy, :PID
    const lowerName = tunnelName.toLowerCase();
    
    // Check for common proxy patterns
    if (lowerName.includes("proxy")) return true;
    if (lowerName.includes(":pid")) return true;
    if (/:p\d+$/i.test(tunnelName)) return true;  // Ends with :P followed by numbers
    if (/pid\d+$/i.test(tunnelName)) return true;  // Ends with PID followed by numbers
    if (/:\d+\.\d+\.\d+\.\d+/.test(tunnelName)) return true;  // Contains IP address pattern
    
    return false;
  }

  private mapState(state: string): TunnelState {
    const normalizedState = state.toLowerCase().trim();
    
    console.log(`[DEBUG] Mapping state: "${state}" -> normalized: "${normalizedState}"`);
    
    const upStates = [
      "active", "up", "established", "init", "tunnel-up", 
      "1", "true", "yes", "connected", "ipsec-sa-up", "phase2-up"
    ];
    
    if (upStates.includes(normalizedState) || normalizedState.includes("active") || normalizedState.includes("establish")) {
      return "up";
    }
    
    const downStates = [
      "inactive", "down", "disconnected", "error", "tunnel-down",
      "0", "false", "no", "not-connected", "phase2-down"
    ];
    
    if (downStates.includes(normalizedState) || normalizedState.includes("down") || normalizedState.includes("error")) {
      return "down";
    }

    if (normalizedState === "flapping" || normalizedState === "unstable" || normalizedState === "negotiating" || normalizedState === "pending") {
      return "flapping";
    }

    console.log(`[DEBUG] Unknown state "${state}" - defaulting to down`);
    return "down";
  }
}

export async function pollFirewall(firewall: Firewall): Promise<{ 
  isConnected: boolean; 
  tunnels: VPNTunnel[];
  error?: string;
}> {
  const client = new PaloAltoAPIClient(firewall);
  
  try {
    const isConnected = await client.testConnection();
    
    if (!isConnected) {
      return { 
        isConnected: false, 
        tunnels: [],
        error: "Failed to connect to firewall - check IP address and API key"
      };
    }

    const tunnels = await client.getIPSecTunnels();
    
    return { isConnected: true, tunnels };
  } catch (error: any) {
    console.error(`Error polling firewall ${firewall.name}:`, error.message);
    return { 
      isConnected: false, 
      tunnels: [],
      error: error.message || "Unknown error occurred"
    };
  }
}
