import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './route';
import { DEFAULT_PERSONAS } from '../../../domain/models/personas';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof fs>();
  return {
    ...original,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('Personas API Route', () => {
  const mockWorkspace = '/mock/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKSPACE_PATH = mockWorkspace;
  });

  afterEach(() => {
    delete process.env.WORKSPACE_PATH;
  });

  describe('GET /api/personas', () => {
    it('returns DEFAULT_PERSONAS when config file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(DEFAULT_PERSONAS);
    });

    it('returns parsed config when file exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const customConfig = [{ id: 'qa', label: 'Custom QA', command: 'test', enabled: true }];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(customConfig));

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(customConfig);
    });

    it('returns 500 when an exception is thrown', async () => {
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const res = await GET();
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Read error');
    });
  });

  describe('POST /api/personas', () => {
    it('returns 400 when body is not an array', async () => {
      const req = new Request('http://localhost/api/personas', {
        method: 'POST',
        body: JSON.stringify({ notAnArray: true })
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Body must be an array of persona configs');
    });

    it('creates specify directory and writes config successfully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const customConfig = [{ id: 'qa', label: 'Custom QA', command: 'test', enabled: true }];

      const req = new Request('http://localhost/api/personas', {
        method: 'POST',
        body: JSON.stringify(customConfig)
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.personas).toEqual(customConfig);

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(mockWorkspace, '.specify'), { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockWorkspace, '.specify', 'personas-config.json'),
        JSON.stringify(customConfig, null, 2),
        'utf-8'
      );
    });

    it('returns 500 when write throws error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const customConfig = [{ id: 'qa', label: 'Custom QA', command: 'test', enabled: true }];
      const req = new Request('http://localhost/api/personas', {
        method: 'POST',
        body: JSON.stringify(customConfig)
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Write error');
    });
  });
});
