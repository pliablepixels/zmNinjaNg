import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDaemonCheck, getDiskPercent, getLoad, getServers, getStorages } from '../server';
import { getApiClient } from '../client';
import { validateApiResponse } from '../../lib/api-validator';
import type { ApiClient } from '../client';

const mockGet = vi.fn();

vi.mock('../client', () => ({
  getApiClient: vi.fn(),
}));

vi.mock('../../lib/api-validator', () => ({
  validateApiResponse: vi.fn((_, data) => data),
}));

describe('Server API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiClient).mockReturnValue({
      get: mockGet,
    } as unknown as ApiClient);
  });

  it('returns server list', async () => {
    mockGet.mockResolvedValue({
      data: {
        servers: [{ Server: { Id: '1', Name: 'Main' } }],
      },
    });

    const servers = await getServers();

    expect(mockGet).toHaveBeenCalledWith('/servers.json');
    expect(validateApiResponse).toHaveBeenCalled();
    expect(servers).toEqual([{ Id: '1', Name: 'Main' }]);
  });

  it('checks daemon state', async () => {
    mockGet.mockResolvedValue({
      data: { result: 1 },
    });

    const isRunning = await getDaemonCheck();

    expect(mockGet).toHaveBeenCalledWith('/host/daemonCheck.json', undefined);
    expect(isRunning).toBe(true);
  });

  it('normalizes load value', async () => {
    mockGet.mockResolvedValue({
      data: { load: [1.2, 0.8, 0.5] },
    });

    const load = await getLoad();

    expect(mockGet).toHaveBeenCalledWith('/host/getLoad.json', undefined);
    expect(load.load).toBe(1.2);
  });

  it('parses disk usage from complex response', async () => {
    mockGet.mockResolvedValue({
      data: {
        usage: {
          Total: { space: 75.5 },
        },
        percent: 80,
      },
    });

    const disk = await getDiskPercent();

    expect(mockGet).toHaveBeenCalledWith('/host/getDiskPercent.json', undefined);
    expect(disk.usage).toBe(75.5);
    expect(disk.percent).toBe(80);
  });

  it('parses server routing fields', async () => {
    mockGet.mockResolvedValue({
      data: {
        servers: [
          {
            Server: {
              Id: '2',
              Name: 'Remote',
              Hostname: 'remote.example.com',
              Protocol: 'https',
              Port: 443,
              PathToIndex: '/zm',
              PathToZMS: '/zm/cgi-bin/nph-zms',
              PathToApi: '/zm/api',
            },
          },
        ],
      },
    });

    const servers = await getServers();

    expect(servers).toEqual([
      {
        Id: '2',
        Name: 'Remote',
        Hostname: 'remote.example.com',
        Protocol: 'https',
        Port: 443,
        PathToIndex: '/zm',
        PathToZMS: '/zm/cgi-bin/nph-zms',
        PathToApi: '/zm/api',
      },
    ]);
  });

  it('returns storage list', async () => {
    mockGet.mockResolvedValue({
      data: {
        storage: [
          {
            Storage: {
              Id: '1',
              Path: '/var/cache/zoneminder/events',
              Name: 'Default',
              Type: 'local',
              Url: null,
              DiskSpace: 1024000,
              Scheme: 'Medium',
              ServerId: '1',
              DoDelete: true,
              Enabled: true,
              DiskTotalSpace: 5000000,
              DiskUsedSpace: 1024000,
            },
          },
        ],
      },
    });

    const storages = await getStorages();

    expect(mockGet).toHaveBeenCalledWith('/storage.json');
    expect(storages).toHaveLength(1);
    expect(storages[0].Name).toBe('Default');
    expect(storages[0].ServerId).toBe('1');
  });

  it('routes getDaemonCheck to alternate server when apiBaseUrl provided', async () => {
    mockGet.mockResolvedValue({ data: { result: 1 } });
    await getDaemonCheck('https://pseudo.example.com/api');
    expect(mockGet).toHaveBeenCalledWith('/host/daemonCheck.json', { baseURL: 'https://pseudo.example.com/api' });
  });

  it('routes getLoad to alternate server', async () => {
    mockGet.mockResolvedValue({ data: { load: [1.2] } });
    await getLoad('https://pseudo.example.com/api');
    expect(mockGet).toHaveBeenCalledWith('/host/getLoad.json', { baseURL: 'https://pseudo.example.com/api' });
  });

  it('routes getDiskPercent to alternate server', async () => {
    mockGet.mockResolvedValue({ data: { usage: 50, percent: 50 } });
    await getDiskPercent('https://pseudo.example.com/api');
    expect(mockGet).toHaveBeenCalledWith('/host/getDiskPercent.json', { baseURL: 'https://pseudo.example.com/api' });
  });

  it('handles empty storage response', async () => {
    mockGet.mockResolvedValue({
      data: {
        storage: [],
      },
    });

    const storages = await getStorages();

    expect(storages).toEqual([]);
  });
});
