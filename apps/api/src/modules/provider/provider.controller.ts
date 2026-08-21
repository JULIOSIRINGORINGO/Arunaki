import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ProviderService } from './provider.service.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';

@Controller('providers')
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Get()
  async findAll() {
    try {
      const items = await this.providerService.findAll();
      // Mask API keys in response
      const masked = items.map((item: any) => {
        const decrypted = this.providerService.decryptApiKey(item.apiKey);
        return {
          ...item,
          apiKey: decrypted ? `${decrypted.substring(0, 8)}...` : '',
        };
      });
      return successResponse(masked);
    } catch (error: any) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('active')
  async findActive() {
    try {
      const item = await this.providerService.getActiveConfig();
      if (!item) {
        return successResponse(null);
      }
      return successResponse({
        ...item,
        apiKey: item.apiKey ? `${item.apiKey.substring(0, 8)}...` : '',
      });
    } catch (error: any) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('active/full')
  async findActiveFull() {
    // Internal use only — returns full config including API key
    try {
      const item = await this.providerService.getActiveConfig();
      return successResponse(item);
    } catch (error: any) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const item = await this.providerService.findById(id);
      if (!item) {
        return errorResponse('NOT_FOUND', 'Provider not found');
      }
      const decrypted = this.providerService.decryptApiKey(
        (item as any).apiKey,
      );
      return successResponse({
        ...item,
        apiKey: decrypted ? `${decrypted.substring(0, 8)}...` : '',
      });
    } catch (error: any) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      type: string;
      baseUrl: string;
      apiKey: string;
      model: string;
      headerPrefix?: string;
      headerTitle?: string;
      active?: boolean;
    },
  ) {
    try {
      if (!body.name || !body.baseUrl || !body.apiKey || !body.model) {
        return errorResponse(
          'VALIDATION_FAILED',
          'name, baseUrl, apiKey, and model are required',
        );
      }

      const item = await this.providerService.createProvider(body);
      const decrypted = this.providerService.decryptApiKey(item.apiKey);
      return successResponse({
        ...item,
        apiKey: decrypted ? `${decrypted.substring(0, 8)}...` : '',
      });
    } catch (error: any) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Put(':id')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      type?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      headerPrefix?: string;
      headerTitle?: string;
    },
  ) {
    try {
      if (body.apiKey && body.apiKey.includes('...')) {
        delete body.apiKey;
      }
      const item = await this.providerService.updateProvider(id, body);
      const decrypted = this.providerService.decryptApiKey(item.apiKey);
      return successResponse({
        ...item,
        apiKey: decrypted ? `${decrypted.substring(0, 8)}...` : '',
      });
    } catch (error: any) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    try {
      await this.providerService.setActive(id);
      return successResponse({ activated: true });
    } catch (error: any) {
      return errorResponse('ACTIVATE_FAILED', error.message);
    }
  }

  @Post('test')
  async testConnection(
    @Body()
    body: {
      baseUrl: string;
      apiKey: string;
      model: string;
    },
  ) {
    try {
      if (!body.baseUrl || !body.model) {
        return errorResponse(
          'VALIDATION_FAILED',
          'baseUrl and model are required',
        );
      }

      const url = `${body.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: body.apiKey ? `Bearer ${body.apiKey}` : '',
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://arunaki.app',
          'X-Title': 'Arunaki Connection Test',
        },
        body: JSON.stringify({
          model: body.model,
          messages: [{ role: 'user', content: 'Ping test. Reply with: PONG' }],
          max_tokens: 64,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return successResponse({
          success: false,
          status: response.status,
          error: errorText.substring(0, 200),
        });
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      let reply = (message?.content || '').trim();
      if (!reply && message?.reasoning_content) {
        reply = message.reasoning_content.trim();
      }
      if (!reply && data.choices?.[0]?.text) {
        reply = data.choices[0].text.trim();
      }
      if (!reply) {
        reply = 'PONG';
      }

      // Clean think tags if model outputs raw XML thinking
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || reply;

      return successResponse({
        success: true,
        status: response.status,
        reply: reply.substring(0, 150),
        model: data.model || body.model,
      });
    } catch (error: any) {
      return successResponse({
        success: false,
        error: error.message,
      });
    }
  }

  @Post(':id/test')
  async testProviderById(@Param('id') id: string) {
    try {
      const p = await this.providerService.getById(id);
      if (!p) {
        return errorResponse('NOT_FOUND', 'Provider not found');
      }
      return this.testConnection({
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        model: p.model ? p.model.split(',')[0].trim() : '',
      });
    } catch (error: any) {
      return errorResponse('TEST_FAILED', error.message);
    }
  }

  @Post('fetch-models')
  async fetchModelsFromApi(
    @Body()
    body: {
      baseUrl: string;
      apiKey?: string;
    },
  ) {
    try {
      if (!body.baseUrl) {
        return errorResponse('VALIDATION_FAILED', 'baseUrl is required');
      }

      const url = `${body.baseUrl.replace(/\/$/, '')}/models`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: body.apiKey ? `Bearer ${body.apiKey}` : '',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errText = await response.text();
        return errorResponse(
          'FETCH_MODELS_FAILED',
          `HTTP ${response.status}: ${errText.substring(0, 150)}`,
        );
      }

      const data = await response.json();
      let models: string[] = [];

      if (Array.isArray(data.data)) {
        models = data.data
          .map((m: any) =>
            typeof m === 'string' ? m : m.id || m.name || m.model,
          )
          .filter(Boolean);
      } else if (Array.isArray(data.models)) {
        models = data.models
          .map((m: any) =>
            typeof m === 'string' ? m : m.id || m.name || m.model,
          )
          .filter(Boolean);
      } else if (Array.isArray(data)) {
        models = data
          .map((m: any) =>
            typeof m === 'string' ? m : m.id || m.name || m.model,
          )
          .filter(Boolean);
      }

      return successResponse({ models });
    } catch (error: any) {
      return errorResponse('FETCH_MODELS_FAILED', error.message);
    }
  }

  @Post(':id/fetch-models')
  async fetchModelsById(@Param('id') id: string) {
    try {
      const p = await this.providerService.getById(id);
      if (!p) {
        return errorResponse('NOT_FOUND', 'Provider not found');
      }
      return this.fetchModelsFromApi({
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
      });
    } catch (error: any) {
      return errorResponse('FETCH_MODELS_FAILED', error.message);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      // Don't allow deleting the active provider
      const item = await this.providerService.findById(id);
      if ((item as any)?.active) {
        return errorResponse(
          'DELETE_FAILED',
          'Cannot delete the active provider. Activate another provider first.',
        );
      }

      await this.providerService.delete(id);
      return successResponse({ deleted: true });
    } catch (error: any) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }
}
