import axios from 'axios';

export interface MusicInfo {
    id: string;
    title: string;
    artist: string;
    album: string;
    cover: string;
    url: string;
    source: string;
    duration?: number;
}

export class MusicParser {
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

    async search(keyword: string, source: string = 'all'): Promise<MusicInfo[]> {
        const results = await Promise.all([
            this.searchMigu(keyword),
            this.searchKugou(keyword),
            this.searchNetease(keyword),
            this.searchKuwo(keyword)
        ]);
        return results.flat();
    }

    private async searchNetease(keyword: string): Promise<MusicInfo[]> {
        try {
            const url = `http://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=20`;
            const resp = await axios.get(url, { 
                headers: { 
                    'User-Agent': this.userAgent,
                    'Referer': 'http://music.163.com/'
                } 
            });
            const songs = resp.data?.result?.songs || [];
            
            return songs.map((s: any) => ({
                id: String(s.id),
                title: s.name,
                artist: s.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                album: s.album?.name || '',
                cover: s.album?.picUrl ? s.album.picUrl.replace('http://', 'https://') : '',
                url: `/api/music/parse/netease?id=${s.id}`,
                source: 'wy',
                mid: String(s.id),
                songmid: String(s.id),
                name: s.name,
                singer: s.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                albumName: s.album?.name || '',
            }));
        } catch (e) {
            console.error('Netease search error:', e);
            return [];
        }
    }

    async parseNeteaseUrl(id: string): Promise<{url: string, cover: string}> {
        try {
            // Priority 1: Generic music API (if available) - mimicking common bypass patterns
            const apis = [
                `https://music.163.com/api/song/enhance/player/url?id=${id}&ids=[${id}]&br=320000`,
                `http://music.163.com/api/song/enhance/player/url?id=${id}&ids=[${id}]&br=128000`
            ];

            let playUrl = '';
            for (const api of apis) {
                try {
                    const resp = await axios.get(api, {
                        headers: { 'User-Agent': this.userAgent, 'Referer': 'https://music.163.com/' },
                        timeout: 3000
                    });
                    if (resp.data?.data?.[0]?.url) {
                        playUrl = resp.data.data[0].url;
                        break;
                    }
                } catch (e) {}
            }
            
            // If API fails, fallback to outer link
            const finalUrl = playUrl || `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
            
            return { url: finalUrl, cover: '' };
        } catch (e) {
            console.error('Netease parse error:', e);
            return { url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`, cover: '' };
        }
    }

    private async searchKuwo(keyword: string): Promise<MusicInfo[]> {
        try {
            const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=15&uid=312456789&ver=kwplayer_ar_9.3.0.1&vipver=1&show_point=1&res=1&ft=music&encoding=utf8&rformat=json`;
            const resp = await axios.get(url, { headers: { 'User-Agent': this.userAgent } });
            
            let data = resp.data;
            if (typeof data === 'string') {
                try {
                    data = data.replace(/'/g, '"');
                    // Remove potential JSONP wrapper if present
                    if (data.startsWith('jsonp(')) data = data.substring(6, data.length - 1);
                    data = JSON.parse(data);
                } catch (pe) {
                    return [];
                }
            }

            const songs = data?.abslist || [];
            return songs.map((s: any) => {
                const rid = s.MUSICRID?.replace('MUSIC_', '') || '';
                return {
                    id: rid,
                    title: s.SONGNAME?.replace(/&nbsp;/g, ' '),
                    artist: s.ARTIST?.replace(/&nbsp;/g, ' '),
                    album: s.ALBUM?.replace(/&nbsp;/g, ' '),
                    cover: '', 
                    url: `/api/music/parse/kuwo?rid=${rid}`, 
                    source: 'kw',
                    rid: rid,
                    mid: rid,
                    songmid: rid,
                    copyrightId: rid,
                    name: s.SONGNAME?.replace(/&nbsp;/g, ' '),
                    singer: s.ARTIST?.replace(/&nbsp;/g, ' '),
                    albumName: s.ALBUM?.replace(/&nbsp;/g, ' '),
                };
            });
        } catch (e) {
            console.error('Kuwo search error:', e);
            return [];
        }
    }

    private async searchKugou(keyword: string): Promise<MusicInfo[]> {
        try {
            const url = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=15&showtype=1`;
            const resp = await axios.get(url, { headers: { 'User-Agent': this.userAgent } });
            const songs = resp.data?.data?.info || [];
            
            return songs.map((s: any) => ({
                id: s.hash,
                title: s.songname,
                artist: s.singername,
                album: s.album_name,
                cover: '', 
                url: `/api/music/parse/kugou?hash=${s.hash}`,
                source: 'kg',
                hash: s.hash,
                mid: s.hash,
                songmid: s.hash,
                albumId: s.album_id,
                name: s.songname,
                singer: s.singername,
                albumName: s.album_name,
            }));
        } catch (e) {
            console.error('Kugou search error:', e);
            return [];
        }
    }

    private async searchMigu(keyword: string): Promise<MusicInfo[]> {
        try {
            const url = `https://m.music.migu.cn/migu/remoting/scr_search_tag?rows=15&type=2&keyword=${encodeURIComponent(keyword)}&pgc=1`;
            const resp = await axios.get(url, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/04.1',
                    'Referer': 'https://m.music.migu.cn/'
                } 
            });
            const songs = resp.data?.musics || [];
            return songs.map((s: any) => ({
                id: s.copyrightId || s.id,
                title: s.songName,
                artist: s.artist,
                album: s.albumName,
                cover: s.cover || s.picL || s.picM || s.picS || '',
                url: `/api/music/parse/migu?id=${s.copyrightId || s.id}`,
                source: 'mg',
                copyrightId: s.copyrightId,
                copyright: s.copyrightId,
                mid: s.id,
                name: s.songName,
                singer: s.artist,
                albumName: s.albumName,
            }));
        } catch (e) {
            console.error('Migu search error:', e);
            return [];
        }
    }

    async parseKugouUrl(hash: string): Promise<{url: string, cover: string}> {
        try {
            // Priority 1: Multi-source Kugou APIs
            const apis = [
                `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`,
                `https://www.kugou.com/yy/index.php?r=play/getdata&hash=${hash}`,
                `http://trackercdn.kugou.com/i/v2/?cmd=26&key=${hash}&hash=${hash}&pid=1&behavior=play`
            ];

            let playUrl = '';
            let cover = '';

            for (const api of apis) {
                try {
                    const resp = await axios.get(api, { 
                        headers: { 'User-Agent': this.userAgent },
                        timeout: 3000
                    });
                    const d = resp.data;
                    const url = d.url || d.data?.play_url || d.url_list?.[0] || '';
                    if (url) {
                        playUrl = url;
                        cover = d.imgUrl?.replace('{size}', '400') || d.data?.img || cover;
                        break;
                    }
                } catch (e) {}
            }

            return { url: playUrl, cover };
        } catch (e) {
            console.error('Kugou parse error:', e);
            return { url: '', cover: '' };
        }
    }

    async parseMiguUrl(id: string): Promise<{url: string, cover: string}> {
        try {
            // Priority 1: Mobile playback API (often more reliable for free content)
            const mobileUrl = `https://m.music.migu.cn/migu/remoting/cms_detail_tag.do?copyrightId=${id}&resourceType=2`;
            const mResp = await axios.get(mobileUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/04.1',
                    'Referer': 'https://m.music.migu.cn/'
                }
            });
            
            let playUrl = '';
            let cover = '';
            
            if (mResp.data?.data) {
                const d = mResp.data.data;
                playUrl = d.listenUrl || d.playUrl || d.hqListenUrl || '';
                cover = d.picL || d.picM || d.picS || '';
            }

            if (!playUrl) {
                // Priority 2: Standard play info API
                const url = `https://music.migu.cn/v3/api/music/audioPlayer/getPlayInfo?copyrightId=${id}`;
                const resp = await axios.get(url, {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Referer': 'https://music.migu.cn/v3/music/player'
                    }
                });
                const data = resp.data?.data;
                playUrl = data?.playUrl || '';
                cover = cover || data?.picL || data?.picM || '';
            }

            if (playUrl && playUrl.startsWith('//')) {
                playUrl = 'https:' + playUrl;
            }

            return { url: playUrl, cover };
        } catch (e) {
            console.error('Migu parse error:', e);
            return { url: '', cover: '' };
        }
    }

    async parseKuwoUrl(rid: string): Promise<{url: string, cover: string}> {
        try {
            // Priority 1: Try multiple conversion APIs for Kuwo
            const apis = [
                `http://antiserver.kuwo.cn/anti.s?format=mp3&rid=MUSIC_${rid}&type=convert_url&response=res`,
                `http://www.kuwo.cn/api/v1/book/resource/musicUrl?mid=${rid}&type=1`,
                `https://nmobi.kuwo.cn/mobi.s?f=kuwo&q=${Buffer.from(`type=get_music_info&rid=${rid}`).toString('base64')}`
            ];

            let playUrl = '';
            for (const api of apis) {
                try {
                    const resp = await axios.get(api, { 
                        headers: { 'User-Agent': this.userAgent },
                        timeout: 3000
                    });
                    if (typeof resp.data === 'string' && resp.data.startsWith('http')) {
                        playUrl = resp.data;
                        break;
                    } else if (resp.data?.data?.url) {
                        playUrl = resp.data.data.url;
                        break;
                    }
                } catch (err) {}
            }
            
            // Get cover separately for Kuwo
            let cover = '';
            try {
                const detailUrl = `http://player.kuwo.cn/webmusic/st/getMuiseByRid?rid=MUSIC_${rid}`;
                const detailResp = await axios.get(detailUrl);
                const coverMatch = detailResp.data.match(/<artist_pic>(.*?)<\/artist_pic>/);
                const coverMatch2 = detailResp.data.match(/<img>(.*?)<\/img>/);
                if (coverMatch) cover = coverMatch[1];
                else if (coverMatch2) cover = coverMatch2[1];
            } catch (err) {}

            return { url: playUrl, cover: cover };
        } catch (e) {
            console.error('Kuwo parse error:', e);
            return { url: '', cover: '' };
        }
    }
}
