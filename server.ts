import express from "express";
// import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { XiaohongshuParser } from "./server/xhsParser.js";
import { DouyinParser } from "./server/dyParser.js";
import { MusicParser } from "./server/musicParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

// Xiaohongshu Parser API
app.get("/api/parse/xhs", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const parser = new XiaohongshuParser();
      // You can set a default cookie here if needed
      // parser.setCookie("your_cookie_here");
      const result = await parser.parse(url);
      res.json(result);
    } catch (error: any) {
      console.error("XHS Parse error:", error.message);
      res.status(500).json({ error: "Parse failed", details: error.message });
    }
  });

  // Kuaishou Parser API
  app.get("/api/parse/ks", async (req, res) => {
    let url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ code: 201, msg: "url为空" });
    }

    // 提取文本中的第一个 URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = url.match(urlRegex);
    if (urlMatch) {
        url = urlMatch[0];
    }

    try {
      const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/122.0.0.0';
      
      // 1. Get redirected URL
      const redirectRes = await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
      });
      const finalUrl = redirectRes.request.res.responseUrl || url;

      // 2. Fetch page content
      const pageRes = await axios.get(finalUrl, {
          headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9',
          }
      });
      const html = pageRes.data;

      // 3. Extract INIT_STATE
      const initStateMatch = html.match(/window\.INIT_STATE\s*=\s*(.*?)\<\/script>/s);
      if (initStateMatch) {
          let jsonString = initStateMatch[1].trim().replace(/;$/, '');
          // Basic cleanup for known JSON issues in KS
          jsonString = jsonString.replace(/"{"err_msg":"launchApplication:fail"}"/g, '"err_msg","launchApplication:fail"');
          jsonString = jsonString.replace(/"{"err_msg":"system:access_denied"}"/g, '"err_msg","system:access_denied"');
          
          try {
              const data = JSON.parse(jsonString);
              // Find tusjoh key
              let photoData = null;
              for (const key in data) {
                  if (key.startsWith('tusjoh') && (data[key].fid || data[key].photo)) {
                      photoData = data[key].photo;
                      break;
                  }
              }

              if (photoData) {
                  const authorName = photoData.userName || '';
                  const authorAvatar = photoData.headUrl || '';
                  const title = photoData.caption || '';
                  const cover = photoData.coverUrls?.[0]?.url || '';

                  // Check for images (atlas)
                  const imageList = photoData.ext_params?.atlas?.list || [];
                  if (imageList.length > 0) {
                      return res.json({
                          code: 200,
                          msg: '解析成功',
                          data: {
                              type: 'image',
                              title,
                              desc: title,
                              author: { name: authorName, avatar: authorAvatar },
                              cover: cover || ('http://tx2.a.yximgs.com/' + imageList[0]),
                              images: imageList.map((path: string) => 'http://tx2.a.yximgs.com/' + path)
                          }
                      });
                  }

                  // Check for video
                  let videoUrl = photoData.mainMvUrls?.[0]?.url;
                  if (!videoUrl && photoData.manifest?.adaptationSet?.[0]?.representation?.[0]?.url) {
                      videoUrl = photoData.manifest.adaptationSet[0].representation[0].url;
                  }

                  if (videoUrl) {
                      return res.json({
                          code: 200,
                          msg: '解析成功',
                          data: {
                              type: 'video',
                              title,
                              desc: title,
                              author: { name: authorName, avatar: authorAvatar },
                              cover,
                              url: videoUrl
                          }
                      });
                  }
                  
                  // Single image fallback
                  if (photoData.photoType === 'SINGLE_PICTURE' || photoData.singlePicture) {
                      return res.json({
                          code: 200,
                          msg: '解析成功',
                          data: {
                              type: 'image',
                              title,
                              desc: title,
                              author: { name: authorName, avatar: authorAvatar },
                              cover,
                              images: [cover]
                          }
                      });
                  }
              }
          } catch (e) {
              console.error("KS JSON Parse Error:", e);
          }
      }

      // 4. Fallback to APOLLO_STATE
      const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(.*?)\<\/script>/s);
      if (apolloMatch) {
          let cleanedData = apolloMatch[1].replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '""');
          cleanedData = cleanedData.replace(/,\s*(?=}|])/g, '');
          cleanedData = cleanedData.replace(/;(:());/g, '');
          try {
              const apolloState = JSON.parse(cleanedData);
              const defaultClient = apolloState.defaultClient;
              if (defaultClient) {
                  let videoData: any = null;
                  let authorData: any = null;
                  for (const key in defaultClient) {
                      if (key.startsWith('VisionVideoDetailPhoto:')) videoData = defaultClient[key];
                      if (key.startsWith('VisionVideoDetailAuthor:')) authorData = defaultClient[key];
                  }
                  if (videoData) {
                      const isPhoto = finalUrl.includes('/photo/');
                      const videoUrl = videoData.photoUrl || (videoData.manifestH265?.json?.adaptationSet?.[0]?.representation?.[0]?.backupUrl?.[0]);
                      if (videoUrl) {
                          return res.json({
                              code: 200,
                              msg: '解析成功',
                              data: {
                                  type: isPhoto ? 'image' : 'video',
                                  title: videoData.caption || '',
                                  desc: videoData.caption || '',
                                  author: { name: authorData?.name || '', avatar: authorData?.headerUrl || '' },
                                  cover: videoData.coverUrl || '',
                                  url: videoUrl,
                                  images: isPhoto ? [videoUrl] : []
                              }
                          });
                      }
                  }
              }
          } catch (e) {
              console.error("KS Apollo Parse Error:", e);
          }
      }

      res.status(404).json({ code: 404, msg: '未找到有效媒体信息' });
    } catch (error: any) {
      console.error("KS Parse error:", error.message);
      res.status(500).json({ code: 500, msg: "解析失败", details: error.message });
    }
  });

  // Douyin Parser API
  app.get("/api/parse/dy", async (req, res) => {
    let url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ code: 201, msg: "url为空" });
    }

    try {
      const parser = new DouyinParser();
      // You can set a default cookie here if needed
      parser.setCookie("enter_pc_once=1; UIFID_TEMP=30ff7b230d01f3ed4fd5546706fc508e0725b8a99e0ba4197a991a959864baf0c32aa30164ac8af84f6850f775740b66ccaf2cba797c12e1ee5cefb9701f87d8971bfd0f85fcb44326f294ff24460184; hevc_supported=true; fpk1=U2FsdGVkX19XcHOfOcqklLLiPIWpPLnuwHDYWU+jPUs26JWVD1Kqi1X6ANlCHonMOxilj6TvLqdq0n2SyaBfNw==; fpk2=7ceed19ee5ebdbf792f56329591ffc53; UIFID=30ff7b230d01f3ed4fd5546706fc508e0725b8a99e0ba4197a991a959864baf0c32aa30164ac8af84f6850f775740b66a5e66530b389cb4b118d0c55d7ef662da0064f365bb9ee95ec23336eda0b51137dac0939d86e171884eb3189b5054e368b3e87dc4068aa3756d3e1d1224606d022fdf8268cee29e3a5375cbfa8913460b035ff8e0c80b54a2e9f0eb25e42e7c89d202dfb9636720cf4df5f10ed6dd5da; xgplayer_user_id=285261502704; n_mh=0ga9K6lSKC8huXo7FkVXrp6XEjSSaw8XkOUhpxJZdTc; SelfTabRedDotControl=%5B%5D; xgplayer_device_id=11528948447; live_use_vvc=%22false%22; my_rd=2; PhoneResumeUidCacheV1=%7B%2282866673835%22%3A%7B%22time%22%3A1767581990529%2C%22noClick%22%3A1%7D%7D; __ac_signature=_02B4Z6wo00f01ibEe7gAAIDBq2zCMSuHMVIm5H8AAOD66a; s_v_web_id=verify_mnzn39vn_wnivrMw7_ZoKe_4wJ1_9kIR_ZebvmjtOwdMK; douyin.com; xg_device_score=7.153619843857767; device_web_cpu_core=4; device_web_memory_size=8; architecture=amd64; dy_swidth=1920; dy_sheight=1080; strategyABtestKey=%221776232710.271%22; is_staff_user=false; passport_csrf_token=bc13d9a1c1cb112689b015bbbe379f87; passport_csrf_token_default=bc13d9a1c1cb112689b015bbbe379f87; bd_ticket_guard_client_web_domain=2; sdk_source_info=7e276470716a68645a606960273f276364697660272927676c715a6d6069756077273f276364697660272927666d776a68605a607d71606b766c6a6b5a7666776c7571273f275e5927666d776a686028607d71606b766c6a6b3f2a2a6a61756d6b676d6c61616d61756a6666676c64696969606f64646f6068616c6a2a7666776c7571762a6c6b76756066716a772b6f76592758272927666a6b766a69605a696c6061273f27636469766027292762696a6764695a7364776c6467696076273f275e582729277672715a646971273f2763646976602729277f6b5a666475273f2763646976602729276d6a6e5a6b6a716c273f2763646976602729276c6b6f5a7f6367273f27636469766027292771273f2734323c33313237363733323234272927676c715a75776a716a666a69273f2763646976602778; bit_env=rHzxgPRGa19-wC0cc34XBVuQm6f8UCiLcQS_u2KT5oZMFewpHScZZs4pZDB1Qo1j15G7H3JDeIyc0tpQJljQK0-kIwBfPvba7fluv7tuOrwco4q7FfwQmfB9jv9k4p2_UzhDRjq2XERDq0lkWplp8tX2yKGHDW2JRLtYS-wwrM6ezxdyFsc0d4EinQJInTz4n1i5UpjK7h6pedzWIePuSfHYt5ffSC01G173GQVYLnW9hUgbvuY6Zeq378E6nl9rB6-lQNh7hc5O5r0AE19PkZN15790W1fjCdTilbzK1zD8axLVhbL64uKwvWk_V8A40sJZAm5UzSu08IygjzGBGI-CsxYZKwpGjkwq0sLv-Zo5TWbIihs5h3u_KMYuh2nPpwrpFp14R8OhMsmFEPL3OcPCnPqtEuaBIkp1RpdEHWACU3gexZq32KZHlewjHEXm3kCW2usDB5YXUpxc7UkLObyrhFUsb9aBZSvQLA5bLxGkj_orAFZUEVb6EdTZreEPU0_fkU30YyVTi_Fas68YV9jnJ8BqkHIWt2kxsCYASA0%3D; gulu_source_res=eyJwX2luIjoiZWQ4OTJkZTQxNGQ4NGI4MzgwNWEwYjA4MDY3MTA0MzU4MTFlNGFjOGQyYzEwZjAxMjZiMTJiYjAzYTEyZDlkNCJ9; passport_auth_mix_state=fd86rfmvaw63palr82w35xw9aiqguliz; passport_assist_user=Cjzv7vO0kqwYgVJerIenfFH8g5fMctwP0GsGiqkM0S8sxgyQa6QKx0bYmwi9EQrZXsQ_lbfkZLeuKaoW4RMaSgo8AAAAAAAAAAAAAFBORAVob6PPjCkGjiEkuIgaE3U2V1ReDg8BBtK6tr-ldb3xOYpI94dJlrq1p4pwzJasELTujg4Yia_WVCABIgEDP6KEYw%3D%3D; sid_guard=14a4ba330963342ccf96807ad185d65d%7C1776232765%7C5184000%7CSun%2C+14-Jun-2026+05%3A59%3A25+GMT; uid_tt=92eddd9aae94b5bea0bd45d73cc3639a; uid_tt_ss=92eddd9aae94b5bea0bd45d73cc3639a; sid_tt=14a4ba330963342ccf96807ad185d65d; sessionid=14a4ba330963342ccf96807ad185d65d; sessionid_ss=14a4ba330963342ccf96807ad185d65d; session_tlb_tag=sttt%7C5%7CFKS6MwljNCzPloB60YXWXf_________BRqW19pNMB94njCzxEm4l4fdNa75pwh7cTRSTHbiGN5M%3D; has_biz_token=false; sid_ucp_v1=1.0.0-KGEyNzY0ZWYxZGIyYWMxZGQ3MmM4NzI5YWE0N2Y1YWQ5NTQ2MzQzNjEKHwirsfTZtAIQvdL8zgYY7zEgDDCIyIjSBTgHQPQHSAQaAmxmIiAxNGE0YmEzMzA5NjMzNDJjY2Y5NjgwN2FkMTg1ZDY1ZA; ssid_ucp_v1=1.0.0-KGEyNzY0ZWYxZGIyYWMxZGQ3MmM4NzI5YWE0N2Y1YWQ5NTQ2MzQzNjEKHwirsfTZtAIQvdL8zgYY7zEgDDCIyIjSBTgHQPQHSAQaAmxmIiAxNGE0YmEzMzA5NjMzNDJjY2Y5NjgwN2FkMTg1ZDY1ZA; _bd_ticket_crypt_cookie=248c14e64688111e1a4f654a7b1c6f09; __security_mc_1_s_sdk_sign_data_key_web_protect=e44de7ab-4413-9563; __security_mc_1_s_sdk_cert_key=51c1c732-4b08-9d32; __security_mc_1_s_sdk_crypt_sdk=58c44aba-4cb5-8fa0; __security_server_data_status=1; login_time=1776232764953; DiscoverFeedExposedAd=%7B%7D; stream_recommend_feed_params=%22%7B%5C%22cookie_enabled%5C%22%3Atrue%2C%5C%22screen_width%5C%22%3A1920%2C%5C%22screen_height%5C%22%3A1080%2C%5C%22browser_online%5C%22%3Atrue%2C%5C%22cpu_core_num%5C%22%3A4%2C%5C%22device_memory%5C%22%3A8%2C%5C%22downlink%5C%22%3A10%2C%5C%22effective_type%5C%22%3A%5C%224g%5C%22%2C%5C%22round_trip_time%5C%22%3A100%7D%22; FOLLOW_LIVE_POINT_INFO=%22MS4wLjABAAAA93SERamqvGLc4Mz36jjkXBPNddtANOgLLFsCNVmGw34%2F1776268800000%2F0%2F1776232773961%2F0%22; bd_ticket_guard_client_data=eyJiZC10aWNrZXQtZ3VhcmQtdmVyc2lvbiI6MiwiYmQtdGlja2V0LWd1YXJkLWl0ZXJhdGlvbi12ZXJzaW9uIjoxLCJiZC10aWNrZXQtZ3VhcmQtcmVlLXB1YmxpYy1rZXkiOiJCSWRUaGV5YVRtVU9GRUJ4akNnZjFUSXhUWTM3eGZxVitQRTF6SVlLQVNlUks2SkJxRnFzRktFRXJMZ2lNTVhVZjBLSXFsc2taVTFiNFFCWkJYRkZJY009IiwiYmQtdGlja2V0LWd1YXJkLXdlYi12ZXJzaW9uIjoyfQ%3D%3D; publish_badge_show_info=%220%2C0%2C0%2C1776232777628%22; biz_trace_id=f1131e31; ttwid=1%7Cb_ykHlOJQYOB4uGqsXe2IsDXuNVLQ7BHsVHCSnU7bWU%7C1776232781%7C93ba413f6186dccf17d9c426709e8ef56d9e8d649b2f9ad29e6bdd96a8d0a0b6; bd_ticket_guard_client_data_v2=eyJyZWVfcHVibGljX2tleSI6IkJJZFRoZXlhVG1VT0ZFQnhqQ2dmMVRJeFRZMzd4ZnFWK1BFMXpJWUtBU2VSSzZKQnFGcXNGS0VFckxnaU1NWFVmMEtJcWxza1pVMWI0UUJaQlhGRkljTT0iLCJ0c19zaWduIjoidHMuMi4xOTEyNTk5Y2UxYTg3MzRkMjQ2ZTEyYjFkOTUyZTJjMTY4ZTNmMzkxMzcwZmEyMDZhNmE2YzFkNTlmNDI4ODdlYzRmYmU4N2QyMzE5Y2YwNTMxODYyNGNlZGExNDkxMWNhNDA2ZGVkYmViZWRkYjJlMzBmY2U4ZDRmYTAyNTc1ZCIsInJlcV9jb250ZW50Ijoic2VjX3RzIiwicmVxX3NpZ24iOiJobGR2U2srL216NFBJU094RmJWUldwNWJJQUJiQS8zSmJhUnhCYkFDMDdVPSIsInNlY190cyI6IiNFcXNiNTRHak0wM3ZKMDlUZTh2cG40MzI4U3NqVWpWSk1acE5QNk16b0NWY3Urd1E0NzlPV2ZrUHZuak4ifQ%3D%3D; is_dash_user=1; IsDouyinActive=false; home_can_add_dy_2_desktop=%220%22; odin_tt=b947abae1e74d02bc78af953cdc78c0a339a6e5f759a061ce6b80b0c30662d611a90cb78091d5cb2be73eb84381f7790");
      const result = await parser.parse(url);
      res.json(result);
    } catch (error: any) {
      console.error("DY Parse error:", error.message);
      res.status(500).json({ code: 500, msg: "解析失败", details: error.message });
    }
  });

  // --- LX MUSIC OPEN API SERVICE ---
  let currentPlayerStatus: any = {
    status: "stoped",
    name: "",
    singer: "",
    albumName: "",
    duration: 0,
    progress: 0,
    playbackRate: 1,
    picUrl: "",
    lyricLineText: "",
    lyric: "",
    tlyric: "",
    rlyric: "",
    lxlyric: "",
    collect: false,
    volume: 100,
    mute: false
  };

  const statusSubscribers: any[] = [];
  const controlSubscribers: any[] = [];

  const broadcastStatus = (field: string, value: any) => {
    statusSubscribers.forEach(res => {
        res.write(`event: ${field}\n`);
        res.write(`data: ${JSON.stringify(value)}\n\n`);
    });
  };

  // Internal endpoint for Frontend to sync status
  app.post("/api/music/state-report", express.json(), (req, res) => {
    const newState = req.body;
    Object.keys(newState).forEach(key => {
        if (currentPlayerStatus[key] !== newState[key]) {
            currentPlayerStatus[key] = newState[key];
            broadcastStatus(key, newState[key]);
        }
    });
    res.json({ success: true });
  });

  // Internal SSE for Frontend to receive controls
  app.get("/api/music/control-sse", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    controlSubscribers.push(res);
    req.on('close', () => {
        const index = controlSubscribers.indexOf(res);
        if (index > -1) controlSubscribers.splice(index, 1);
    });
  });

  const sendControl = (action: string, data: any = null) => {
    controlSubscribers.forEach(res => {
        res.write(`data: ${JSON.stringify({ action, data })}\n\n`);
    });
  };

  // LX Open API: /status
  app.get("/status", (req, res) => {
    const filter = req.query.filter as string;
    if (!filter) return res.json(currentPlayerStatus);
    
    const fields = filter.split(',');
    const filtered: any = {};
    fields.forEach(f => {
        if (currentPlayerStatus[f] !== undefined) filtered[f] = currentPlayerStatus[f];
    });
    res.json(filtered);
  });

  // LX Open API: /lyric
  app.get("/lyric", (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(currentPlayerStatus.lyric || "");
  });

  // LX Open API: /lyric-all
  app.get("/lyric-all", (req, res) => {
    res.json({
        lyric: currentPlayerStatus.lyric || "",
        tlyric: currentPlayerStatus.tlyric || "",
        rlyric: currentPlayerStatus.rlyric || "",
        lxlyric: currentPlayerStatus.lxlyric || ""
    });
  });

  // LX Open API: SSE status subscription
  app.get("/subscribe-player-status", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    statusSubscribers.push(res);
    
    // Send initial state
    Object.entries(currentPlayerStatus).forEach(([key, value]) => {
        res.write(`event: ${key}\n`);
        res.write(`data: ${JSON.stringify(value)}\n\n`);
    });

    req.on('close', () => {
        const index = statusSubscribers.indexOf(res);
        if (index > -1) statusSubscribers.splice(index, 1);
    });
  });

  // LX Open API: Control endpoints
  app.get("/play", (req, res) => { sendControl('play'); res.json({ success: true }); });
  app.get("/pause", (req, res) => { sendControl('pause'); res.json({ success: true }); });
  app.get("/skip-next", (req, res) => { sendControl('skip-next'); res.json({ success: true }); });
  app.get("/skip-prev", (req, res) => { sendControl('skip-prev'); res.json({ success: true }); });
  app.get("/seek", (req, res) => { sendControl('seek', req.query.offset); res.json({ success: true }); });
  app.get("/volume", (req, res) => { sendControl('volume', req.query.volume); res.json({ success: true }); });
  app.get("/mute", (req, res) => { sendControl('mute', req.query.mute === 'true'); res.json({ success: true }); });
  app.get("/collect", (req, res) => { sendControl('collect'); res.json({ success: true }); });
  app.get("/uncollect", (req, res) => { sendControl('uncollect'); res.json({ success: true }); });

  // Music API
  const musicParser = new MusicParser();

  app.get("/api/music/search", async (req, res) => {
    const keyword = req.query.keyword as string;
    if (!keyword) return res.status(400).json({ error: "Keyword is required" });
    try {
      const results = await musicParser.search(keyword);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/music/parse/netease", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID is required" });
    try {
      const data = await musicParser.parseNeteaseUrl(id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: "Parse failed" });
    }
  });

  app.get("/api/music/parse/kuwo", async (req, res) => {
    const rid = req.query.rid as string;
    if (!rid) return res.status(400).json({ error: "RID is required" });
    try {
      const data = await musicParser.parseKuwoUrl(rid);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: "Parse failed" });
    }
  });

  app.get("/api/music/parse/kugou", async (req, res) => {
    const hash = req.query.hash as string;
    if (!hash) return res.status(400).json({ error: "Hash is required" });
    try {
      const data = await musicParser.parseKugouUrl(hash);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: "Parse failed" });
    }
  });

  app.get("/api/music/parse/migu", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID is required" });
    try {
      const data = await musicParser.parseMiguUrl(id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: "Parse failed" });
    }
  });

  // API Proxy for Q-bind query
  app.post("/api/q-bind", async (req, res) => {
    const { qq } = req.body;
    if (!qq) {
      return res.status(400).json({ error: "QQ number is required" });
    }

    try {
      const response = await axios.post(
        "https://avsov.com/qq_tel",
        `qq=${qq}`,
        {
          headers: {
            "Host": "avsov.com",
            "Connection": "keep-alive",
            "sec-ch-ua-platform": "Android",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36",
            "Accept": "application/json",
            "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
            "Content-Type": "application/x-www-form-urlencoded",
            "sec-ch-ua-mobile": "?1",
            "Origin": "https://avsov.com",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Referer": "https://avsov.com/qq_tel.html",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cookie": "_ga=GA1.1.301516917.1764221461; __gads=ID=e7b4049f89aba36f:T=1764221462:RT=1776154631:S=ALNI_MYkYmYm8UsTvV97iixC4sbFeOpPhQ; __gpi=UID=00001314283d3e9d:T=1764221462:RT=1776154631:S=ALNI_Ma2jERACbG4iL6aIBj-s--IrGikoA; __eoi=ID=59bde5465fe20cd6:T=1764221462:RT=1776154631:S=AA-AfjYURMMOL_UgQUzHl4eAoJAw; FCCDCF=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B32%2C%22%5B%5C%2202be7607-ea23-4eaf-88f1-fc7058cb2ce5%5C%22%2C%5B1764221463%2C560000000%5D%5D%22%5D%5D%5D; PHPSESSID=738969b193825ab922911f688de552d8; server_name_session=ae13ab77b222ba8cd7adc07fbfd646bd; FCNEC=%5B%5B%22AKsRol_JXnFSWGmQIsowqXM3solqJ3gufVZVke5Yzjn4MSYch7XY3LZbW3w7OBU4wF95idcgwRY96DqFHGACBJ3f9HlQ59qXptc1RNHA5cZgF0CQR1mvxz9hcs4-ZdcVq39lJsArfMpSCKaewDLlH2dZG6fTG1kvVw%3D%3D%22%5D%5D; _ga_0GZ30XPSWD=GS2.1.s1776154630$o7$g1$t1776154720$j60$l0$h0; cf_clearance=6aZYtet0R.SvjFtJ2cD5tIlFnxDoslNcLvVQS9rC05s-1776154720-1.2.1.1-Jov5grBwrYcmztP.dJkkGdrwttQPV3S.WpLb8tzSvT2ahIPPy.AOAsZr2xY2AzCIwhvuhEoOM.HUOia938g1YhqQebftqiyKc9dAuM.ZklQz7ccw4uz7Lz0XqTgf..6m9YJQd5BDBgS1ISwBHi3ddMYZCx59GeWaiy15aMoplMQE1orftGIDCvJZ8NtAzhP4OzBJg8Z9tmgTpJ1vGqh7EnWtN_hawiqGfuI0YOiX_5M_AsNyjkGeZiOk0OWyrCgQcCUd61SbgEJPN4UR_jW.mpnyn6AtwS110G0z8cLy_ebhTO0qIU4ndZHoQ8ZnIzW1utDLf30XxMCrGvjDGeerUA"
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Q-bind query error:", error.message);
      res.status(500).json({ error: "Query failed", details: error.message });
    }
  });

  // Generic Proxy for Media/API requests to bypass CORS and Mixed Content (HTTP on HTTPS)
  app.post("/api/music/bridge", express.json(), async (req, res) => {
    const { url, method = 'GET', headers = {}, body, timeout = 10000, params } = req.body;
    
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Reject non-HTTP(S) protocols (like javascript:, ws:, etc.)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: `Unsupported protocol in URL: ${url}` });
    }

    // Better filtering: drop problematic domains before fetch
    if (url.includes('api.huibq.com') || url.includes('api.lingchuan.com') || url.includes('invalid-url.com') || url.includes('blocked.api')) {
      return res.status(200).json({
        data: null, // Return empty, clean response
        status: 200, 
        headers: { 'content-type': 'application/json' }
      });
    }

    try {
      // Clean headers to avoid conflicts
      const cleanHeaders = { ...headers };
      delete cleanHeaders.host;
      delete cleanHeaders.origin;
      
      // If the caller provided a referer, keep it. 
      // Otherwise, the naturally sent referer will be used.
      
      // Default User-Agent if not provided
      if (!cleanHeaders['User-Agent'] && !cleanHeaders['user-agent']) {
          cleanHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      }

      // Handle form data if body is an object and content-type is form-urlencoded
      let requestData = body;
      const contentType = (cleanHeaders['Content-Type'] || cleanHeaders['content-type'] || '').toLowerCase();
      if (contentType.includes('application/x-www-form-urlencoded') && typeof body === 'object') {
          const qs = (await import('qs')).default;
          requestData = qs.stringify(body);
      }

      const response = await axios({
        url,
        method,
        headers: cleanHeaders,
        params,
        data: requestData,
        timeout,
        validateStatus: () => true, // Forward all statuses
        maxRedirects: 10,
        responseType: 'arraybuffer' // Get raw bytes for maximum compatibility
      });

      console.log(`[Bridge] ${method} ${url} -> Status: ${response.status}`);

      // Detect if the content is likely text/json
      let responseBody = response.data;
      const respContentType = (response.headers['content-type'] || '').toLowerCase();
      if (respContentType.includes('json') || respContentType.includes('text') || respContentType.includes('javascript') || respContentType.includes('xml')) {
          responseBody = Buffer.from(response.data).toString('utf8');
          try {
              // If it's pure JSON string, keep it as object for axios-like behavior in the bridge
              if (respContentType.includes('json')) {
                  responseBody = JSON.parse(responseBody);
              }
          } catch (e) {
              // Fallback to string
          }
      } else {
          // For binary or other, send as base64 or similar? 
          // Most LX scripts expect JSON or Text for APIs.
          responseBody = Buffer.from(response.data).toString('base64');
      }

      res.status(200).json({
        data: responseBody,
        status: response.status,
        headers: response.headers
      });
    } catch (error: any) {
      console.error('Music bridge error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    // Reject non-HTTP(S) protocols
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return res.status(400).json({ error: "Unsupported protocol" });
    }

    // Prevent infinite proxy loops
    if (targetUrl.includes(req.hostname) && targetUrl.includes('/api/proxy')) {
      return res.status(400).json({ error: "Infinite proxy loop detected" });
    }

    try {
      const isPreload = req.query.preload === 'true';
      const downloadName = req.query.download as string;
      
      console.log(`Proxying request to: ${targetUrl} (Download: ${downloadName})`);
      
      let referer = '';
      let origin = '';
      
      if (targetUrl.includes('xiaohongshu.com') || targetUrl.includes('xhscdn.com')) {
          referer = 'https://www.xiaohongshu.com/';
          origin = 'https://www.xiaohongshu.com';
      } else if (targetUrl.includes('douyin.com') || targetUrl.includes('snssdk.com') || targetUrl.includes('iesdouyin.com')) {
          referer = 'https://www.douyin.com/';
          origin = 'https://www.douyin.com';
      } else if (targetUrl.includes('kuaishou.com') || targetUrl.includes('yximgs.com')) {
          referer = 'https://www.kuaishou.com/';
          origin = 'https://www.kuaishou.com';
      } else if (targetUrl.includes('163.com')) {
          referer = 'http://music.163.com/';
      } else if (targetUrl.includes('kuwo.cn')) {
          referer = 'http://www.kuwo.cn/';
      } else if (targetUrl.includes('kugou.com')) {
          referer = 'http://www.kugou.com/';
      } else if (targetUrl.includes('migu.cn')) {
          referer = 'https://m.music.migu.cn/';
      } else if (targetUrl.includes('jitsu.top')) {
          referer = 'https://moe.jitsu.top/';
      }
      
      const headers: any = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': targetUrl.includes('video') ? 'video' : 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
          'Connection': 'keep-alive'
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }
      
      if (referer) headers['Referer'] = referer;
      if (origin) headers['Origin'] = origin;
      
      // Support custom headers passed via query (for custom music engines)
      if (req.query.headers) {
          try {
              const customHeaders = JSON.parse(req.query.headers as string);
              // Normalize headers (case-insensitive keys are usually best but object.assign is fine)
              Object.assign(headers, customHeaders);
          } catch (e) {
              console.warn("Failed to parse custom proxy headers", e);
          }
      }

      // Some platforms require specific User-Agents for mobile links
      if (targetUrl.includes('m.music.migu.cn') || targetUrl.includes('m.kugou.com')) {
          headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/04.1';
      }

      // Increase timeout for slow image proxies
      const timeoutMs = (downloadName ? 60000 : (targetUrl.includes('jitsu.top') ? 60000 : 20000));
      
      const response = await axios.get(targetUrl, {
        responseType: 'stream',
        timeout: timeoutMs, 
        headers: headers,
        maxRedirects: 15,
        validateStatus: () => true, 
        decompress: true 
      });

      if (response.status >= 500) {
          console.warn(`[Proxy] Target ${targetUrl} returned ${response.status}`);
      }

      // Log if we got a redirect status but axios already handled it
      if (response.status >= 300 && response.status < 400) {
          console.log(`Proxy redirect handled: ${targetUrl} -> ${response.headers.location}`);
      }

      res.status(response.status);

      const responseHeaders = response.headers;
      
      if (downloadName) {
        res.setHeader('Content-Type', 'application/octet-stream');
        const safeName = encodeURIComponent(downloadName);
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
      } else {
        const headersToForward = [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
          'cache-control'
        ];
        headersToForward.forEach(h => {
          if (responseHeaders[h]) {
            res.setHeader(h, responseHeaders[h]);
          }
        });
      }
      
      // Handle stream errors
      const stream = response.data;
      stream.on('error', (err: any) => {
        // Only log if it's not a normal abortion
        if (err.code !== 'ECONNRESET' && err.message !== 'aborted') {
          console.error(`Stream error for ${targetUrl}:`, err.message);
        }
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      // Handle client disconnection to prevent "Stream error: aborted" noise
      req.on('close', () => {
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
      });

      // Pipe the stream directly to the response
      stream.pipe(res);
    } catch (error: any) {
      console.error(`Proxy error for ${targetUrl}:`, error.message);
      if (!res.headersSent) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          res.status(504).json({ error: "Gateway Timeout", details: "The target server took too long to respond." });
        } else {
          res.status(500).json({ error: "Proxy request failed", details: error.message });
        }
      }
    }
  });

// Vite middleware for development
async function startViteOrStatic() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startViteOrStatic();

export default app;
