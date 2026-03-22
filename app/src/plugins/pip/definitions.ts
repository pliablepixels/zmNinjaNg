export interface PipPlugin {
  isPipSupported(): Promise<{ supported: boolean }>;
  enterPip(options: {
    url: string;
    position?: number; // seconds
    aspectRatio?: string; // e.g. "16:9"
  }): Promise<{ position: number }>; // returns final position in seconds
}
