import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CopilotService, CopilotResponse } from './copilot.service';

@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('query')
  async queryCopilot(
    @Body('prompt') prompt: string,
    @Body('userRole') userRole?: string,
  ): Promise<CopilotResponse> {
    if (!prompt || typeof prompt !== 'string') {
      return {
        answer: '🤖 Veuillez fournir une question valide.',
      };
    }
    return this.copilotService.processQuery(prompt, userRole || 'manager');
  }

  /**
   * Streaming endpoint — Server-Sent Events
   * POST /copilot/stream
   * Streams tokens word by word from Cloudflare Workers AI
   */
  @Post('stream')
  async streamCopilot(
    @Body('prompt') prompt: string,
    @Body('userRole') userRole: string = 'manager',
    @Res() res: Response,
  ): Promise<void> {
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Invalid prompt' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.flushHeaders();

    await this.copilotService.streamQuery(prompt, userRole, res);
  }
}
