import axios from 'axios';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';
import pako from 'pako';

/**
 * This service allows users to import and use custom music source scripts (LX Music style).
 * Highly optimized for obfuscated scripts like "Grass".
 */

interface LXRequestOptions {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
    timeout?: number;
    form?: any;
    formData?: any;
}

// Helper to convert Buffer to WordArray for CryptoJS
function bufferToWordArray(buffer: Buffer) {
    const uint8Array = new Uint8Array(buffer);
    const words: number[] = [];
    for (let i = 0; i < uint8Array.length; i++) {
        words[i >>> 2] |= uint8Array[i] << (24 - (i % 4) * 8);
    }
    return CryptoJS.lib.WordArray.create(words, uint8Array.length);
}

// Helper to convert WordArray to Buffer
function wordArrayToBuffer(wordArray: any) {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const buffer = Buffer.alloc(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        buffer[i] = byte;
    }
    return buffer;
}

export class CustomMusicEngine {
    private sources: Map<string, any> = new Map();

    private parseMetadata(code: string) {
        const metadata: any = {};
        const lines = code.split('\n');
        let inComment = false;

        for (const line of lines) {
            if (line.includes('/**')) inComment = true;
            if (inComment) {
                const match = line.match(/@(\w+)\s+(.+)/);
                if (match) metadata[match[1]] = match[2].trim();
            }
            if (line.includes('*/')) {
                inComment = false;
                break;
            }
        }
        return metadata;
    }

    async loadSource(id: string, customName: string, code: string) {
        try {
            const metadata = this.parseMetadata(code);
            const scriptName = metadata.name || customName;

            this.sources.set(id, {
                id,
                name: scriptName,
                metadata,
                sources: {},
                _eventHandlers: {},
            });

            const lxBridge = {
                version: '2.0.0',
                lx_version: '2.0.0', // Common alias
                env: 'mobile',
                currentScriptInfo: {
                    name: scriptName,
                    description: metadata.description || '',
                    version: metadata.version || '1.0.0',
                    author: metadata.author || '',
                    homepage: metadata.homepage || '',
                    rawScript: code
                },
                EVENT_NAMES: {
                    inited: 'inited',
                    request: 'request',
                    updateAlert: 'updateAlert'
                },
                on: (eventName: string, handler: Function) => {
                    const entry = this.sources.get(id);
                    if (entry) {
                        if (!entry._eventHandlers[eventName]) entry._eventHandlers[eventName] = [];
                        entry._eventHandlers[eventName].push(handler);
                    }
                },
                send: (eventName: string, data: any) => {
                    if (eventName === 'inited') {
                        const entry = this.sources.get(id);
                        if (entry && data.sources) {
                            entry.sources = data.sources;
                            console.log(`Custom source ${scriptName} inited with sources:`, Object.keys(data.sources));
                        }
                    }
                },
                request: (url: any, options: any, callback: any) => {
                    return this.createRequestBridge(url, options, callback);
                },
                utils: {
                    buffer: {
                        from: (data: any, encoding?: string) => {
                            if (data && data.words && data.sigBytes) return wordArrayToBuffer(data);
                            return Buffer.from(data, encoding as any);
                        },
                        bufToString: (buf: any, format: string) => {
                            const buffer = Buffer.isBuffer(buf) ? buf : (buf && buf.words ? wordArrayToBuffer(buf) : Buffer.from(buf));
                            return buffer.toString(format as any);
                        }
                    },
                    crypto: {
                        aesEncrypt: (buffer: Buffer, mode: string, key: string, iv: string) => {
                            const keyHex = CryptoJS.enc.Utf8.parse(key);
                            const ivHex = iv ? CryptoJS.enc.Utf8.parse(iv) : undefined;
                            let cryptoMode = CryptoJS.mode.CBC;
                            if (mode && mode.toLowerCase().includes('ecb')) cryptoMode = CryptoJS.mode.ECB;
                            
                            const encrypted = CryptoJS.AES.encrypt(
                                bufferToWordArray(Buffer.from(buffer)), 
                                keyHex, 
                                { iv: ivHex, mode: cryptoMode, padding: CryptoJS.pad.Pkcs7 }
                            );
                            // Return Buffer to accommodate scripts calling .toString('hex')
                            return Buffer.from(encrypted.ciphertext.toString(CryptoJS.enc.Base64), 'base64');
                        },
                        md5: (data: any) => {
                            const wa = Buffer.isBuffer(data) ? bufferToWordArray(data) : data;
                            return CryptoJS.MD5(wa).toString();
                        },
                        randomBytes: (size: number) => {
                            const bytes = new Uint8Array(size);
                            window.crypto.getRandomValues(bytes);
                            return Buffer.from(bytes);
                        },
                        rsaEncrypt: (buffer: Buffer, key: string) => {
                            console.warn('rsaEncrypt not implemented');
                            return buffer;
                        }
                    },
                    zlib: {
                        inflate: (buffer: Buffer) => Promise.resolve(Buffer.from(pako.inflate(buffer))),
                        deflate: (buffer: Buffer) => Promise.resolve(Buffer.from(pako.deflate(buffer)))
                    }
                }
            };

            const wrappedCode = `
                (function(lx, Buffer) {
                    const global = globalThis;
                    const window = globalThis;
                    global.lx = lx;
                    window.lx = lx;
                    global.Buffer = Buffer;
                    window.Buffer = Buffer;
                    
                    try {
                        ${code}
                    } catch (e) {
                        console.error('Error in custom script execution:', e);
                    }
                })(arguments[0], arguments[1]);
            `;

            const runner = new Function(wrappedCode);
            runner(lxBridge, Buffer);

            return true;
        } catch (error) {
            console.error(`Failed to load custom source ${customName}:`, error);
            return false;
        }
    }

    private createRequestBridge(urlOrOptions: any, optionsOrCallback?: any, callback?: any): Function {
        let url: string;
        let options: LXRequestOptions = {};
        let finalCallback: (err: any, resp: any, body: any) => void;

        if (typeof urlOrOptions === 'string') {
            url = urlOrOptions;
            if (typeof optionsOrCallback === 'function') {
                finalCallback = optionsOrCallback;
            } else {
                options = optionsOrCallback || {};
                finalCallback = callback;
            }
        } else {
            url = urlOrOptions.url;
            options = urlOrOptions;
            finalCallback = optionsOrCallback;
        }

        const { method = 'GET', headers, params, body, timeout = 10000, form, formData } = options;
        const controller = new AbortController();

        const execute = async () => {
            try {
                // Ensure body is handled correctly if it's a Buffer
                let dataToBridge = body || form || formData;
                if (Buffer.isBuffer(dataToBridge)) {
                    dataToBridge = dataToBridge.toString('base64');
                    // Add hints for bridge to decode
                    (headers as any)['X-Pump-Body-Encoding'] = 'base64';
                }

                const response = await axios({
                    url: `/api/music/bridge`,
                    method: 'POST',
                    signal: controller.signal,
                    data: { url, method, headers, body: dataToBridge, timeout, params }
                });

                const result = {
                    body: response.data.data,
                    headers: response.data.headers,
                    statusCode: response.data.status,
                };
                
                if (finalCallback) finalCallback(null, result, result.body);
            } catch (error: any) {
                if (axios.isCancel(error)) return;
                if (finalCallback) finalCallback(error, null, null);
            }
        };

        execute();
        return () => controller.abort();
    }

    private async triggerRequest(id: string, source: string, action: string, info: any) {
        const entry = this.sources.get(id);
        if (!entry || !entry._eventHandlers['request']) return null;

        for (const handler of entry._eventHandlers['request']) {
            try {
                const result = await handler({ source, action, info });
                if (result) return result;
            } catch (err: any) {
                // Gracefully handle 'action not support' errors
                if (err && err.message !== 'action not support') {
                    console.error(`Custom script handler for ${action} failed:`, err);
                }
            }
        }
        return null;
    }

    async getMusicUrl(id: string, songInfo: any, quality: string = '128k') {
        const entry = this.sources.get(id);
        if (!entry) return null;
        
        // Ensure songInfo has LX compatible structure
        const info = { 
            ...songInfo,
            name: songInfo.title || songInfo.name || 'Unknown',
            singer: songInfo.artist || songInfo.singer || 'Unknown',
            albumName: songInfo.album || songInfo.albumName || '',
            interval: songInfo.duration ? `${Math.floor(songInfo.duration / 60)}:${(songInfo.duration % 60).toString().padStart(2, '0')}` : '04:00'
        };

        // We removed the strict entry.sources checking because scripts like IKUN 
        // load their actual logic over the network async, and might miss setting it perfectly in our shim.
        
        // Also support potential lx_version v1 scripts if event handlers aren't there
        let result = await this.triggerRequest(id, songInfo.source, 'musicUrl', {
            type: quality,
            musicInfo: info
        });

        // Legacy V1 Fallback Support
        if (!result && entry.sources && entry.sources[songInfo.source] && entry.sources[songInfo.source].musicUrl) {
            try {
                const legacyUrl = await entry.sources[songInfo.source].musicUrl(info, quality);
                if (legacyUrl) result = legacyUrl;
            } catch (e) {
                console.error("Legacy V1 execution error", e);
            }
        }

        if (result) {
            if (typeof result === 'string') return result;
            if (result.url) return result;
            return result;
        }
        
        return null;
    }

    async getLyric(id: string, songInfo: any) {
        return this.triggerRequest(id, songInfo.source, 'lyric', { musicInfo: songInfo });
    }

    async getPic(id: string, songInfo: any) {
        return this.triggerRequest(id, songInfo.source, 'pic', { musicInfo: songInfo });
    }

    getLoadedSources() {
        return Array.from(this.sources.keys());
    }

    clear() {
        this.sources.clear();
    }
}

export const customMusicEngine = new CustomMusicEngine();
