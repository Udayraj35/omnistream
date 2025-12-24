import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { router } from './routes.ts';
import { config } from './config.ts';
import { ffmpegService } from './services/ffmpeg.service.ts';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8 // 100MB buffer just in case
});

app.use(cors() as any);
app.use(express.json() as any);
app.use('/api', router);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_stream_room', (streamId) => {
    socket.join(streamId);
    console.log(`Socket ${socket.id} joined room ${streamId}`);
  });

  let totalBytesReceived = 0;
  // Handle binary video chunks from frontend
  socket.on('stream_data', (data) => {
    if (data && data.length > 0) {
      totalBytesReceived += data.length;
      console.log(`Received stream chunk from ${socket.id}: ${data.length} bytes (Total: ${(totalBytesReceived / 1024 / 1024).toFixed(2)} MB)`);
      ffmpegService.writeToStream(data);
    } else {
      console.warn(`Received empty stream chunk from ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(config.port, () => {
  console.log(`Backend server running on http://localhost:${config.port}`);
  console.log(`API available at http://localhost:${config.port}/api`);
});