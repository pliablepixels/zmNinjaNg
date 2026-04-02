import { describe, it, expect } from 'vitest';
import { getMonitorRunState, isMonitorStreamable, monitorDotColor, monitorBadgeColor, monitorStatusI18nKey } from '../monitor-status';
import type { Monitor, MonitorStatus } from '../../api/types';

function makeMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    Id: '1',
    Name: 'Test',
    Notes: null,
    ServerId: null,
    StorageId: null,
    Type: 'Ffmpeg',
    Function: 'Modect',
    Enabled: '1',
    LinkedMonitors: null,
    Triggers: null,
    Device: null,
    Channel: '0',
    Format: '0',
    V4LMultiBuffer: null,
    V4LCapturesPerFrame: null,
    Protocol: null,
    Method: null,
    Host: null,
    Port: '',
    SubPath: '',
    Path: '',
    SecondPath: null,
    Options: null,
    User: null,
    Pass: null,
    Width: '1920',
    Height: '1080',
    Orientation: null,
    Colours: '4',
    DecoderHWAccelName: null,
    DecoderHWAccelDevice: null,
    Deinterlacing: '0',
    SaveJPEGs: '3',
    VideoWriter: '0',
    OutputCodec: null,
    Encoder: null,
    OutputContainer: null,
    RecordAudio: '0',
    RTSPDescribe: '0',
    Brightness: '-1',
    Contrast: '-1',
    Hue: '-1',
    Colour: '-1',
    EventPrefix: 'Event-',
    LabelFormat: '',
    LabelX: '0',
    LabelY: '0',
    LabelSize: '1',
    ImageBufferCount: '20',
    MaxImageBufferCount: '0',
    WarmupCount: '0',
    PreEventCount: '5',
    PostEventCount: '5',
    StreamReplayBuffer: '0',
    AlarmFrameCount: '1',
    SectionLength: '600',
    MinSectionLength: '10',
    FrameSkip: '0',
    MotionFrameSkip: '0',
    AnalysisFPSLimit: null,
    AnalysisUpdateDelay: '0',
    MaxFPS: null,
    AlarmMaxFPS: null,
    FPSReportInterval: '100',
    RefBlendPerc: '6',
    AlarmRefBlendPerc: '6',
    Controllable: '0',
    ControlId: null,
    ControlDevice: null,
    ControlAddress: null,
    AutoStopTimeout: null,
    TrackMotion: '0',
    TrackDelay: null,
    ReturnLocation: '-1',
    ReturnDelay: null,
    DefaultRate: '100',
    DefaultScale: '100',
    DefaultCodec: 'auto',
    SignalCheckPoints: '0',
    SignalCheckColour: '#0000BE',
    WebColour: '#ff0000',
    Exif: '0',
    Sequence: '1',
    TotalEvents: null,
    TotalEventDiskSpace: null,
    HourEvents: null,
    HourEventDiskSpace: null,
    DayEvents: null,
    DayEventDiskSpace: null,
    WeekEvents: null,
    WeekEventDiskSpace: null,
    MonthEvents: null,
    MonthEventDiskSpace: null,
    ArchivedEvents: null,
    ArchivedEventDiskSpace: null,
    Deleted: false,
    ...overrides,
  } as Monitor;
}

function makeStatus(overrides: Partial<MonitorStatus> = {}): MonitorStatus {
  return {
    MonitorId: '1',
    Status: 'Connected',
    CaptureFPS: '15.00',
    AnalysisFPS: '10.00',
    CaptureBandwidth: '1000',
    ...overrides,
  };
}

describe('getMonitorRunState', () => {
  describe('ZM 1.38+', () => {
    const zmVersion = '1.38.0';

    it('returns "disabled" when Capturing is None', () => {
      const monitor = makeMonitor({ Capturing: 'None', Analysing: 'None', Recording: 'None' });
      expect(getMonitorRunState(monitor, makeStatus(), zmVersion)).toBe('disabled');
    });

    it('returns "offline" when not connected', () => {
      const monitor = makeMonitor({ Capturing: 'Always', Analysing: 'Always', Recording: 'Always' });
      const status = makeStatus({ Status: 'NotRunning' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('offline');
    });

    it('returns "offline" when CaptureFPS is 0', () => {
      const monitor = makeMonitor({ Capturing: 'Always', Analysing: 'None' });
      const status = makeStatus({ CaptureFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('offline');
    });

    it('returns "warning" when analysis enabled but AnalysisFPS is 0', () => {
      const monitor = makeMonitor({ Capturing: 'Always', Analysing: 'Always' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('warning');
    });

    it('returns "live" when capturing and analysis both producing FPS', () => {
      const monitor = makeMonitor({ Capturing: 'Always', Analysing: 'Always' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '10.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('live');
    });

    it('returns "live" when capturing OK and analysis not enabled', () => {
      const monitor = makeMonitor({ Capturing: 'Always', Analysing: 'None' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('live');
    });

    it('returns "offline" when status is undefined', () => {
      const monitor = makeMonitor({ Capturing: 'Always' });
      expect(getMonitorRunState(monitor, undefined, zmVersion)).toBe('offline');
    });
  });

  describe('pre-1.38', () => {
    const zmVersion = '1.36.0';

    it('returns "disabled" when Function is None', () => {
      const monitor = makeMonitor({ Function: 'None' });
      expect(getMonitorRunState(monitor, makeStatus(), zmVersion)).toBe('disabled');
    });

    it('returns "offline" when not connected', () => {
      const monitor = makeMonitor({ Function: 'Modect' });
      const status = makeStatus({ Status: 'NotRunning' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('offline');
    });

    it('returns "warning" when Modect but AnalysisFPS is 0', () => {
      const monitor = makeMonitor({ Function: 'Modect' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('warning');
    });

    it('returns "warning" when Mocord but AnalysisFPS is 0', () => {
      const monitor = makeMonitor({ Function: 'Mocord' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('warning');
    });

    it('returns "live" for Monitor function (no analysis expected)', () => {
      const monitor = makeMonitor({ Function: 'Monitor' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('live');
    });

    it('returns "live" for Record function (no analysis expected)', () => {
      const monitor = makeMonitor({ Function: 'Record' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '0.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('live');
    });

    it('returns "live" when Modect and both FPS are good', () => {
      const monitor = makeMonitor({ Function: 'Modect' });
      const status = makeStatus({ CaptureFPS: '15.00', AnalysisFPS: '10.00' });
      expect(getMonitorRunState(monitor, status, zmVersion)).toBe('live');
    });
  });

  it('returns "disabled" when zmVersion is null and Function is None', () => {
    const monitor = makeMonitor({ Function: 'None' });
    expect(getMonitorRunState(monitor, makeStatus(), null)).toBe('disabled');
  });
});

describe('isMonitorStreamable', () => {
  it('returns true for live and warning', () => {
    expect(isMonitorStreamable('live')).toBe(true);
    expect(isMonitorStreamable('warning')).toBe(true);
  });

  it('returns false for offline and disabled', () => {
    expect(isMonitorStreamable('offline')).toBe(false);
    expect(isMonitorStreamable('disabled')).toBe(false);
  });
});

describe('monitorDotColor', () => {
  it('returns correct colors for each state', () => {
    expect(monitorDotColor('live')).toContain('green');
    expect(monitorDotColor('warning')).toContain('amber');
    expect(monitorDotColor('offline')).toContain('red');
    expect(monitorDotColor('disabled')).toContain('zinc');
  });
});

describe('monitorBadgeColor', () => {
  it('returns correct colors for each state', () => {
    expect(monitorBadgeColor('live')).toContain('green');
    expect(monitorBadgeColor('warning')).toContain('amber');
    expect(monitorBadgeColor('offline')).toContain('red');
    expect(monitorBadgeColor('disabled')).toContain('zinc');
  });
});

describe('monitorStatusI18nKey', () => {
  it('returns correct i18n keys', () => {
    expect(monitorStatusI18nKey('live')).toBe('monitors.live');
    expect(monitorStatusI18nKey('warning')).toBe('monitors.warning');
    expect(monitorStatusI18nKey('offline')).toBe('monitors.offline');
    expect(monitorStatusI18nKey('disabled')).toBe('monitors.disabled');
  });
});
