import axios from 'axios';

export class DouyinParser {
    private headers: any;
    private cookie: string;
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    constructor() {
        this.headers = {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        };
        this.cookie = "";
    }

    public setCookie(cookie: string) {
        this.cookie = cookie;
    }

    private output(code: number, msg: string, data: any = []) {
        return { code, msg, data };
    }

    private async request(url: string, customHeaders: any = {}, returnHeader = false) {
        try {
            const headers = { ...this.headers, ...customHeaders };
            if (this.cookie) {
                headers['Cookie'] = this.cookie;
            }

            const response = await axios.get(url, {
                headers,
                timeout: 10000,
                maxRedirects: 5,
                validateStatus: () => true,
                responseType: returnHeader ? 'stream' : 'text'
            });

            if (returnHeader) {
                return response.headers;
            }
            return response.data;
        } catch (error) {
            console.error(`Request failed for ${url}:`, error);
            return false;
        }
    }

    private async getRealUrl(url: string) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                maxRedirects: 5,
                timeout: 10000,
                validateStatus: (status) => status >= 200 && status < 400
            });
            return response.request.res.responseUrl || url;
        } catch (error) {
            return url;
        }
    }

    private extractId(url: string) {
        let match = url.match(/\/video\/(\d+)/);
        if (match) return match[1];

        match = url.match(/modal_id=(\d+)/);
        if (match) return match[1];

        match = url.match(/note\/(\d+)/);
        if (match) return match[1];

        match = url.match(/^(\d+)$/);
        if (match) return match[1];

        match = url.match(/\/share\/slides\/(\d+)/);
        if (match) return match[1];

        match = url.match(/\/share\/video\/(\d+)/);
        if (match) return match[1];

        return null;
    }

    public async parse(url: string) {
        if (!url) {
            return this.output(400, '请输入抖音链接');
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlMatch = url.match(urlRegex);
        if (urlMatch) {
            url = urlMatch[0];
        }

        let domain = '';
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            // ignore
        }

        if (domain === 'v.douyin.com' || !url.includes('douyin.com') || !this.extractId(url)) {
            url = await this.getRealUrl(url);
        }

        const id = this.extractId(url);
        if (!id) {
            return this.output(400, '链接格式错误，无法提取ID。处理后的链接: ' + url);
        }

        const apiUrl = `https://www.iesdouyin.com/share/video/${id}`;
        const html = await this.request(apiUrl, {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/122.0.0.0'
        });
        
        if (!html) {
            return this.output(500, '请求失败');
        }

        const data = this.extractJson(html);
        if (data) {
            return this.formatData(data);
        }

        return this.output(404, '解析失败，未找到有效内容');
    }

    private extractJson(html: string) {
        const startStr = '<script id="RENDER_DATA" type="application/json">';
        const endStr = '</script>';

        const posStart = html.indexOf(startStr);
        if (posStart === -1) {
            const pattern = /window\._ROUTER_DATA\s*=\s*(.*?)\<\/script>/s;
            const match = html.match(pattern);
            if (match) {
                try {
                    const json = JSON.parse(match[1]);
                    if (json.loaderData) {
                        const pageData = json.loaderData['video_(id)/page'] || json.loaderData['video_layout'];
                        if (pageData && pageData.videoInfoRes && pageData.videoInfoRes.item_list) {
                            return pageData.videoInfoRes.item_list[0];
                        }
                        for (const key in json.loaderData) {
                            if (key.startsWith('video_') && json.loaderData[key].videoInfoRes?.item_list?.[0]) {
                                return json.loaderData[key].videoInfoRes.item_list[0];
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse _ROUTER_DATA JSON", e);
                }
            }
            return null;
        }

        const jsonStrStart = html.substring(posStart + startStr.length);
        const posEnd = jsonStrStart.indexOf(endStr);
        if (posEnd === -1) {
            return null;
        }

        let jsonStr = jsonStrStart.substring(0, posEnd);
        jsonStr = decodeURIComponent(jsonStr);
        
        try {
            const data = JSON.parse(jsonStr);
            if (data?.app?.videoDetail) {
                return data.app.videoDetail;
            }
        } catch (e) {
            console.error("Failed to parse RENDER_DATA JSON", e);
        }

        return null;
    }

    private formatData(detail: any) {
        const result: any = {
            type: 'unknown',
            title: detail.desc || '',
            desc: detail.desc || '',
            author: {
                name: detail.authorInfo?.nickname || detail.author?.nickname || '',
                id: detail.authorInfo?.uid || detail.author?.uid || detail.author?.unique_id || '',
                avatar: detail.authorInfo?.avatarUri || detail.author?.avatar_thumb?.url_list?.[0] || detail.author?.avatar_medium?.url_list?.[0] || '',
            },
            cover: '',
            url: null,
            duration: detail.video?.duration || null,
            video_backup: null,
            images: [],
            live_photo: [],
            music: {
                title: detail.music?.musicName || detail.music?.title || '',
                author: detail.music?.ownerNickname || detail.music?.author || '',
                url: detail.music?.playUrl?.uri || detail.music?.play_url?.uri || '',
                cover: detail.music?.coverThumb?.urlList?.[0] || detail.music?.cover_thumb?.url_list?.[0] || ''
            }
        };

        let cover = '';
        if (detail.video?.originCover?.urlList?.[0]) cover = detail.video.originCover.urlList[0];
        else if (detail.video?.origin_cover?.url_list?.[0]) cover = detail.video.origin_cover.url_list[0];
        else if (detail.video?.originCover && typeof detail.video.originCover === 'string') cover = detail.video.originCover;
        else if (detail.video?.originCoverUrlList?.[0]) cover = detail.video.originCoverUrlList[0];
        
        if (!cover) {
            cover = detail.video?.cover?.urlList?.[0] || detail.video?.cover?.url_list?.[0] || '';
            if (!cover && typeof detail.video?.cover === 'string') cover = detail.video.cover;
        }

        if (!cover && detail.cover?.url_list?.[0]) cover = detail.cover.url_list[0];
        if (!cover) cover = detail.video?.dynamicCover?.urlList?.[0] || detail.video?.dynamic_cover?.url_list?.[0] || '';
        if (!cover && detail.videoInfoRes?.item_list?.[0]?.video?.cover?.url_list?.[0]) {
            cover = detail.videoInfoRes.item_list[0].video.cover.url_list[0];
        }

        result.cover = cover;

        const images = detail.images || [];
        if (images.length > 0) {
            result.type = 'image';
            for (const img of images) {
                const imgUrl = img.urlList?.[0] || img.url_list?.[0] || '';
                if (imgUrl) result.images.push(imgUrl);

                let liveVideoUrl = null;
                const videoInfo = img.video || {};

                if (videoInfo.playAddr && Array.isArray(videoInfo.playAddr)) {
                    let v26Candidate = null;
                    for (const addr of videoInfo.playAddr) {
                        if (addr.src) {
                            if (addr.src.includes('v3-web')) {
                                liveVideoUrl = addr.src;
                                break;
                            }
                            if (addr.src.includes('v26-web')) {
                                v26Candidate = addr.src;
                            }
                        }
                    }
                    if (!liveVideoUrl && v26Candidate) {
                        liveVideoUrl = v26Candidate.replace(/:\/\/([^\/]+)/, '://v26-luna.douyinvod.com');
                    }
                    if (!liveVideoUrl) {
                        liveVideoUrl = videoInfo.playAddr[1]?.src || videoInfo.playAddr[0]?.src || null;
                    }
                }

                if (!liveVideoUrl && videoInfo.play_addr?.url_list) {
                    const urlList = videoInfo.play_addr.url_list;
                    let v26Candidate = null;
                    for (const url of urlList) {
                        if (url.includes('v3-web')) {
                            liveVideoUrl = url;
                            break;
                        }
                        if (url.includes('v26-web')) {
                            v26Candidate = url;
                        }
                    }
                    if (!liveVideoUrl && v26Candidate) {
                        liveVideoUrl = v26Candidate.replace(/:\/\/([^\/]+)/, '://v26-luna.douyinvod.com');
                    }
                    if (!liveVideoUrl) {
                        liveVideoUrl = urlList[1] || urlList[0] || null;
                    }
                }

                if (!liveVideoUrl) {
                    liveVideoUrl = videoInfo.playApi || null;
                }

                if (liveVideoUrl) {
                    liveVideoUrl = liveVideoUrl.replace('playwm', 'play');
                    result.live_photo.push({
                        image: imgUrl,
                        video: liveVideoUrl
                    });
                }
            }

            if (result.live_photo.length > 0) {
                result.type = 'live';
            }
        } else {
            result.type = 'video';
            const videoInfo = this.extractHighestQualityVideo(detail);
            result.url = videoInfo.url;
            result.video_backup = videoInfo.backup;
            result.video_id = detail.video?.uri || detail.video?.play_addr?.uri || '';
        }

        return this.output(200, '解析成功', result);
    }

    private extractHighestQualityVideo(detail: any) {
        let url = null;
        let backup: string[] = [];

        if (detail.video?.bitRateList && Array.isArray(detail.video.bitRateList)) {
            const bitRateList = [...detail.video.bitRateList];
            bitRateList.sort((a, b) => (b.bitRate || 0) - (a.bitRate || 0));

            for (const rateItem of bitRateList) {
                const playAddr = rateItem.playAddr?.[0]?.src || rateItem.play_addr?.url_list?.[0] || null;
                if (playAddr) {
                    let candidates: string[] = [];
                    if (rateItem.playAddr && Array.isArray(rateItem.playAddr)) {
                        candidates = rateItem.playAddr.map((pa: any) => pa.src).filter(Boolean);
                    } else if (rateItem.play_addr?.url_list) {
                        candidates = rateItem.play_addr.url_list;
                    }

                    if (candidates.length === 0) continue;

                    let currentBestUrl = null;
                    let v3Link = null;
                    let v26Link = null;

                    for (const candidate of candidates) {
                        if (candidate.includes('v3-web')) {
                            v3Link = candidate;
                            break;
                        }
                        if (candidate.includes('v26-web')) {
                            v26Link = candidate;
                        }
                    }

                    if (v3Link) {
                        currentBestUrl = v3Link;
                    } else if (v26Link) {
                        currentBestUrl = v26Link.replace(/:\/\/([^\/]+)/, '://v26-luna.douyinvod.com');
                    } else {
                        currentBestUrl = candidates[0];
                    }

                    if (!url) {
                        url = currentBestUrl;
                    }

                    for (let candidate of candidates) {
                        if (candidate.includes('v26-web')) {
                            candidate = candidate.replace(/:\/\/([^\/]+)/, '://v26-luna.douyinvod.com');
                        }
                        if (candidate !== url && !backup.includes(candidate)) {
                            backup.push(candidate);
                        }
                    }
                }
                if (url && backup.length > 0) break;
            }
        }

        if (!url) {
            const uri = detail.video?.uri || detail.video?.play_addr?.uri || '';
            const playApi = detail.video?.playApi || detail.video?.play_addr?.url_list?.[0] || '';

            if (playApi) {
                url = playApi.replace('playwm', 'play');
            } else if (uri) {
                url = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=720p&line=0`;
            }

            const urlList = detail.video?.play_addr?.url_list || [];
            if (urlList.length > 1) {
                for (let i = 1; i < urlList.length; i++) {
                    backup.push(urlList[i].replace('playwm', 'play'));
                }
            }
        }

        return { url, backup };
    }
}
