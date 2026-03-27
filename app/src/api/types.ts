import { z } from 'zod';
import { log, LogLevel } from '../lib/logger';
import type { EventFilters } from './events';

// Authentication types
export const LoginResponseSchema = z.object({
  access_token: z.string().optional(),
  access_token_expires: z.coerce.number().optional(),
  refresh_token: z.string().optional(),
  refresh_token_expires: z.coerce.number().optional(),
  credentials: z.string().optional(),
  append_password: z.coerce.number().optional(),
  version: z.string().optional(),
  apiversion: z.string().optional(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Version types
export const VersionResponseSchema = z.object({
  version: z.string(),
  apiversion: z.string(),
});

export type VersionResponse = z.infer<typeof VersionResponseSchema>;

// Host types
export const HostTimeZoneResponseSchema = z.object({
  DateTime: z.object({
    TimeZone: z.string().optional(),
    Timezone: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
  dateTime: z.object({
    TimeZone: z.string().optional(),
    Timezone: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
  // Support root level keys
  TimeZone: z.string().optional(),
  Timezone: z.string().optional(),
  timezone: z.string().optional(),
  tz: z.string().optional(),
}).transform((data) => {
  // Check nested first
  const dt = data.DateTime || data.dateTime;
  let tz = dt ? (dt.TimeZone || dt.Timezone || dt.timezone) : undefined;

  // If not nested, check root
  if (!tz) {
    tz = data.TimeZone || data.Timezone || data.timezone || data.tz;
  }

  if (!tz) {
    // Log the actual data to help debugging if this fails
    log.api('HostTimeZoneResponseSchema validation failed', LogLevel.WARN, { receivedData: JSON.stringify(data) });
    throw new Error('Response missing TimeZone field (checked root and DateTime object)');
  }

  return {
    DateTime: {
      TimeZone: tz
    }
  };
});

export type HostTimeZoneResponse = z.infer<typeof HostTimeZoneResponseSchema>;

// Monitor types
export const MonitorStatusSchema = z.object({
  MonitorId: z.coerce.string().nullable(),
  Status: z.coerce.string().nullable(),
  CaptureFPS: z.coerce.string().nullable().optional(),
  AnalysisFPS: z.coerce.string().nullable().optional(),
  CaptureBandwidth: z.coerce.string().nullable().optional(),
});

export const MonitorSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  Notes: z.string().nullable().optional(),
  Deleted: z.boolean().optional(),
  ServerId: z.coerce.string().nullable(),
  StorageId: z.coerce.string().nullable(),
  Type: z.string(),
  Function: z.enum(['None', 'Monitor', 'Modect', 'Record', 'Mocord', 'Nodect']),
  // ZM 1.38+ fields (replace Function with independent controls)
  Capturing: z.enum(['None', 'Ondemand', 'Always']).optional(),
  Analysing: z.enum(['None', 'Always']).optional(),
  Recording: z.enum(['None', 'OnMotion', 'Always']).optional(),
  Enabled: z.coerce.string(),
  LinkedMonitors: z.string().nullable(),
  Triggers: z.string().nullable(),
  Device: z.string().nullable(),
  Channel: z.coerce.string().nullable(),
  Format: z.coerce.string().nullable(),
  V4LMultiBuffer: z.string().nullable(),
  V4LCapturesPerFrame: z.coerce.string().nullable(),
  Protocol: z.string().nullable(),
  Method: z.string().nullable(),
  Host: z.string().nullable(),
  Port: z.string().nullable(),
  SubPath: z.string().nullable(),
  Path: z.string().nullable(),
  Options: z.string().nullable(),
  User: z.string().nullable(),
  Pass: z.string().nullable(),
  Width: z.coerce.string(),
  Height: z.coerce.string(),
  Colours: z.coerce.string(),
  Palette: z.coerce.string().nullable(),
  Orientation: z.string().nullable(),
  Deinterlacing: z.coerce.string().nullable(),
  DecoderHWAccelName: z.string().nullable(),
  DecoderHWAccelDevice: z.string().nullable(),
  SaveJPEGs: z.coerce.string().nullable(),
  VideoWriter: z.coerce.string().nullable(),
  EncoderParameters: z.string().nullable(),
  RecordAudio: z.coerce.string().nullable(),
  RTSPDescribe: z.coerce.string().nullable(),
  Brightness: z.coerce.number().nullable(),
  Contrast: z.coerce.number().nullable(),
  Hue: z.coerce.number().nullable(),
  Colour: z.coerce.number().nullable(),
  EventPrefix: z.string().nullable(),
  EventStartCommand: z.string().nullable().optional(),
  EventEndCommand: z.string().nullable().optional(),
  LabelFormat: z.string().nullable(),
  LabelX: z.coerce.string().nullable(),
  LabelY: z.coerce.string().nullable(),
  LabelSize: z.coerce.string().nullable(),
  ImageBufferCount: z.coerce.string(),
  WarmupCount: z.coerce.string(),
  PreEventCount: z.coerce.string(),
  PostEventCount: z.coerce.string(),
  StreamReplayBuffer: z.coerce.string(),
  AlarmFrameCount: z.coerce.string(),
  SectionLength: z.coerce.string(),
  MinSectionLength: z.coerce.string(),
  FrameSkip: z.coerce.string(),
  MotionFrameSkip: z.coerce.string(),
  AnalysisFPSLimit: z.string().nullable(),
  AnalysisUpdateDelay: z.coerce.string(),
  MaxFPS: z.string().nullable(),
  AlarmMaxFPS: z.string().nullable(),
  FPSReportInterval: z.coerce.string(),
  RefBlendPerc: z.coerce.string(),
  AlarmRefBlendPerc: z.coerce.string(),
  Controllable: z.coerce.string(),
  ControlId: z.coerce.string().nullable(),
  ControlDevice: z.string().nullable(),
  ControlAddress: z.string().nullable(),
  AutoStopTimeout: z.string().nullable(),
  TrackMotion: z.coerce.string().nullable(),
  TrackDelay: z.coerce.string().nullable(),
  ReturnLocation: z.coerce.string().nullable(),
  ReturnDelay: z.coerce.string().nullable(),
  ModectDuringPTZ: z.coerce.string().nullable(),
  DefaultRate: z.coerce.string(),
  DefaultScale: z.union([z.string(), z.number()]).transform(String),
  SignalCheckPoints: z.coerce.string().nullable(),
  SignalCheckColour: z.string(),
  WebColour: z.string(),
  Exif: z.coerce.string().nullable(),
  Sequence: z.coerce.string().nullable(),
  ZoneCount: z.coerce.number(),
  Refresh: z.string().nullable(),
  DefaultCodec: z.string().nullable(),
  GroupIds: z.coerce.string().nullable().optional(),
  Latitude: z.coerce.number().nullable(),
  Longitude: z.coerce.number().nullable(),
  RTSPServer: z.coerce.string().nullable(),
  RTSPStreamName: z.string().nullable(),
  Importance: z.string().nullable(),
  // Go2RTC fields (ZoneMinder 1.37+)
  Go2RTCEnabled: z.coerce.boolean().optional().default(false),
  Go2RTCType: z.preprocess(
    (val) => {
      // Transform any falsy value (including '', 0, false, null, undefined) to null
      // Also handle whitespace-only strings
      if (!val || (typeof val === 'string' && !val.trim())) return null;
      return val;
    },
    z.enum(['WebRTC', 'MSE', 'HLS']).nullable().optional()
  ),
  RTSP2WebEnabled: z.coerce.boolean().optional().default(false),
  RTSP2WebType: z.preprocess(
    (val) => {
      // Transform any falsy value (including '', 0, false, null, undefined) to null
      // Also handle whitespace-only strings
      if (!val || (typeof val === 'string' && !val.trim())) return null;
      return val;
    },
    z.enum(['HLS', 'MSE', 'WebRTC']).nullable().optional()
  ),
  JanusEnabled: z.coerce.boolean().optional().default(false),
  DefaultPlayer: z.string().nullable().optional(),
});

export const MonitorDataSchema = z.object({
  Monitor: MonitorSchema,
  Monitor_Status: MonitorStatusSchema.optional(),
});

export const MonitorsResponseSchema = z.object({
  monitors: z.array(MonitorDataSchema),
});

export type Monitor = z.infer<typeof MonitorSchema>;
export type MonitorStatus = z.infer<typeof MonitorStatusSchema>;
export type MonitorData = z.infer<typeof MonitorDataSchema>;
export type MonitorsResponse = z.infer<typeof MonitorsResponseSchema>;

// Monitor alarm status response (for getAlarmStatus and alarm control endpoints)
// ZM alarm() function returns different structures based on command and success/failure:
// - Success with 'status' command: { status: number, output: number }
// - Success with 'on'/'off' commands: { status: string, output: string }
// - Error: { status: 'false', code: number, error: string }
export const AlarmStatusResponseSchema = z.object({
  status: z.union([z.string(), z.coerce.number()]),
  output: z.union([z.string(), z.coerce.number()]).optional(),
  // Error response fields
  code: z.coerce.number().optional(),
  error: z.string().optional(),
});

export type AlarmStatusResponse = z.infer<typeof AlarmStatusResponseSchema>;

// Monitor daemon status response (for getDaemonStatus endpoint)
// ZM daemonControl() returns: { status: 'ok', statustext: string }
export const DaemonStatusResponseSchema = z.object({
  status: z.string(),
  statustext: z.string().optional(), // The actual status message
});

export type DaemonStatusResponse = z.infer<typeof DaemonStatusResponseSchema>;

export const ZMControlSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  Type: z.string(),
  Protocol: z.string().nullable(),
  CanWake: z.coerce.string().optional(),
  CanSleep: z.coerce.string().optional(),
  CanReset: z.coerce.string().optional(),
  CanReboot: z.coerce.string().optional(),
  CanZoom: z.coerce.string().optional(),
  CanAutoZoom: z.coerce.string().optional(),
  CanZoomAbs: z.coerce.string().optional(),
  CanZoomRel: z.coerce.string().optional(),
  CanZoomCon: z.coerce.string().optional(),
  HasZoomSpeed: z.coerce.string().optional(),
  CanFocus: z.coerce.string().optional(),
  CanAutoFocus: z.coerce.string().optional(),
  CanFocusAbs: z.coerce.string().optional(),
  CanFocusRel: z.coerce.string().optional(),
  CanFocusCon: z.coerce.string().optional(),
  HasFocusSpeed: z.coerce.string().optional(),
  CanIris: z.coerce.string().optional(),
  CanAutoIris: z.coerce.string().optional(),
  CanIrisAbs: z.coerce.string().optional(),
  CanIrisRel: z.coerce.string().optional(),
  CanIrisCon: z.coerce.string().optional(),
  HasIrisSpeed: z.coerce.string().optional(),
  CanGain: z.coerce.string().optional(),
  CanAutoGain: z.coerce.string().optional(),
  CanGainAbs: z.coerce.string().optional(),
  CanGainRel: z.coerce.string().optional(),
  CanGainCon: z.coerce.string().optional(),
  HasGainSpeed: z.coerce.string().optional(),
  CanWhite: z.coerce.string().optional(),
  CanAutoWhite: z.coerce.string().optional(),
  CanWhiteAbs: z.coerce.string().optional(),
  CanWhiteRel: z.coerce.string().optional(),
  CanWhiteCon: z.coerce.string().optional(),
  HasWhiteSpeed: z.coerce.string().optional(),
  HasPresets: z.coerce.string().optional(),
  NumPresets: z.coerce.string().optional(),
  HasHomePreset: z.coerce.string().optional(),
  CanSetPresets: z.coerce.string().optional(),
  CanMove: z.coerce.string().optional(),
  CanMoveDiag: z.coerce.string().optional(),
  CanMoveMap: z.coerce.string().optional(),
  CanMoveAbs: z.coerce.string().optional(),
  CanMoveRel: z.coerce.string().optional(),
  CanMoveCon: z.coerce.string().optional(),
  CanPan: z.coerce.string().optional(),
  HasPanSpeed: z.coerce.string().optional(),
  HasTurboPan: z.coerce.string().optional(),
  CanTilt: z.coerce.string().optional(),
  HasTiltSpeed: z.coerce.string().optional(),
  HasTurboTilt: z.coerce.string().optional(),
  CanAutoScan: z.coerce.string().optional(),
  NumScanPaths: z.coerce.string().optional(),
});

export const ControlDataSchema = z.object({
  control: z.object({
    Control: ZMControlSchema
  })
});

export type ZMControl = z.infer<typeof ZMControlSchema>;
export type ControlData = z.infer<typeof ControlDataSchema>;

// Event types
// Force re-bundle
export const EventSchema = z.object({
  Id: z.coerce.string(),
  MonitorId: z.coerce.string(),
  StorageId: z.coerce.string().nullable(),
  SecondaryStorageId: z.coerce.string().nullable(),
  Name: z.string(),
  Cause: z.string(),
  StartDateTime: z.string(),
  EndDateTime: z.string().nullable(),
  Width: z.coerce.string(),
  Height: z.coerce.string(),
  Length: z.coerce.string(),
  Frames: z.coerce.string(),
  AlarmFrames: z.coerce.string(),
  AlarmFrameId: z.coerce.string().optional(),  // First alarm frame ID
  MaxScoreFrameId: z.coerce.string().optional(),  // Frame with highest score
  DefaultVideo: z.string().nullable(),
  SaveJPEGs: z.coerce.string().nullable(),
  TotScore: z.coerce.string(),
  AvgScore: z.coerce.string(),
  MaxScore: z.coerce.string(),
  Archived: z.coerce.string(),
  Videoed: z.coerce.string(),
  Uploaded: z.coerce.string(),
  Emailed: z.coerce.string(),
  Messaged: z.coerce.string(),
  Executed: z.coerce.string(),
  Notes: z.string().nullable(),
  StateId: z.coerce.string().nullable(),
  Orientation: z.string().nullable(),
  DiskSpace: z.coerce.string().nullable(),
  Scheme: z.string().nullable(),
});

export const EventDataSchema = z.object({
  Event: EventSchema,
});

export const EventsResponseSchema = z.object({
  events: z.array(EventDataSchema),
  pagination: z.object({
    pageCount: z.coerce.number(),
    page: z.coerce.number(),
    current: z.coerce.number(),
    count: z.coerce.number(),
    prevPage: z.boolean(),
    nextPage: z.boolean(),
    limit: z.coerce.number(),
    totalCount: z.coerce.number().optional(), // Total events matching filters (from server)
  }),
});

export type Event = z.infer<typeof EventSchema>;
export type EventData = z.infer<typeof EventDataSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;

// Single event response (for getEvent endpoint)
export const EventResponseSchema = z.object({
  event: EventDataSchema,
});

export type EventResponse = z.infer<typeof EventResponseSchema>;

// Console events response (for getConsoleEvents endpoint)
// API can return either an object (record) or an array, so we handle both
export const ConsoleEventsResponseSchema = z.object({
  results: z.union([
    z.record(z.string(), z.coerce.number()),
    z.array(z.unknown()),
  ]).optional(),
});

export type ConsoleEventsResponse = z.infer<typeof ConsoleEventsResponseSchema>;

// Config types
export const ConfigSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  Value: z.string(),
  Type: z.string(),
  DefaultValue: z.string().nullable().optional(),
  Hint: z.string().nullable().optional(),
  Pattern: z.string().nullable().optional(),
  Format: z.string().nullable().optional(),
  Prompt: z.string().nullable().optional(),
  Help: z.string().nullable().optional(),
  Category: z.string(),
  Readonly: z.coerce.string().nullable().optional(),
  Requires: z.string().nullable().optional(),
});

export const ConfigDataSchema = z.object({
  Config: ConfigSchema,
});

export const ConfigsResponseSchema = z.object({
  configs: z.array(ConfigDataSchema),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigData = z.infer<typeof ConfigDataSchema>;
export type ConfigsResponse = z.infer<typeof ConfigsResponseSchema>;

// ZMS Path response schema for fetching ZM_PATH_ZMS config
export const ZmsPathResponseSchema = z.object({
  config: z.object({
    Value: z.string(),
  }),
});

export type ZmsPathResponse = z.infer<typeof ZmsPathResponseSchema>;

// Min Streaming Port response schema for fetching ZM_MIN_STREAMING_PORT config
export const MinStreamingPortResponseSchema = z.object({
  config: z.object({
    Value: z.string(),
  }),
});

export type MinStreamingPortResponse = z.infer<typeof MinStreamingPortResponseSchema>;

// Go2RTC Path response schema for fetching ZM_GO2RTC_PATH config
export const Go2RTCPathResponseSchema = z.object({
  config: z.object({
    Value: z.string(),
  }),
});

export type Go2RTCPathResponse = z.infer<typeof Go2RTCPathResponseSchema>;

// ZoneMinder server log types
export const ZMLogSchema = z.object({
  Id: z.coerce.number(),
  TimeKey: z.string(),
  Component: z.string(),
  ServerId: z.coerce.number().nullable(),
  Pid: z.coerce.number().nullable(),
  Level: z.coerce.number(),
  Code: z.string(),
  Message: z.string(),
  File: z.string().nullable(),
  Line: z.coerce.number().nullable(),
});

export const ZMLogDataSchema = z.object({
  Log: ZMLogSchema,
});

export const ZMLogsResponseSchema = z.object({
  logs: z.array(ZMLogDataSchema),
  pagination: z.object({
    page: z.coerce.number(),
    current: z.coerce.number(),
    count: z.coerce.number(),
    prevPage: z.boolean(),
    nextPage: z.boolean(),
    pageCount: z.coerce.number(),
    order: z.record(z.string(), z.string()).optional(),
    limit: z.coerce.number(),
    options: z.object({
      conditions: z.array(z.unknown()),
    }).optional(),
    paramType: z.string().optional(),
    queryScope: z.unknown().nullable().optional(),
  }),
});

export type ZMLog = z.infer<typeof ZMLogSchema>;
export type ZMLogData = z.infer<typeof ZMLogDataSchema>;
export type ZMLogsResponse = z.infer<typeof ZMLogsResponseSchema>;

// State types
export const StateSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  Definition: z.string(),
  IsActive: z.coerce.string(),
});

export const StateDataSchema = z.object({
  State: z.object({
    Id: z.coerce.number(),
    Name: z.string(),
    Definition: z.string(),
    IsActive: z.coerce.number(),
  }),
});

export const StatesResponseSchema = z.object({
  states: z.array(StateDataSchema).optional(),
});

export type State = z.infer<typeof StateSchema>;
export type StateData = z.infer<typeof StateDataSchema>;
export type StatesResponse = z.infer<typeof StatesResponseSchema>;

// Profile types (app-specific, not from ZM API)
export interface Profile {
  id: string;
  name: string;
  portalUrl: string;
  apiUrl: string;
  cgiUrl: string;
  username?: string;
  password?: string; // encrypted
  refreshToken?: string; // stored in profile for auto-login
  isDefault: boolean;
  createdAt: number;
  lastUsed?: number;
  timezone?: string;
  minStreamingPort?: number; // ZM_MIN_STREAMING_PORT from server config
  go2rtcUrl?: string; // ZM_GO2RTC_PATH from server config (full URL)
}

// Stream options types
export interface StreamOptions {
  mode?: 'jpeg' | 'single' | 'stream';
  scale?: number;
  width?: number;
  height?: number;
  maxfps?: number;
  buffer?: number;
  token?: string;
  connkey?: number;
  cacheBuster?: number;
}

// Component prop types
export interface MonitorCardProps {
  monitor: Monitor;
  status: MonitorStatus | undefined;
  eventCount?: number;
  objectFit?: React.CSSProperties['objectFit'];
}

export interface EventCardProps {
  event: Event;
  monitorName: string;
  thumbnailUrl: string;
  objectFit?: React.CSSProperties['objectFit'];
  thumbnailWidth: number;
  thumbnailHeight: number;
  tags?: Tag[];
  eventFilters?: EventFilters;
}

// Zone types
export const ZoneTypeEnum = z.enum(['Active', 'Inclusive', 'Exclusive', 'Preclusive', 'Inactive', 'Privacy']);

export const ZoneSchema = z.object({
  Id: z.coerce.number(),
  MonitorId: z.coerce.number(),
  Name: z.string(),
  Type: ZoneTypeEnum,
  Units: z.string().optional(),
  NumCoords: z.coerce.number(),
  Coords: z.string(),
  Area: z.coerce.number().optional(),
  AlarmRGB: z.coerce.number().optional(),
  CheckMethod: z.string().optional(),
  MinPixelThreshold: z.coerce.number().nullable().optional(),
  MaxPixelThreshold: z.coerce.number().nullable().optional(),
  MinAlarmPixels: z.coerce.number().nullable().optional(),
  MaxAlarmPixels: z.coerce.number().nullable().optional(),
  FilterX: z.coerce.number().nullable().optional(),
  FilterY: z.coerce.number().nullable().optional(),
  MinFilterPixels: z.coerce.number().nullable().optional(),
  MaxFilterPixels: z.coerce.number().nullable().optional(),
  MinBlobPixels: z.coerce.number().nullable().optional(),
  MaxBlobPixels: z.coerce.number().nullable().optional(),
  MinBlobs: z.coerce.number().nullable().optional(),
  MaxBlobs: z.coerce.number().nullable().optional(),
  OverloadFrames: z.coerce.number().nullable().optional(),
  ExtendAlarmFrames: z.coerce.number().nullable().optional(),
});

export const ZoneDataSchema = z.object({
  Zone: ZoneSchema,
});

export const ZonesResponseSchema = z.object({
  zones: z.array(ZoneDataSchema),
});

export type Zone = z.infer<typeof ZoneSchema>;
export type ZoneType = z.infer<typeof ZoneTypeEnum>;
export type ZoneData = z.infer<typeof ZoneDataSchema>;
export type ZonesResponse = z.infer<typeof ZonesResponseSchema>;

// Group types
export const GroupSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  ParentId: z.coerce.string().nullable(),
});

// Monitor reference within a group (subset of full Monitor)
export const GroupMonitorRefSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string().optional(),
});

export const GroupDataSchema = z.object({
  Group: GroupSchema,
  Monitor: z.array(GroupMonitorRefSchema).optional().default([]),
});

export const GroupsResponseSchema = z.object({
  groups: z.array(GroupDataSchema),
});

export type Group = z.infer<typeof GroupSchema>;
export type GroupMonitorRef = z.infer<typeof GroupMonitorRefSchema>;
export type GroupData = z.infer<typeof GroupDataSchema>;
export type GroupsResponse = z.infer<typeof GroupsResponseSchema>;

// Montage layout types
export interface MontageLayout {
  lg?: ReactGridLayout.Layout[];
  md?: ReactGridLayout.Layout[];
  sm?: ReactGridLayout.Layout[];
  xs?: ReactGridLayout.Layout[];
}

// Import for ReactGridLayout namespace
import type * as ReactGridLayout from 'react-grid-layout';

// Tag types
export const TagSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  CreateDate: z.string().nullable().optional(),
  CreatedBy: z.coerce.string().nullable().optional(),
  LastAssignedDate: z.string().nullable().optional(),
});

// Schema for tag data without event association (used for available tags list)
export const TagDataSchema = z.object({
  Tag: TagSchema,
});

// Schema for tag-event mapping from the API
// The API returns: { tags: [{ Tag: {...}, Events_Tags: {EventId: 1} }] }
// Each tag-event association is a separate entry in the array
export const TagEventMappingSchema = z.object({
  Tag: TagSchema,
  Events_Tags: z.object({
    EventId: z.coerce.string(),
  }).optional(),
});

// Response schema for GET /api/tags.json
// This returns all tags with their event associations
export const TagsResponseSchema = z.object({
  tags: z.array(TagEventMappingSchema),
});

// Response schema for GET /api/tags/index/Events.Id:1,2,3.json
// Same format as TagsResponseSchema
export const EventTagsResponseSchema = z.object({
  tags: z.array(TagEventMappingSchema),
});

export type Tag = z.infer<typeof TagSchema>;
export type TagData = z.infer<typeof TagDataSchema>;
export type TagEventMapping = z.infer<typeof TagEventMappingSchema>;
export type TagsResponse = z.infer<typeof TagsResponseSchema>;
export type EventTagsResponse = z.infer<typeof EventTagsResponseSchema>;
