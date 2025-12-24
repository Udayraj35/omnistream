import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
// import { config } from '../config.ts';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Buffer } from 'buffer';

const execAsync = promisify(exec);

// Ensure ffmpeg path is set if not in PATH (config.ffmpegPath is optional if in system path)
// ffmpeg.setFfmpegPath(config.ffmpegPath);

let activeCommand: ffmpeg.FfmpegCommand | null = null;
let activeInputStream: PassThrough | null = null;

export const ffmpegService = {
  /**
   * Resolves the direct playback URL using yt-dlp.
   * This allows the frontend to play (and capture) video from YouTube/Twitch/etc in a native <video> tag.
   */
  async resolveMediaUrl(url: string): Promise<{ url: string; title?: string }> {
    try {
      // Check for generic video files first to avoid slow yt-dlp
      if (url.match(/\.(mp4|webm|m3u8|mov)$/i)) {
        return { url };
      }

      // Basic URL validation to avoid passing junk like "browser said:" to yt-dlp
      if (!url.startsWith('http')) {
        console.warn(`Invalid URL provided for resolution: ${url}`);
        return { url };
      }

      console.log(`Resolving direct link for ${url}...`);

      // -g: get url
      // -f best: best quality (prefer combined if possible, else best video)
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
      const cmd = `yt-dlp --get-url --no-check-certificates --no-warnings --force-ipv4 --referer "https://www.google.com/" --add-header "Accept-Language: en-US,en;q=0.9" --user-agent "${userAgent}" -f "best[ext=mp4]/best" "${url}"`;
      const { stdout } = await execAsync(cmd);

      const resolvedUrl = stdout.trim().split('\n')[0]; // Take first line if multiple

      if (resolvedUrl && resolvedUrl.startsWith('http')) {
        return { url: resolvedUrl };
      }
      throw new Error("Could not extract URL");
    } catch (error: any) {
      console.error("URL Resolution Failed:", error.message);
      // Return original if failed, maybe client can handle it or show error
      return { url };
    }
  },

  startStreamRelay(sourceUrl: string, destinations: string[]) {
    this.stopStream();

    console.log(`Starting relay from ${sourceUrl} to ${destinations.length} destinations`);

    if (destinations.length === 0) throw new Error("No destinations provided");

    const command = ffmpeg(sourceUrl)
      .inputOptions(['-re', '-stream_loop -1', '-reconnect 1', '-reconnect_streamed 1', '-reconnect_delay_max 5'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset veryfast', '-g 60', '-sc_threshold 0', '-b:v 3000k', '-maxrate 3000k', '-bufsize 6000k', '-pix_fmt yuv420p']);

    destinations.forEach(destUrl => command.output(destUrl).format('flv'));

    command.on('start', (cmdLine) => console.log('FFmpeg relay started:', cmdLine));
    command.on('error', (err) => {
      if (err.message.includes('SIGKILL')) {
        console.log('FFmpeg relay stopped by user');
      } else {
        console.error('FFmpeg error:', err.message);
      }
    });
    command.on('end', () => { console.log('FFmpeg process ended'); activeCommand = null; });

    command.run();
    activeCommand = command;
    return command;
  },

  startStreamIngest(destinations: string[], bitrate: number = 2500) {
    this.stopStream();

    console.log(`Starting INGEST stream to ${destinations.length} destinations at ${bitrate}k`);
    if (destinations.length === 0) throw new Error("No destinations provided");

    // Create a PassThrough stream to write binary data into
    activeInputStream = new PassThrough({ highWaterMark: 1024 * 1024 * 2 }); // 2MB (~8s buffer at 2000k)
    activeInputStream.on('error', (e) => console.error('activeInputStream error:', e));
    activeInputStream.on('close', () => console.log('activeInputStream closed'));

    const command = ffmpeg(activeInputStream)
      .inputFormat('webm') // Browsers usually send webm via MediaRecorder
      .inputOptions([
        '-r 30', // Help FFmpeg input poller expect steady rate
        '-analyzeduration 2000000',
        '-probesize 1000000',
        '-thread_queue_size 4096',
        '-fflags +genpts+nobuffer',
        '-use_wallclock_as_timestamps 1'
      ])
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoFilters('fps=fps=30') // Force steady 30fps without speeding up video
      .audioFilters('asetpts=N/48000/TB') // Force steady audio timestamps
      .outputOptions([
        '-preset ultrafast',
        '-tune zerolatency',
        '-g 60',
        '-keyint_min 60',
        '-sc_threshold 0', // Disable scene detection to force rigid 2s GOP
        `-b:v ${bitrate}k`,
        `-maxrate:v ${bitrate}k`,
        `-bufsize:v ${bitrate * 2}k`,
        '-pix_fmt yuv420p',
        '-profile:v baseline',
        '-level 3.1',
        '-flvflags no_duration_filesize',
        '-max_interleave_delta 0',
        '-avoid_negative_ts make_zero'
      ]);

    destinations.forEach(destUrl => command.output(destUrl).format('flv'));

    command.on('start', (cmdLine) => {
      console.log('FFmpeg INGEST started:', cmdLine);
    });

    command.on('stderr', (stderrLine) => {
      // Log EVERYTHING from FFmpeg for now to see why it exits
      console.log('FFmpeg output:', stderrLine);
    });

    command.on('error', (err, _stdout, stderr) => {
      if (err.message.includes('SIGKILL')) {
        console.log('FFmpeg INGEST stopped by user');
      } else {
        console.error('FFmpeg INGEST error:', err.message);
        console.error('FFmpeg stderr output:', stderr);
      }
    });
    command.on('end', () => { console.log('FFmpeg INGEST ended'); activeCommand = null; activeInputStream = null; });

    command.run();
    activeCommand = command;
    return command;
  },

  writeToStream(data: Buffer) {
    if (activeInputStream && !activeInputStream.destroyed) {
      // console.log(`Writing ${data.length} bytes to FFmpeg pipe...`);
      const canWrite = activeInputStream.write(data);
      if (!canWrite) {
        console.warn("FFmpeg input buffer full, applying backpressure");
      }
    } else {
      console.warn("Received data but no active input stream. activeInputStream exists:", !!activeInputStream, "destroyed:", activeInputStream?.destroyed);
    }
  },

  stopStream() {
    if (activeCommand) {
      console.log('Stopping active stream...');
      try { activeCommand.kill('SIGKILL'); } catch (e) { console.error('Error killing FFmpeg:', e); }
      activeCommand = null;
    }
    if (activeInputStream) {
      activeInputStream.end();
      activeInputStream = null;
    }
    return true;
  }
};