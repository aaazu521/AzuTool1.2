import axios from 'axios';

export class XiaohongshuParser {
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0';
    private cookie: string = '';

    private headers = {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    };

    setCookie(cookie: string) {
        this.cookie = cookie;
    }

    private async request(url: string, customHeaders: any = {}) {
        try {
            const response = await axios.get(url, {
                headers: {
                    ...this.headers,
                    ...customHeaders,
                    ...(this.cookie ? { 'Cookie': this.cookie } : {})
                },
                timeout: 10000,
                maxRedirects: 5,
                validateStatus: () => true // Handle all status codes
            });
            return response;
        } catch (error) {
            console.error(`Request failed for ${url}:`, error);
            return null;
        }
    }

    private async getRealUrl(url: string): Promise<string> {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                maxRedirects: 5,
                timeout: 10000
            });
            return response.request.res.responseUrl || url;
        } catch (error) {
            return url;
        }
    }

    private extractId(url: string): string | null {
        const patterns = [
            /discovery\/item\/([a-zA-Z0-9]+)/,
            /explore\/([a-zA-Z0-9]+)/,
            /item\/([a-zA-Z0-9]+)/,
            /note\/([a-zA-Z0-9]+)/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    private processImageUrl(url: string): string {
        if (!url) return '';

        // 1. Handle notes_pre_post, spectrum, etc.
        const dirMatch = url.match(/\/([a-zA-Z0-9_]+)\/([a-zA-Z0-9]+)!/);
        if (dirMatch) {
            const dir = dirMatch[1];
            const id = dirMatch[2];
            if (!/^[a-f0-9]{32}$/.test(dir) && isNaN(Number(dir))) {
                return `https://sns-img-hw.xhscdn.com/${dir}/${id}?imageView2/2/w/1080/format/jpg`;
            }
        }

        // Short links
        const shortMatch = url.match(/(notes_pre_post|spectrum|notes_uhdr)\/([a-zA-Z0-9]+)/);
        if (shortMatch) {
            return `https://sns-img-hw.xhscdn.com/${shortMatch[1]}/${shortMatch[2]}?imageView2/2/w/1080/format/jpg`;
        }

        // Other watermarked links
        const waterMatch = url.match(/\/([a-zA-Z0-9]+)!/);
        if (waterMatch) {
            return `https://ci.xiaohongshu.com/${waterMatch[1]}?imageView2/2/w/1080/format/jpg`;
        }

        return url;
    }

    private extractJson(html: string, id: string) {
        const pattern = /<script>\s*window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})<\/script>/i;
        const match = html.match(pattern);
        if (match) {
            let jsonStr = match[1];
            jsonStr = jsonStr.replace(/undefined/g, 'null');
            try {
                const json = JSON.parse(jsonStr);
                let note = json.note?.noteDetailMap?.[id]?.note;
                if (!note) {
                    note = json.noteData?.data?.noteData;
                }
                if (note) {
                    return this.formatNoteData(note);
                }
            } catch (e) {
                console.error("JSON parse failed", e);
            }
        }
        return null;
    }

    private formatNoteData(note: any) {
        let type = note.type || 'unknown';
        if (type === 'normal') type = 'image';

        let coverUrl = '';
        if (note.imageList && note.imageList.length > 0) {
            const firstImage = note.imageList[0];
            coverUrl = firstImage.urlPre || firstImage.urlDefault || firstImage.url || '';
        }

        if (!coverUrl && type === 'video' && note.video?.image?.thumbnailFileid) {
            coverUrl = `https://sns-img-hw.xhscdn.com/${note.video.image.thumbnailFileid}`;
        }

        if (!coverUrl && note.cover?.url) {
            coverUrl = note.cover.url;
        }

        if (!coverUrl && note.cover?.fileId) {
            coverUrl = `https://sns-img-hw.xhscdn.com/${note.cover.fileId}?imageView2/2/w/1080/format/jpg`;
        }

        const result: any = {
            type,
            title: note.title || '',
            desc: note.desc || '',
            author: {
                name: note.user?.nickname || note.user?.nickName || '',
                id: note.user?.userId || '',
                avatar: note.user?.avatar || '',
            },
            cover: this.processImageUrl(coverUrl),
            url: null,
            images: [],
            live_photo: []
        };

        if (type === 'video') {
            let streams: any[] = [];
            if (note.video?.media?.stream?.h265) {
                streams.push(...note.video.media.stream.h265.map((s: any) => ({ ...s, _codec: 'h265' })));
            }
            if (note.video?.media?.stream?.h264) {
                streams.push(...note.video.media.stream.h264.map((s: any) => ({ ...s, _codec: 'h264' })));
            }

            if (streams.length > 0) {
                streams.sort((a, b) => {
                    if (a._codec !== b._codec) {
                        return a._codec === 'h265' ? -1 : 1;
                    }
                    const bitrateA = a.avgBitrate || a.videoBitrate || 0;
                    const bitrateB = b.avgBitrate || b.videoBitrate || 0;
                    return bitrateB - bitrateA;
                });

                result.url = streams[0].masterUrl;
                if (streams.length > 1) {
                    result.video_backup = streams[1].masterUrl;
                }
            }

            if (!result.url && note.video?.consumer?.originVideoKey) {
                result.url = `http://sns-video-bd.xhscdn.com/${note.video.consumer.originVideoKey}`;
            }
        }

        if (note.imageList) {
            for (const img of note.imageList) {
                const imageUrl = img.url || img.urlDefault || img.urlPre;
                if (imageUrl) {
                    result.images.push(this.processImageUrl(imageUrl));
                }

                let liveVideoUrl = img.stream?.h264?.[0]?.masterUrl || img.stream?.h265?.[0]?.masterUrl;
                if (liveVideoUrl) {
                    result.live_photo.push({
                        image: this.processImageUrl(imageUrl || ''),
                        video: liveVideoUrl
                    });
                }
            }

            if (result.live_photo.length > 0) {
                result.type = 'live';
            }
        }

        return result;
    }

    async parse(url: string) {
        if (!url) return { code: 400, msg: '请输入链接' };

        // 提取文本中的第一个 URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlMatch = url.match(urlRegex);
        if (urlMatch) {
            url = urlMatch[0];
        }

        url = url.replace('xhs.com', 'xhslink.com');
        let realUrl = url;
        if (!url.includes('www.xiaohongshu.com')) {
            realUrl = await this.getRealUrl(url);
        }

        let id = this.extractId(realUrl);
        if (!id) return { code: 400, msg: '无法提取ID', debug_url: realUrl };

        let response = await this.request(realUrl);
        if (!response) return { code: 500, msg: '请求失败' };

        let data = this.extractJson(response.data, id);

        // Retry with mobile UA if failed
        if (!data) {
            const mobileUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36 EdgA/143.0.0.0';
            const retryResponse = await this.request(realUrl, { 'User-Agent': mobileUA });
            if (retryResponse) {
                data = this.extractJson(retryResponse.data, id);
            }
        }

        // Advanced strategy: token based
        if (!data) {
            let token = '';
            const html = response.data;
            const tokenMatch = html.match(/token=(.*?)&/) || html.match(/"xsec_token":\s*"([^"]+)"/);
            if (tokenMatch) token = tokenMatch[1];

            if (token) {
                const apiUrl = `https://www.xiaohongshu.com/discovery/item/${id}?app_platform=android&ignoreEngage=true&app_version=8.69.5&share_from_user_hidden=true&xsec_source=app_share&type=video&xsec_token=${token}`;
                const apiResponse = await this.request(apiUrl);
                if (apiResponse) {
                    data = this.extractJson(apiResponse.data, id);
                }
            }
        }

        if (data) return { code: 200, msg: '解析成功', data };
        return { code: 404, msg: '解析失败' };
    }
}
