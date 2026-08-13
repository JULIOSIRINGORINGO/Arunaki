import {
  Controller,
  Get,
  Post,
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
      const masked = items.map((item: any) => ({
        ...item,
        apiKey: item.apiKey ? `${item.apiKey.substring(0, 8)}...` : '',
      }));
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
      return successResponse({
        ...item,
        apiKey: (item as any).apiKey
          ? `${(item as any).apiKey.substring(0, 8)}...`
          : '',
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
      return successResponse({
        ...item,
        apiKey: `${item.apiKey.substring(0, 8)}...`,
      });
    } catch (error: any) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

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
      const item = await this.providerService.updateProvider(id, body);
      return successResponse({
        ...item,
        apiKey: item.apiKey ? `${item.apiKey.substring(0, 8)}...` : '',
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
          messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
          max_tokens: 10,
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
      const reply = data.choices?.[0]?.message?.content || '';

      return successResponse({
        success: true,
        status: response.status,
        reply: reply.substring(0, 100),
        model: data.model,
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
        model: p.model,
      });
    } catch (error: any) {
      return errorResponse('TEST_FAILED', error.message);
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
