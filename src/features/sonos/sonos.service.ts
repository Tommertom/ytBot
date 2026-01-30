import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import { ConfigService } from '../../services/config.service.js';
import { SonosDevice } from './sonos.types.js';

class SonosMediaServer {
    private server: http.Server | null = null;
    private readonly baseDir: string;
    private readonly port: number;

    constructor(baseDir: string, port: number) {
        this.baseDir = baseDir;
        this.port = port;
    }

    async start(): Promise<void> {
        if (this.server) {
            return;
        }

        await fs.promises.mkdir(this.baseDir, { recursive: true });

        this.server = http.createServer((req, res) => {
            try {
                this.handleRequest(req, res);
            } catch (error) {
                console.error('[SonosMediaServer] Request error:', error);
                if (!res.headersSent) {
                    res.statusCode = 500;
                }
                res.end();
            }
        });

        await new Promise<void>((resolve, reject) => {
            this.server!.once('error', reject);
            this.server!.listen(this.port, '0.0.0.0', () => resolve());
        });

        console.log(`[SonosMediaServer] Serving ${this.baseDir} on port ${this.port}`);
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
            res.statusCode = 405;
            res.end();
            return;
        }

        const requestUrl = new URL(req.url, 'http://localhost');
        const rawPath = decodeURIComponent(requestUrl.pathname || '/');
        const fileName = path.basename(rawPath);

        if (!fileName || fileName === '/' || fileName === '.') {
            res.statusCode = 404;
            res.end();
            return;
        }

        const filePath = path.join(this.baseDir, fileName);

        if (!this.isPathWithinBaseDir(filePath)) {
            res.statusCode = 403;
            res.end();
            return;
        }

        if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end();
            return;
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const contentType = filePath.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
        const rangeHeader = req.headers.range;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'close');

        if (rangeHeader) {
            const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
            if (!rangeMatch) {
                res.statusCode = 416;
                res.setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }

            const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
            const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

            if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
                res.statusCode = 416;
                res.setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }

            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', String(end - start + 1));

            if (req.method === 'HEAD') {
                res.end();
                return;
            }

            fs.createReadStream(filePath, { start, end }).pipe(res);
            return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Length', String(fileSize));

        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        fs.createReadStream(filePath).pipe(res);
    }

    private isPathWithinBaseDir(filePath: string): boolean {
        const base = path.resolve(this.baseDir) + path.sep;
        const resolved = path.resolve(filePath);
        return resolved.startsWith(base);
    }
}

export class SonosService {
    private readonly pythonPath: string;
    private readonly scriptsDir: string;
    private readonly mediaServer: SonosMediaServer;
    private readonly mediaDir: string;
    private readonly mediaPort: number;
    private readonly mediaHost?: string;

    constructor(configService: ConfigService, mediaDir: string) {
        this.pythonPath = configService.getSonosPythonPath();
        this.scriptsDir = path.join(process.cwd(), 'scripts');
        this.mediaDir = mediaDir;
        this.mediaPort = configService.getSonosMediaPort();
        this.mediaHost = configService.getSonosMediaHost();
        this.mediaServer = new SonosMediaServer(mediaDir, this.mediaPort);
    }

    async ensureMediaServer(): Promise<void> {
        await this.mediaServer.start();
    }

    getMediaUrl(filePath: string): string {
        if (!this.isPathWithinMediaDir(filePath)) {
            throw new Error('Media file path is outside the configured media directory');
        }

        if (!fs.existsSync(filePath)) {
            throw new Error('Media file does not exist');
        }

        const host = this.resolveMediaHost();
        const fileName = path.basename(filePath);
        return `http://${host}:${this.mediaPort}/${encodeURIComponent(fileName)}`;
    }

    async discoverDevices(): Promise<SonosDevice[]> {
        const result = await this.runPythonJson<SonosDevice[]>('sonos_discover.py', []);
        console.log('[SonosService] Discovered devices:', result);
        return Array.isArray(result) ? result : [];
    }

    async playUri(deviceIp: string, mediaUrl: string, metadata?: { title: string; artist: string; album: string }): Promise<void> {
        if (!this.isValidIp(deviceIp)) {
            throw new Error('Invalid Sonos device IP address');
        }

        if (!/^https?:\/\//i.test(mediaUrl)) {
            throw new Error('Media URL must be http or https');
        }

        const args = [deviceIp, mediaUrl];
        
        // Add metadata as JSON if provided
        if (metadata) {
            const metadataJson = JSON.stringify(metadata);
            args.push(metadataJson);
        }

        await this.runPython('sonos_play.py', args);
    }

    private resolveMediaHost(): string {
        if (this.mediaHost && this.mediaHost.trim().length > 0) {
            return this.mediaHost.trim();
        }

        const detected = this.detectHostIp();
        if (!detected) {
            throw new Error('Unable to determine media host IP. Set SONOS_MEDIA_HOST in your environment.');
        }

        return detected;
    }

    private detectHostIp(): string | undefined {
        const interfaces = os.networkInterfaces();
        for (const iface of Object.values(interfaces)) {
            if (!iface) continue;
            for (const addr of iface) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    return addr.address;
                }
            }
        }
        return undefined;
    }

    private isValidIp(ip: string): boolean {
        return net.isIP(ip) !== 0;
    }

    private isPathWithinMediaDir(filePath: string): boolean {
        const base = path.resolve(this.mediaDir) + path.sep;
        const resolved = path.resolve(filePath);
        return resolved.startsWith(base);
    }

    private async runPythonJson<T>(scriptName: string, args: string[]): Promise<T> {
        const output = await this.runPython(scriptName, args);
        try {
            return JSON.parse(output) as T;
        } catch (error) {
            console.error('[SonosService] Failed to parse JSON:', output);
            throw new Error('Failed to parse Sonos discovery output');
        }
    }

    private async runPython(scriptName: string, args: string[]): Promise<string> {
        const scriptPath = path.join(this.scriptsDir, scriptName);
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Sonos helper script not found: ${scriptPath}`);
        }

        return new Promise((resolve, reject) => {
            const child = spawn(this.pythonPath, [scriptPath, ...args], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                reject(error);
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(stderr || `Python script exited with code ${code}`));
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }
}
