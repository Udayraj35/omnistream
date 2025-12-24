
import { ffmpegService } from './services/ffmpeg.service.ts';

async function test() {
    try {
        console.log("Testing YouTube resolution...");
        const res = await ffmpegService.resolveMediaUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw'); // 'Me at the zoo'
        console.log("Result:", res);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
