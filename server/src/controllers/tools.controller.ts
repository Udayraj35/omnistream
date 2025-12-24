import { ffmpegService } from '../services/ffmpeg.service.ts';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const urlCache = new Map<string, string>();

export const toolsController = {
    async resolveUrl(req: any, res: any) {
        const { url } = req.body;
        try {
            console.log(`Resolving URL: ${url}`);
            const result = await ffmpegService.resolveMediaUrl(url);

            // Proxy logic: Store URL and return local link
            if (result.url && result.url.startsWith('http')) {
                const id = uuidv4();
                urlCache.set(id, result.url);
                // Clean up cache after 1 hour
                setTimeout(() => urlCache.delete(id), 3600000);

                result.url = `/api/tools/stream/${id}`;
            }

            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to resolve URL' });
        }
    },

    async proxyMedia(req: any, res: any) {
        const { id } = req.params;
        const targetUrl = urlCache.get(id);

        if (!targetUrl || !targetUrl.startsWith('http')) {
            console.warn(`Proxy requested for invalid URL ID: ${id}, target: ${targetUrl}`);
            return res.status(400).send("Invalid target URL");
        }

        try {
            const range = req.headers.range;
            const headers: any = {};
            if (range) headers['Range'] = range;

            const response = await axios({
                url: targetUrl,
                method: 'GET',
                responseType: 'stream',
                headers
            });

            const cleanHeader = (val: any) => val ? String(val).replace(/[^0-9]/g, '') : undefined;
            const contentLength = cleanHeader(response.headers['content-length']);

            if (contentLength) res.setHeader('Content-Length', contentLength);
            if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
            res.setHeader('Accept-Ranges', 'bytes');
            if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);

            if (range && response.status === 206) {
                res.status(206);
            }

            response.data.pipe(res);
        } catch (error: any) {
            console.error("Proxy error:", error.message);
            // Don't send JSON error if headers already sent, just close stream
            if (!res.headersSent) res.sendStatus(500);
        }
    }
};
