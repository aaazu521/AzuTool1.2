import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import useLocalStorage from './useLocalStorage';
import { fetchWebsitesWithGemini, fetchWithGoogleSearch } from '../services/geminiService';
import type { Website, GroundedSearchResult, AppSettings, VideoGenerationResultItem, ImageGenerationResultItem } from '../types';

const WEBSITES_KEY = 'pump_app_websites';
const ALL_WEBSITES_KEY = 'pump_app_all_websites';
const IS_GENERATED_KEY = 'pump_app_is_generated';

const MAX_BUFFER_SIZE = 8; // Further increased for dedicated server use
const CONCURRENT_PRELOADS = 3; // Allow more concurrent fetches for faster buffer filling

// Helper to check if a URL needs proxying
const shouldProxy = (url: string): boolean => {
    if (!url) return false;
    return url.startsWith('http://') || (url.startsWith('https://') && !url.includes(window.location.host));
};

// Helper to get proxied URL for API endpoints to bypass CORS via our backend
const getProxiedUrl = (url: string, bypassProxyIfDirect: boolean = false): string => {
    if (!shouldProxy(url)) return url;
    // Fast path: if the user explicitly wants to bypass proxy (e.g. for already resolved direct links in ui) we can.
    // However, the proxy guarantees CORS safety for blob fetching.
    return `/api/proxy?url=${encodeURIComponent(url)}`;
};

// Helper to add a timestamp to a URL to prevent caching and ensure fresh results
const appendTimestamp = (url: string): string => {
    const separator = url.includes('?') ? '&' : '?';
    // Add both timestamp and a random string to guarantee uniqueness in parallel calls
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${url}${separator}t=${Date.now()}_${randomStr}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Type for a media item that has been pre-processed with its dimensions
type BufferedMedia<T> = {
    item: T;
    aspectRatio: string;
};

// Full internal type for undo state
type PreviousState = {
    websites: Website[];
    groundedResult: GroundedSearchResult | null;
    videoResult: BufferedMedia<VideoGenerationResultItem>[] | null;
    imageResult: BufferedMedia<ImageGenerationResultItem>[] | null;
    resultType: 'websites' | 'grounded' | 'video' | 'image' | null;
    websiteResultBuffer: Website[][];
    videoResultBuffer: BufferedMedia<VideoGenerationResultItem>[][];
    imageResultBuffer: BufferedMedia<ImageGenerationResultItem>[][];
};


/**
 * Converts a Blob to a base64 encoded data URL.
 */
const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

/**
 * Recursively searches for all values that look like a URL within a JSON object.
 */
function findUrlsInJson(data: any): string[] {
    const urls: string[] = [];
    function traverse(obj: any) {
        if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('data:image'))) {
            urls.push(obj);
            return;
        }
        if (Array.isArray(obj)) {
            for (const item of obj) {
                traverse(item);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            // First check common keys, then others
            const preferredKeys = ['url', 'image', 'img', 'src', '图片', 'video'];
            for (const key of preferredKeys) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                     traverse(obj[key]);
                }
            }
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key) && !preferredKeys.includes(key)) {
                    traverse(obj[key]);
                }
            }
        }
    }
    traverse(data);
    return urls;
}

/**
 * Preloads a media URL (image or video) and returns its dimensions.
 */
const getMediaDimensions = (url: string, type: 'image' | 'video', signal?: AbortSignal): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            if (type === 'image') {
                img.src = '';
            } else {
                video.src = '';
            }
            clearTimeout(timeout);
            reject(new Error('Media dimension detection aborted'));
        };

        if (signal?.aborted) return onAbort();
        signal?.addEventListener('abort', onAbort);

        const timeout = setTimeout(() => {
            if (type === 'image') {
                img.src = '';
            } else {
                video.src = '';
            }
            signal?.removeEventListener('abort', onAbort);
            reject(new Error(`Media loading timed out: ${url}`));
        }, signal?.aborted ? 1 : (signal ? 3000 : 15000)); // Shorter timeout for background/manual detection to prevent hanging UI

        let img: HTMLImageElement;
        let video: HTMLVideoElement;

        if (type === 'image') {
            img = new Image();
            img.onload = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                reject(new Error(`Image failed to load: ${url}`));
            };
            img.src = url;
            img.referrerPolicy = "no-referrer";
        } else { // video
            video = document.createElement('video');
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                resolve({ width: video.videoWidth, height: video.videoHeight });
            };
            video.onerror = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                reject(new Error(`Video failed to load: ${url}`));
            };
            video.preload = 'metadata';
            video.src = url;
        }
    });
};


/**
 * Fetches media from an endpoint with a retry mechanism and intelligently handles the response.
 * It can process JSON, special JSON structures, plain text URLs, or direct media files.
 * CRUCIALLY, it also pre-caches the media dimensions.
 */
async function fetchAndProcessMedia<T extends VideoGenerationResultItem | ImageGenerationResultItem>(
    endpoint: string, 
    type: 'video' | 'image', 
    signal?: AbortSignal,
    retries = 2,
    isPreload: boolean = false
): Promise<BufferedMedia<T>[]> {
    // Use proxy for external API URLs to avoid CORS when fetching JSON
    let finalUrl = getProxiedUrl(endpoint);
    // Append timestamp to the final URL to bust browser cache
    finalUrl = appendTimestamp(finalUrl);

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(finalUrl, { signal, cache: 'no-store' });
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error("API 请求过于频繁（429）。请稍后再试，或在设置中降低预加载频率。");
                }
                throw new Error(`API 请求失败，状态码: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            
            // If we get HTML instead of media or JSON, it's likely a rate limit or error page from the provider
            if (contentType && contentType.includes('text/html')) {
                throw new Error(`API 返回了 HTML 页面而非数据。这通常意味着您触发了接口的频率限制（Rate Limit）或接口暂时不可用。请稍后再试。`);
            }

            const responseClone = response.clone();
            
            let rawItems: Partial<T>[] = [];

            // Case 1: Direct media file response (e.g., video/mp4, image/jpeg)
            if (contentType && (contentType.startsWith('video/') || contentType.startsWith('image/'))) {
                let mediaUrl: string;
                if (isPreload) {
                    const blob = await response.blob();
                    mediaUrl = URL.createObjectURL(blob);
                } else {
                    // Manual request: use proxied URL directly for immediate start
                    mediaUrl = finalUrl;
                }
                
                rawItems = type === 'video' 
                    ? [{ url: mediaUrl, title: '生成的视频', thumbnail: '' }] as unknown as Partial<T>[]
                    : [{ url: mediaUrl, alt: '生成的图片' }] as unknown as Partial<T>[];
            } else {
                    // Case 2: Try parsing as JSON
                try {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'url' in data[0]) {
                        rawItems = data.map(item => ({ ...item, url: getProxiedUrl(item.url) }));
                    } else if (type === 'image' && data?.['数据']?.['图片']) {
                        rawItems = [{ url: getProxiedUrl(data['数据']['图片']), alt: '生成的图片' }] as unknown as Partial<T>[];
                    } else {
                        const foundUrls = findUrlsInJson(data);
                        if (foundUrls.length > 0) {
                            rawItems = foundUrls.map(foundUrl => {
                                const proxiedUrl = getProxiedUrl(foundUrl);
                                return type === 'image' 
                                    ? { url: proxiedUrl, alt: '生成的图片' } as unknown as Partial<T>
                                    : { url: proxiedUrl, title: '生成的视频', thumbnail: '' } as unknown as Partial<T>;
                            });
                        }
                    }

                    // For best performance and dimensions logic: Pre-fetch blobs if preloading
                    if (isPreload && rawItems.length > 0) {
                        for (const item of rawItems) {
                            if (item.url && !item.url.startsWith('blob:') && !item.url.startsWith('data:')) {
                                try {
                                    const res = await fetch(item.url, { signal });
                                    if (res.ok) {
                                        const blob = await res.blob();
                                        item.url = URL.createObjectURL(blob);
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }
                    }
                } catch (e) {
                     // Case 3: JSON parsing failed, try reading as plain text URL
                    if (e instanceof SyntaxError) {
                        try {
                            const text = await responseClone.text();
                            const trimmedText = text.trim();
                            if (trimmedText.startsWith('http')) {
                                const proxiedUrl = getProxiedUrl(trimmedText);
                                rawItems = type === 'image' 
                                    ? [{ url: proxiedUrl, alt: '生成的图片' }] as unknown as Partial<T>[]
                                    : [{ url: proxiedUrl, title: '生成的视频', thumbnail: '' }] as unknown as Partial<T>[];
                                
                                // Fetch blob for text URL if needed
                                if (isPreload && rawItems[0].url) {
                                    try {
                                        const res = await fetch(rawItems[0].url, { signal });
                                        if (res.ok) {
                                            const blob = await res.blob();
                                            rawItems[0].url = URL.createObjectURL(blob);
                                        }
                                    } catch (e) { /* ignore */ }
                                }
                            }
                        } catch (textError) {
                            console.error("Failed to read response as text after JSON parsing failed:", textError);
                        }
                    }
                }
            }
            
            if (rawItems.length === 0 || !rawItems[0]?.url) {
                 throw new Error(`响应格式无法识别或URL无效。收到的内容类型: ${contentType || '未知'}`);
            }
            
            // Now, for each valid item, get its dimensions
            const processedItems: BufferedMedia<T>[] = [];
            for (const item of rawItems) {
                if (item.url) {
                    try {
                        // For manual requests (isPreload=false), we skip dimension detection to show media INSTANTLY
                        // For preloading, we detect dimensions to prevent layout shifts later
                        if (!isPreload) {
                            processedItems.push({ item: item as T, aspectRatio: type === 'video' ? '9 / 16' : 'auto' });
                            continue;
                        }

                        const { width, height } = await getMediaDimensions(item.url, type, signal);
                        const aspectRatio = (width > 0 && height > 0) ? `${width} / ${height}` : (type === 'video' ? '9 / 16' : '1 / 1');
                        processedItems.push({ item: item as T, aspectRatio });
                    } catch (dimError) {
                        if ((dimError as Error).message === 'Media dimension detection aborted') {
                            throw dimError;
                        }
                        console.warn(`Dimension detection failed for ${item.url}, using fallbacks:`, dimError);
                        // Sensible fallbacks based on common social media formats
                        const defaultRatio = type === 'video' ? '9 / 16' : 'auto';
                        processedItems.push({ item: item as T, aspectRatio: defaultRatio });
                    }
                }
            }

            if (processedItems.length > 0) {
                return processedItems;
            }
            
            throw new Error("未能获取到有效的媒体资源。");

        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                throw error; // Do not retry on abort
            }
            console.warn(`Attempt ${i + 1} failed for ${endpoint}. Error:`, error);
            if (i < retries) {
                const backoff = 1000 * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, backoff));
            } else {
                throw error; // Rethrow after all retries failed
            }
        }
    }
    throw new Error('All fetch attempts failed.');
}

export const useWebsiteGenerator = (settings: AppSettings, addSearchTerm: (term: string) => void) => {
  const [websites, setWebsites] = useLocalStorage<Website[]>(WEBSITES_KEY, []);
  const [allGeneratedWebsites, setAllGeneratedWebsites] = useLocalStorage<Website[]>(ALL_WEBSITES_KEY, []);
  const [isGenerated, setIsGenerated] = useLocalStorage<boolean>(IS_GENERATED_KEY, false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [groundedResult, setGroundedResult] = useState<GroundedSearchResult | null>(null);
  const [videoResult, setVideoResult] = useState<BufferedMedia<VideoGenerationResultItem>[] | null>(null);
  const [imageResult, setImageResult] = useState<BufferedMedia<ImageGenerationResultItem>[] | null>(null);

  // --- Buffers ---
  // Website buffer for "换一批" preloading
  const [websiteResultBuffer, setWebsiteResultBuffer] = useState<Website[][]>([]);
  // Media preloading buffers
  const [videoResultBuffer, setVideoResultBuffer] = useState<BufferedMedia<VideoGenerationResultItem>[][]>([]);
  const [imageResultBuffer, setImageResultBuffer] = useState<BufferedMedia<ImageGenerationResultItem>[][]>([]);
  
  // --- Preloading State Refs ---
  const isPreloadingMediaRef = useRef(false);
  const preloadAbortControllerRef = useRef<AbortController | null>(null);
  const mainAbortControllerRef = useRef<AbortController | null>(null);
  const lastGenerateTimeRef = useRef(0);
  const isPreloadingWebsitesRef = useRef(false);
  
  const [generationTarget, setGenerationTarget] = useState<'video' | 'image' | null>(null);
  const [internalQuery, setInternalQuery] = useState('');

  const resultType = useMemo(() => {
    if (isLoading && generationTarget) return generationTarget;
    if (groundedResult) return 'grounded';
    if (videoResult && videoResult.length > 0) return 'video';
    if (imageResult && imageResult.length > 0) return 'image';
    if (websites && websites.length > 0) return 'websites';
    return null;
  }, [websites, groundedResult, videoResult, imageResult, isLoading, generationTarget]);

  const [previousResultState, setPreviousResultState] = useState<PreviousState | null>(null);

  const cancelGeneration = useCallback(() => {
    if (mainAbortControllerRef.current) {
        mainAbortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => {
    // Clean up old storage keys to free up space for users who might have full storage
    localStorage.removeItem('pump_app_video_buffer');
    localStorage.removeItem('pump_app_image_buffer');
  }, []);

  // Reactive preloading for websites, triggered after a generation.
  const preloadWebsites = useCallback(async (currentQuery: string, websitesToExclude: Website[]) => {
      if (websiteResultBuffer.length > 0 || isPreloadingWebsitesRef.current) return;

      isPreloadingWebsitesRef.current = true;
      try {
          const count = settings.unlimitedSearchEnabled ? settings.unlimitedSearchCount : 8;
          const isSearchMode = settings.moreSearchesEnabled || settings.omniSearchEnabled;
          const effectiveQuery = (isSearchMode && currentQuery) ? currentQuery : '全球知名的科技公司';
          
          const result = await fetchWebsitesWithGemini(websitesToExclude, effectiveQuery, count, settings);
          
          if (result && result.length > 0) {
              setWebsiteResultBuffer([result]);
          }
      } catch (e) {
          console.error('Website preloading failed:', e);
          // Do not show preloading errors to the user
      } finally {
          isPreloadingWebsitesRef.current = false;
      }
  }, [settings, websiteResultBuffer.length, setWebsiteResultBuffer]);

  // Proactive preloading for media, keeps the buffer full.
  const preloadMedia = useCallback(async () => {
    // Check how many tasks we need to start
    const videoNeeded = settings.videoGenerationEnabled ? MAX_BUFFER_SIZE - videoResultBuffer.length : 0;
    const imageNeeded = settings.imageGenerationEnabled ? MAX_BUFFER_SIZE - imageResultBuffer.length : 0;
    
    if (videoNeeded <= 0 && imageNeeded <= 0) return;
    if (isPreloadingMediaRef.current) return;
    
    console.log(`Starting parallel preload. Video needed: ${videoNeeded}, Image needed: ${imageNeeded}`);
    
    // Create a new AbortController for this preload session
    preloadAbortControllerRef.current = new AbortController();
    const signal = preloadAbortControllerRef.current.signal;
    
    isPreloadingMediaRef.current = true;

    // Use a pool to limit concurrency while preloading many items
    const preloadTasks: Promise<void>[] = [];
    const activeTasksCountRef = { current: 0 };
    
    const resolveApiEndpoint = (endpoints: {id: string, name: string, url: string}[], selectedId: string | null) => {
        if (selectedId === 'random' && endpoints.length > 0) {
            const randomIndex = Math.floor(Math.random() * endpoints.length);
            return endpoints[randomIndex];
        }
        return endpoints.find(api => api.id === selectedId);
    };

    const runTask = async (type: 'video' | 'image', index: number, total: number) => {
        if (signal.aborted) return;
        try {
            const endpoints = type === 'video' ? settings.videoApiEndpoints : settings.imageApiEndpoints;
            const selectedId = type === 'video' ? settings.selectedVideoApiId : settings.selectedImageApiId;
            const api = resolveApiEndpoint(endpoints, selectedId);
            
            if (!api?.url) return;
            console.log(`Preloading ${type} ${index + 1}/${total} from ${api.name}...`);
            const data = await fetchAndProcessMedia(api.url, type, signal, 1, true);
            if (data && data.length > 0 && !signal.aborted) {
                if (type === 'video') setVideoResultBuffer(prev => [...prev, data].slice(0, MAX_BUFFER_SIZE));
                else setImageResultBuffer(prev => [...prev, data].slice(0, MAX_BUFFER_SIZE));
            }
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                const endpoints = type === 'video' ? settings.videoApiEndpoints : settings.imageApiEndpoints;
                const selectedId = type === 'video' ? settings.selectedVideoApiId : settings.selectedImageApiId;
                const api = endpoints.find(a => a.id === selectedId);
                console.error(`${type} preloading failed (${api?.name || '未知接口'}):`, e);
            }
        }
    };

    // Queue up tasks with a limit on concurrent requests
    const queue = [
        ...Array.from({ length: videoNeeded }).map((_, i) => () => runTask('video', i, videoNeeded)),
        ...Array.from({ length: imageNeeded }).map((_, i) => () => runTask('image', i, imageNeeded))
    ];

    const worker = async () => {
        while (queue.length > 0 && !signal.aborted) {
            const task = queue.shift();
            if (task) await task();
        }
    };

    // Launch workers up to CONCURRENT_PRELOADS
    for (let i = 0; i < CONCURRENT_PRELOADS; i++) {
        preloadTasks.push(worker());
    }

    try {
        await Promise.all(preloadTasks);
    } finally {
        isPreloadingMediaRef.current = false;
        preloadAbortControllerRef.current = null;
        console.log('Parallel preload session finished.');
    }
  }, [settings, videoResultBuffer.length, setVideoResultBuffer, imageResultBuffer.length, setImageResultBuffer]);
  
  // Effect for initial media preload and settings changes
  const prevVideoEnabled = useRef(settings.videoGenerationEnabled);
  const prevImageEnabled = useRef(settings.imageGenerationEnabled);
  useEffect(() => {
    if (prevVideoEnabled.current && !settings.videoGenerationEnabled) setVideoResultBuffer([]);
    if (prevImageEnabled.current && !settings.imageGenerationEnabled) setImageResultBuffer([]);

    prevVideoEnabled.current = settings.videoGenerationEnabled;
    prevImageEnabled.current = settings.imageGenerationEnabled;
    
    // Initial preload
    preloadMedia();
  }, [settings.videoGenerationEnabled, settings.imageGenerationEnabled, setVideoResultBuffer, setImageResultBuffer, preloadMedia]);

  // Reactive effect to keep media buffers full
  useEffect(() => {
    const canPreload = !isPreloadingMediaRef.current;
    const videoNeedsPreload = settings.videoGenerationEnabled && videoResultBuffer.length < MAX_BUFFER_SIZE;
    const imageNeedsPreload = settings.imageGenerationEnabled && imageResultBuffer.length < MAX_BUFFER_SIZE;

    if (canPreload && (videoNeedsPreload || imageNeedsPreload)) {
        preloadMedia();
    }
  }, [
      settings.videoGenerationEnabled,
      settings.imageGenerationEnabled,
      videoResultBuffer.length,
      imageResultBuffer.length,
      preloadMedia
  ]);


  const handleGenerate = useCallback(async (searchQuery: string, forceType?: 'video' | 'image') => {
    // 1. Throttle: Prevent rapid clicks (min 600ms between generations)
    const now = Date.now();
    if (now - lastGenerateTimeRef.current < 600) {
        return;
    }
    lastGenerateTimeRef.current = now;

    // 2. Intercept: Stop any ongoing preloading to prioritize this manual request
    if (preloadAbortControllerRef.current) {
        preloadAbortControllerRef.current.abort();
        isPreloadingMediaRef.current = false;
    }

    setError(null);
    setGenerationTarget(forceType || null);

    const isMediaGenerationMode = settings.videoGenerationEnabled || settings.imageGenerationEnabled;
    let query = searchQuery.trim();
    
    if (!query && !isMediaGenerationMode) {
      query = '全球知名的科技公司';
    }
    
    const isSearchMode = settings.moreSearchesEnabled || settings.omniSearchEnabled;
    if (isSearchMode && !query && !isMediaGenerationMode) {
      setError('请输入搜索内容。');
      setGenerationTarget(null);
      return;
    }

    if (query !== internalQuery && !isMediaGenerationMode) {
      setPreviousResultState(null);
      setWebsiteResultBuffer([]); // Clear website buffer on new query
      setInternalQuery(query);
    }
    
    if (query && !isMediaGenerationMode) {
        addSearchTerm(query);
    }
    
    setPreviousResultState({ websites, groundedResult, videoResult, imageResult, resultType, websiteResultBuffer, videoResultBuffer, imageResultBuffer });

    let genType: 'video' | 'image' | 'grounded' | 'websites';
    
    // Determine generation type with clear priority
    if (forceType) {
        genType = forceType;
    } else if (isSearchMode && query) {
        genType = settings.searchEngine === 'google' ? 'grounded' : 'websites';
    } else if (settings.videoGenerationEnabled) {
        genType = 'video';
    } else if (settings.imageGenerationEnabled) {
        genType = 'image';
    } else {
        genType = 'websites';
    }

    // Serve from website buffer first for instant "换一批"
    if (genType === 'websites' && websiteResultBuffer.length > 0) {
        setIsLoading(true);
        const [nextResult, ...remainingBuffer] = websiteResultBuffer;
        
        // Deduplicate nextResult
        const dedupedNext = nextResult.filter((site, index, self) => 
            index === self.findIndex((t) => t.url === site.url)
        );
        
        setWebsites(dedupedNext);
        setWebsiteResultBuffer(remainingBuffer);
        
        // Clear other results to ensure switch
        setGroundedResult(null); setVideoResult(null); setImageResult(null);
        
        const allWebsitesMap = new Map(allGeneratedWebsites.map(site => [site.url, site]));
        dedupedNext.forEach(site => allWebsitesMap.set(site.url, site));
        const newAllWebsites = Array.from(allWebsitesMap.values());
        setAllGeneratedWebsites(newAllWebsites);

        setIsGenerated(true);
        setIsLoading(false);

        // Trigger preload for the *next* batch
        preloadWebsites(query, newAllWebsites);
        return;
    }

    // Serve from media buffers
    if (genType === 'video' && videoResultBuffer.length > 0) {
        setIsLoading(true);
        const [nextResult, ...remainingBuffer] = videoResultBuffer;
        setVideoResult(nextResult);
        setVideoResultBuffer(remainingBuffer);
        
        // Clear other results to ensure switch
        setWebsites([]); setGroundedResult(null); setImageResult(null);
        
        setIsGenerated(true);
        setIsLoading(false);
        
        // Faster refill
        setTimeout(() => preloadMedia(), 50);
        return;
    }

    if (genType === 'image' && imageResultBuffer.length > 0) {
        setIsLoading(true);
        const [nextResult, ...remainingBuffer] = imageResultBuffer;
        setImageResult(nextResult);
        setImageResultBuffer(remainingBuffer);
        
        // Clear other results to ensure switch
        setWebsites([]); setGroundedResult(null); setVideoResult(null);
        
        setIsGenerated(true);
        setIsLoading(false);

        // Faster refill
        setTimeout(() => preloadMedia(), 50);
        return;
    }

    // 3. Cancel any previous main request if it's still running
    if (mainAbortControllerRef.current) {
        mainAbortControllerRef.current.abort();
    }
    mainAbortControllerRef.current = new AbortController();
    const mainSignal = mainAbortControllerRef.current.signal;

    setIsLoading(true);

    try {
      if (genType === 'video') {
        const resolveApiEndpoint = (endpoints: {id: string, name: string, url: string}[], selectedId: string | null) => {
            if (selectedId === 'random' && endpoints.length > 0) {
                const randomIndex = Math.floor(Math.random() * endpoints.length);
                return endpoints[randomIndex];
            }
            return endpoints.find(api => api.id === selectedId);
        };
        const selectedApi = resolveApiEndpoint(settings.videoApiEndpoints, settings.selectedVideoApiId);
        if (!selectedApi?.url) throw new Error("请在设置中选择一个有效的视频生成 API。");
        const rawData = await fetchAndProcessMedia<VideoGenerationResultItem>(selectedApi.url, 'video', mainSignal);
        // Deduplicate
        const data = rawData.filter((item, index, self) => 
            index === self.findIndex((t) => t.item.url === item.item.url)
        );
        setVideoResult(data);
        setWebsites([]); setGroundedResult(null); setImageResult(null);
      } else if (genType === 'image') {
        const resolveApiEndpoint = (endpoints: {id: string, name: string, url: string}[], selectedId: string | null) => {
            if (selectedId === 'random' && endpoints.length > 0) {
                const randomIndex = Math.floor(Math.random() * endpoints.length);
                return endpoints[randomIndex];
            }
            return endpoints.find(api => api.id === selectedId);
        };
        const selectedApi = resolveApiEndpoint(settings.imageApiEndpoints, settings.selectedImageApiId);
        if (!selectedApi?.url) throw new Error("请在设置中选择一个有效的图片生成 API。");
        const rawData = await fetchAndProcessMedia<ImageGenerationResultItem>(selectedApi.url, 'image', mainSignal);
        // Deduplicate
        const data = rawData.filter((item, index, self) => 
            index === self.findIndex((t) => t.item.url === item.item.url)
        );
        setImageResult(data);
        setWebsites([]); setGroundedResult(null); setVideoResult(null);
      } else if (genType === 'grounded') {
        const result = await fetchWithGoogleSearch(query, settings);
        setGroundedResult(result);
        setWebsites([]); setVideoResult(null); setImageResult(null);
      } else { // websites
        const count = settings.unlimitedSearchEnabled ? settings.unlimitedSearchCount : 8;
        const rawResult = await fetchWebsitesWithGemini(allGeneratedWebsites, query, count, settings);
        // Deduplicate
        const result = rawResult.filter((site, index, self) => 
            index === self.findIndex((t) => t.url === site.url)
        );
        setWebsites(result);
        
        // Use a Map to strictly identify unique URLs
        const allWebsitesMap = new Map();
        // Add existing ones
        allGeneratedWebsites.forEach(site => allWebsitesMap.set(site.url, site));
        // Add or overwrite with new ones
        result.forEach(site => allWebsitesMap.set(site.url, site));
        
        const newAllWebsites = Array.from(allWebsitesMap.values());
        setAllGeneratedWebsites(newAllWebsites);
        setGroundedResult(null); setVideoResult(null); setImageResult(null);

        // After a successful fetch, trigger preload for the next batch.
        preloadWebsites(query, newAllWebsites);
      }
      setIsGenerated(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
          // Reset loading state for aborted requests
          setIsLoading(false);
          setGenerationTarget(null);
          return;
      }
      
      let detailedError = "生成失败，请稍后重试。";
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes('failed to fetch')) detailedError = "网络请求失败。请检查您的API端点、网络连接和CORS策略。";
        else if (err.message.includes('429') || err.message.includes('quota')) detailedError = 'API 调用频率超出配额。请稍后再试。';
        else if (err.message.includes('api key') || err.message.includes('api 密钥')) detailedError = 'API 密钥无效或未设置。请检查您的配置。';
        else detailedError = err.message;
      }
      setError(detailedError);
      // Restore previous state on error
      if (previousResultState) {
          setWebsites(previousResultState.websites);
          setGroundedResult(previousResultState.groundedResult);
          setVideoResult(previousResultState.videoResult);
          setImageResult(previousResultState.imageResult);
          setWebsiteResultBuffer(previousResultState.websiteResultBuffer);
          setVideoResultBuffer(previousResultState.videoResultBuffer);
          setImageResultBuffer(previousResultState.imageResultBuffer);
      }
      setPreviousResultState(null); // Clear undo state after restoring
    } finally {
      setIsLoading(false);
      setGenerationTarget(null);
    }
  }, [
      settings, internalQuery, websites, groundedResult, videoResult, imageResult, resultType,
      allGeneratedWebsites, addSearchTerm, setAllGeneratedWebsites, setIsGenerated, setWebsites,
      websiteResultBuffer, videoResultBuffer, imageResultBuffer,
      setWebsiteResultBuffer, setVideoResultBuffer, setImageResultBuffer,
      previousResultState, preloadWebsites
  ]);

  const handleUndo = useCallback(() => {
    if (previousResultState) {
        setWebsites(previousResultState.websites);
        setGroundedResult(previousResultState.groundedResult);
        setVideoResult(previousResultState.videoResult);
        setImageResult(previousResultState.imageResult);
        setWebsiteResultBuffer(previousResultState.websiteResultBuffer);
        setVideoResultBuffer(previousResultState.videoResultBuffer);
        setImageResultBuffer(previousResultState.imageResultBuffer);
        setPreviousResultState(null);
    }
  }, [previousResultState, setWebsites, setWebsiteResultBuffer, setVideoResultBuffer, setImageResultBuffer]);

  const returnToHome = useCallback(() => {
    setWebsites([]);
    setGroundedResult(null);
    setVideoResult(null);
    setImageResult(null);
    setIsGenerated(false);
    setPreviousResultState(null);
    setError(null);
    setInternalQuery('');
    setWebsiteResultBuffer([]);
  }, [setWebsites, setIsGenerated, setGroundedResult, setVideoResult, setImageResult, setPreviousResultState, setError, setWebsiteResultBuffer]);

  const resetGenerator = useCallback(() => {
    setWebsites([]);
    setAllGeneratedWebsites([]);
    setIsGenerated(false);
    setGroundedResult(null);
    setVideoResult(null);
    setImageResult(null);
    setPreviousResultState(null);
    setError(null);
    setInternalQuery('');
    setWebsiteResultBuffer([]);
    setVideoResultBuffer([]);
    setImageResultBuffer([]);
  }, [setWebsites, setAllGeneratedWebsites, setIsGenerated, setWebsiteResultBuffer, setVideoResultBuffer, setImageResultBuffer]);
  
  // Expose a simplified version of previousResultState for UI (e.g., to disable undo button)
  const previousResultStateForUi = useMemo(() => {
      if (!previousResultState) return null;
      const { websiteResultBuffer, videoResultBuffer, imageResultBuffer, ...rest } = previousResultState;
      return rest;
  }, [previousResultState]);

  return {
    websites, setWebsites, allGeneratedWebsites, isGenerated, isLoading, error, groundedResult,
    videoResult, imageResult, resultType, generationTarget,
    previousResultState: previousResultStateForUi,
    handleGenerate, handleUndo, returnToHome, resetGenerator, setAllGeneratedWebsites, cancelGeneration
  };
};