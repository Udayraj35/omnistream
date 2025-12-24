import { ffmpegService } from '../services/ffmpeg.service.ts';

export const streamController = {
  async startStream(req: any, res: any) {
    const { sourceUrl, destinations, mode } = req.body;

    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ error: 'At least one destination is required' });
    }

    // Validate URLs
    const validDestinations = destinations.filter((d: string) => d && (d.startsWith('rtmp://') || d.startsWith('rtmps://')));
    console.log('Valid destinations for streaming:', validDestinations);
    if (validDestinations.length === 0) {
      return res.status(400).json({ error: 'No valid RTMP destinations provided' });
    }

    try {
      if (mode === 'ingest') {
        const { bitrate } = req.body;
        // Start waiting for socket data
        ffmpegService.startStreamIngest(destinations, bitrate);
        return res.json({
          success: true,
          message: 'Ingest server ready. Please start sending data via socket.',
          mode: 'ingest'
        });
      } else {
        // Default Relay Mode
        if (!sourceUrl) return res.status(400).json({ error: 'Source URL required for relay mode' });

        // Resolve URL before relaying if it's a website link
        const resolved = await ffmpegService.resolveMediaUrl(sourceUrl);

        ffmpegService.startStreamRelay(resolved.url, destinations);
        return res.json({
          success: true,
          message: `Relay started to ${destinations.length} destinations`,
          mode: 'relay',
          details: resolved
        });
      }
    } catch (error: any) {
      console.error("Stream Start Error:", error);
      return res.status(500).json({ success: false, error: 'Failed to start stream', details: error.message });
    }
  },

  async stopStream(_req: any, res: any) {
    try {
      const wasRunning = ffmpegService.stopStream();
      return res.json({ success: true, message: wasRunning ? 'Stream stopped' : 'No stream running' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to stop stream', details: error.message });
    }
  },

  async getIngestConfig(_req: any, res: any) {
    res.json({
      rtmpUrl: 'rtmp://ingest.streamforge.com/live',
      streamKey: 'live_user_key_12345'
    });
  },

  async resolveUrl(req: any, res: any) {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
      const result = await ffmpegService.resolveMediaUrl(url);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to resolve URL' });
    }
  }
};