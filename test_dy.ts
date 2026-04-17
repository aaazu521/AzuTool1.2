import axios from 'axios';

async function test() {
    const url = 'https://v.douyin.com/5sI9wCZbO7o/';
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        });
        const finalUrl = response.request?.res?.responseUrl || url;
        
        const match = finalUrl.match(/\/video\/(\d+)/) || finalUrl.match(/modal_id=(\d+)/) || finalUrl.match(/\/share\/video\/(\d+)/);
        
        if (match) {
            const id = match[1];
            const apiUrl = `https://www.iesdouyin.com/share/video/${id}`;
            const apiRes = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/122.0.0.0',
                }
            });
            const html = apiRes.data;
            const pattern = /window\._ROUTER_DATA\s*=\s*(.*?)\<\/script>/s;
            const match2 = html.match(pattern);
            if (match2) {
                const json = JSON.parse(match2[1]);
                const pageData = json.loaderData['video_(id)/page'];
                if (pageData && pageData.videoInfoRes && pageData.videoInfoRes.item_list) {
                    const video = pageData.videoInfoRes.item_list[0].video;
                    console.log("Video keys:", Object.keys(video || {}));
                    console.log("Play addr keys:", Object.keys(video?.play_addr || {}));
                    console.log("URI:", video?.play_addr?.uri);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

test();
