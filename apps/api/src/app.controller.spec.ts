import { describe, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('returns a healthy API response', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const response = new AppController().health();

    expect(response.data?.status).toBe('ok');
    expect(response.error).toBeNull();
    await module.close();
  });
});
