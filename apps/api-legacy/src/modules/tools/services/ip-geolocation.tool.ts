import { Injectable, Logger } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

/**
 * IpGeolocationTool — detects the user's city from their network IP.
 * General read-only lookup; the LLM uses the city for location-aware browsing
 * (e.g. appending ?location=City when querying stock on retail sites).
 */
@Injectable()
export class IpGeolocationTool implements Tool {
  private readonly logger = new Logger(IpGeolocationTool.name);

  get name(): string {
    return 'ip_geolocation';
  }

  get displayName(): string {
    return 'IP Geolocation';
  }

  get capability() {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      tags: ['geo', 'ip', 'location', 'city'],
      inputSchema: {},
      outputType: 'text' as const,
      estimatedLatency: 'fast' as const,
    };
  }

  get description(): string {
    return "Detects the user's current city and region from their network IP. Use before browsing location-aware sites (e.g. stock availability per city) so the location follows the user's network.";
  }

  get definition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    };
  }

  get isMutating(): boolean {
    return false;
  }

  get timeoutMs(): number {
    return 15000;
  }

  async execute(): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        'http://ip-api.com/json/?fields=query,city,regionName,region,country,countryCode,isp,lat,lon',
        {
          headers: { 'User-Agent': 'Arunaki/1.0' },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        throw new Error(`ip-api responded ${response.status}`);
      }
      const data = await response.json();
      if (data.status !== 'success' || !data.city) {
        throw new Error('Could not determine city from IP.');
      }
      return {
        status: 'success',
        data,
        preview: `Location from IP ${data.query}: ${data.city}, ${data.regionName} (${data.country}).`,
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (err: any) {
      this.logger.error(`[IpGeolocation] ${err.message}`);
      return {
        status: 'error',
        data: {},
        preview: `IP geolocation failed: ${err.message}`,
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
        error: { code: 'GEO_FAILED', message: err.message },
      };
    }
  }
}
