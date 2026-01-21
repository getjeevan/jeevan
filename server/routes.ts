import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFirewallSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/tunnels", async (req, res) => {
    try {
      const tunnels = await storage.getTunnels();
      res.json(tunnels);
    } catch (error) {
      console.error("Error fetching tunnels:", error);
      res.status(500).json({ error: "Failed to fetch tunnels" });
    }
  });

  app.get("/api/firewalls", async (req, res) => {
    try {
      const firewalls = await storage.getFirewalls();
      const sanitizedFirewalls = firewalls.map(({ apiKey, ...rest }) => ({
        ...rest,
        apiKey: "••••••••",
      }));
      res.json(sanitizedFirewalls);
    } catch (error) {
      console.error("Error fetching firewalls:", error);
      res.status(500).json({ error: "Failed to fetch firewalls" });
    }
  });

  app.get("/api/firewalls/:id", async (req, res) => {
    try {
      const firewall = await storage.getFirewall(req.params.id);
      if (!firewall) {
        return res.status(404).json({ error: "Firewall not found" });
      }
      const { apiKey, ...sanitized } = firewall;
      res.json({ ...sanitized, apiKey: "••••••••" });
    } catch (error) {
      console.error("Error fetching firewall:", error);
      res.status(500).json({ error: "Failed to fetch firewall" });
    }
  });

  app.post("/api/firewalls", async (req, res) => {
    try {
      const parsed = insertFirewallSchema.parse(req.body);
      const firewall = await storage.createFirewall(parsed);
      const { apiKey, ...sanitized } = firewall;
      res.status(201).json({ ...sanitized, apiKey: "••••••••" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request body", details: error.errors });
      }
      console.error("Error creating firewall:", error);
      res.status(500).json({ error: "Failed to create firewall" });
    }
  });

  app.patch("/api/firewalls/:id", async (req, res) => {
    try {
      const partialSchema = insertFirewallSchema.partial();
      const parsed = partialSchema.parse(req.body);
      
      if (parsed.apiKey === "••••••••" || parsed.apiKey === "") {
        delete parsed.apiKey;
      }
      
      const firewall = await storage.updateFirewall(req.params.id, parsed);
      if (!firewall) {
        return res.status(404).json({ error: "Firewall not found" });
      }
      const { apiKey, ...sanitized } = firewall;
      res.json({ ...sanitized, apiKey: "••••••••" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request body", details: error.errors });
      }
      console.error("Error updating firewall:", error);
      res.status(500).json({ error: "Failed to update firewall" });
    }
  });

  app.delete("/api/firewalls/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFirewall(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Firewall not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting firewall:", error);
      res.status(500).json({ error: "Failed to delete firewall" });
    }
  });

  app.post("/api/refresh", async (req, res) => {
    try {
      const result = await storage.refreshAll();
      const stats = await storage.getStats();
      res.json({ success: true, stats, errors: result.errors });
    } catch (error) {
      console.error("Error refreshing data:", error);
      res.status(500).json({ error: "Failed to refresh data" });
    }
  });

  app.get("/api/tunnels/firewall/:firewallId", async (req, res) => {
    try {
      const tunnels = await storage.getTunnelsByFirewall(req.params.firewallId);
      res.json(tunnels);
    } catch (error) {
      console.error("Error fetching tunnels by firewall:", error);
      res.status(500).json({ error: "Failed to fetch tunnels" });
    }
  });

  return httpServer;
}
