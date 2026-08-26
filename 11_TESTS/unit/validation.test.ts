import { describe, it, expect } from 'vitest';
import {
  CreateProfileDTOSchema,
  UpdateProfileDTOSchema,
  CloneProfileDTOSchema,
  CreateProxyDTOSchema,
  AutomationWorkflowSchema,
} from '../../10_CONFIG/shared/validation/schemas.js';

describe('Zod Validation Schemas', () => {
  it('should validate valid CreateProfileDTO', () => {
    const input = {
      name: 'Valid Profile Name',
      folder: 'Work',
      tags: ['QA', 'Test'],
    };
    const parsed = CreateProfileDTOSchema.parse(input);
    expect(parsed.name).toBe('Valid Profile Name');
    expect(parsed.folder).toBe('Work');
  });

  it('should reject invalid CreateProfileDTO with empty name', () => {
    const input = {
      name: '',
    };
    expect(() => CreateProfileDTOSchema.parse(input)).toThrow();
  });

  it('should validate valid CreateProxyDTO', () => {
    const input = {
      name: 'Residential Proxy',
      protocol: 'socks5' as const,
      host: '127.0.0.1',
      port: 1080,
    };
    const parsed = CreateProxyDTOSchema.parse(input);
    expect(parsed.port).toBe(1080);
    expect(parsed.protocol).toBe('socks5');
  });

  it('should reject invalid proxy port out of range', () => {
    const input = {
      name: 'Invalid Proxy',
      protocol: 'http' as const,
      host: 'localhost',
      port: 999999,
    };
    expect(() => CreateProxyDTOSchema.parse(input)).toThrow();
  });

  it('should validate valid AutomationWorkflowSchema', () => {
    const input = {
      name: 'Test Login Flow',
      steps: [
        {
          id: 'step_1',
          order: 0,
          type: 'OPEN_URL' as const,
          target: 'https://www.google.com',
        },
        {
          id: 'step_2',
          order: 1,
          type: 'WAIT' as const,
          value: '1000',
        },
      ],
    };
    const parsed = AutomationWorkflowSchema.parse(input);
    expect(parsed.steps).toHaveLength(2);
  });
});
