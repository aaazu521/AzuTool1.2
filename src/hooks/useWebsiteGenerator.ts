import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import useLocalStorage from './useLocalStorage';
import { fetchWebsitesWithGemini, fetchWithGoogleSearch } from '../services/geminiService';
import type { Website, GroundedSearchResult, AppSettings, VideoGenerationResultItem, ImageGenerationResultItem } from '../types';

const WEBSITES_KEY = 'pump_app_websites';
const ALL_WEBSITES_KEY = 'pump_app_all_websites';
const IS_GENERATED_KEY = 'pump_app_is_generated';

const MAX_BUFFER_SIZE = 3;

// Helper to check if a URL needs proxying
const shouldProxy = (url: string): boolean => {
    if (!url) return false;
    return url.startsWith('http://') || (url.startsWith('https://') && !url.includes(window.location.host));
};

// Helper to get proxied URL
const getProxiedUrl = (url: string, isPreload: boolean = false): string => {
    if (!shouldProxy(url)) return url;
    // Remove timestamp as it can break some APIs and prevents caching benefits
    return `/api/proxy?url=${encodeURIComponent(url)}${isPreload ? '&preload=true' : ''}`;
};

// Helper to add a timestamp to a URL to prevent caching and ensure fresh results
const appendTimestamp = (url: string): string => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
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
 * Recursively searches for the first value that looks like a URL within a JSON object.
 */
function findUrlInJson(data: any): string | null {
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('data:image'))) {
        return data;
    }
    if (Array.isArray(data)) {
        for (const item of data) {
            const url = findUrlInJson(item);
            if (url) return url;
        }
    } else if (typeof data === 'object' && data !== null) {
        // Prioritize common keys
        const preferredKeys = ['url', 'image', 'img', 'src', '图片'];
        for (const key of preferredKeys) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                 const url = findUrlInJson(data[key]);
                 if (url) return url;
            }
        }
        // Search remaining keys
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key) && !preferredKeys.includes(key)) {
                const url = findUrlInJson(data[key]);
                if (url) return url;
            }
        }
    }
    return null;
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
        }, 15000); // 15 seconds timeout

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
    // Use proxy for external URLs to avoid CORS and Mixed Content (HTTP on HTTPS) issues
    let finalUrl = getProxiedUrl(endpoint, isPreload);
    // Append timestamp to the final URL to bust browser cache (especially since proxy sets Cache-Control)
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
                        rawItems = data.map(item => ({ ...item, url: getProxiedUrl(item.url, isPreload) }));
                    } else if (type === 'image' && data?.['数据']?.['图片']) {
                        rawItems = [{ url: getProxiedUrl(data['数据']['图片'], isPreload), alt: '生成的图片' }] as unknown as Partial<T>[];
                    } else {
                        const foundUrl = findUrlInJson(data);
                        if (foundUrl) {
                            const proxiedUrl = getProxiedUrl(foundUrl, isPreload);
                            rawItems = type === 'image' 
                                ? [{ url: proxiedUrl, alt: '生成的图片' }] as unknown as Partial<T>[]
                                : [{ url: proxiedUrl, title: '生成的视频', thumbnail: '' }] as unknown as Partial<T>[];
                        }
                    }

                    // If preloading, fetch blobs for the found URLs
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
                                const proxiedUrl = getProxiedUrl(trimmedText, isPreload);
                                rawItems = type === 'image' 
                                    ? [{ url: proxiedUrl, alt: '生成的图片' }] as unknown as Partial<T>[]
                                    : [{ url: proxiedUrl, title: '生成的视频', thumbnail: '' }] as unknown as Partial<T>[];
                                
                                // Preload blob for text URL if needed
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
                        // OPTIMIZATION: Skip dimension detection for manual requests to get them on screen faster
                        if (!isPreload) {
                            // Use a slightly more flexible default for images
                            const defaultRatio = type === 'video' ? '9 / 16' : 'auto';
                            processedItems.push({ item: item as T, aspectRatio: defaultRatio });
                            continue;
                        }

                        const { width, height } = await getMediaDimensions(item.url, type, signal);
                        const aspectRatio = (width > 0 && height > 0) ? `${width} / ${height}` : (type === 'video' ? '9 / 16' : '1 / 1');
                        processedItems.push({ item: item as T, aspectRatio });
                    } catch (dimError) {
                        if ((dimError as Error).message === 'Media dimension detection aborted') {
                            throw dimError;
                        }
                        console.warn(`Dimension detection failed for ${item.url}, using fallback:`, dimError);
                        const defaultRatio = type === 'video' ? '9 / 16' : '1 / 1';
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
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
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
  
  const [resultType, setResultType] = useState<'websites' | 'grounded' | 'video' | 'image' | null>(() => (websites.length > 0) ? 'websites' : null);
  
  const [internalQuery, setInternalQuery] = useState('');
  const [generationTarget, setGenerationTarget] = useState<'video' | 'image' | null>(null);

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

    const preloadTasks: Promise<void>[] = [];

    const resolveApiEndpoint = (endpoints: {id: string, name: string, url: string}[], selectedId: string | null) => {
        if (selectedId === 'random' && endpoints.length > 0) {
            const randomIndex = Math.floor(Math.random() * endpoints.length);
            return endpoints[randomIndex];
        }
        return endpoints.find(api => api.id === selectedId);
    };

    // Preload Videos
    if (settings.videoGenerationEnabled && settings.videoApiEndpoints.length > 0 && videoNeeded > 0) {
        const videoTasks = Array.from({ length: videoNeeded }).map(async (item, index) => {
          try {
            if (signal.aborted) return;
            const api = resolveApiEndpoint(settings.videoApiEndpoints, settings.selectedVideoApiId);
            if (!api?.url) return;
            console.log(`Preloading video ${index + 1}/${videoNeeded} from ${api.name}...`);
            const data = await fetchAndProcessMedia<VideoGenerationResultItem>(api.url, 'video', signal, 1, true);
            if (data && data.length > 0) {
                setVideoResultBuffer(prev => [...prev, data].slice(0, MAX_BUFFER_SIZE));
            }
          } catch (e) {
            if ((e as Error).name !== 'AbortError') console.error('Video preloading failed:', e);
          }
        });
        preloadTasks.push(...videoTasks);
    }

    // Preload Images
    if (settings.imageGenerationEnabled && settings.imageApiEndpoints.length > 0 && imageNeeded > 0) {
        const imageTasks = Array.from({ length: imageNeeded }).map(async (item, index) => {
          try {
             if (signal.aborted) return;
             const api = resolveApiEndpoint(settings.imageApiEndpoints, settings.selectedImageApiId);
             if (!api?.url) return;
             console.log(`Preloading image ${index + 1}/${imageNeeded} from ${api.name}...`);
             const data = await fetchAndProcessMedia<ImageGenerationResultItem>(api.url, 'image', signal, 1, true);
             if (data && data.length > 0) {
                 setImageResultBuffer(prev => [...prev, data].slice(0, MAX_BUFFER_SIZE));
             }
          } catch (e) {
            if ((e as Error).name !== 'AbortError') console.error('Image preloading failed:', e);
          }
        });
        preloadTasks.push(...imageTasks);
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

    // --- Buffer Logic ---
    // Serve from website buffer first for instant "换一批"
    if (genType === 'websites' && websiteResultBuffer.length > 0) {
        setIsLoading(true);
        await sleep(200); // Small intentional delay for UX stability
        const [nextResult, ...remainingBuffer] = websiteResultBuffer;
        setWebsites(nextResult);
        setWebsiteResultBuffer(remainingBuffer);
        
        const allWebsitesMap = new Map(allGeneratedWebsites.map(site => [site.url, site]));
        nextResult.forEach(site => allWebsitesMap.set(site.url, site));
        const newAllWebsites = Array.from(allWebsitesMap.values());
        setAllGeneratedWebsites(newAllWebsites);

        setResultType('websites');
        setIsGenerated(true);
        setIsLoading(false); // CRITICAL: Reset loading state

        // Trigger preload for the *next* batch
        preloadWebsites(query, newAllWebsites);
        return;
    }

    // Serve from media buffers
    if (genType === 'video' && videoResultBuffer.length > 0) {
        console.log(`Serving video from buffer. Buffer size: ${videoResultBuffer.length}`);
        setIsLoading(true);
        await sleep(150); // Minimal delay for UX feel
        const [nextResult, ...remainingBuffer] = videoResultBuffer;
        setVideoResult(nextResult);
        setVideoResultBuffer(remainingBuffer);
        setResultType('video');
        setIsGenerated(true);
        setIsLoading(false);
        return;
    } else if (genType === 'video') {
        console.log("Video buffer empty, performing fresh fetch...");
    }

    if (genType === 'image' && imageResultBuffer.length > 0) {
        console.log(`Serving image from buffer. Buffer size: ${imageResultBuffer.length}`);
        setIsLoading(true);
        await sleep(150); // Minimal delay for UX feel
        const [nextResult, ...remainingBuffer] = imageResultBuffer;
        setImageResult(nextResult);
        setImageResultBuffer(remainingBuffer);
        setResultType('image');
        setIsGenerated(true);
        setIsLoading(false);
        return;
    } else if (genType === 'image') {
        console.log("Image buffer empty, performing fresh fetch...");
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
        const data = await fetchAndProcessMedia<VideoGenerationResultItem>(selectedApi.url, 'video', mainSignal);
        setVideoResult(data);
        setResultType('video');
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
        const data = await fetchAndProcessMedia<ImageGenerationResultItem>(selectedApi.url, 'image', mainSignal);
        setImageResult(data);
        setResultType('image');
        setWebsites([]); setGroundedResult(null); setVideoResult(null);
      } else if (genType === 'grounded') {
        const result = await fetchWithGoogleSearch(query, settings);
        setGroundedResult(result);
        setResultType('grounded');
        setWebsites([]); setVideoResult(null); setImageResult(null);
      } else { // websites
        const count = settings.unlimitedSearchEnabled ? settings.unlimitedSearchCount : 8;
        const result = await fetchWebsitesWithGemini(allGeneratedWebsites, query, count, settings);
        setWebsites(result);
        setResultType('websites');
        const allWebsitesMap = new Map(allGeneratedWebsites.map(site => [site.url, site]));
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
          setResultType(previousResultState.resultType);
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
        setResultType(previousResultState.resultType);
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
    setResultType(null);
    setIsGenerated(false);
    setPreviousResultState(null);
    setError(null);
    setInternalQuery('');
    setWebsiteResultBuffer([]);
  }, [setWebsites, setIsGenerated, setGroundedResult, setVideoResult, setImageResult, setResultType, setPreviousResultState, setError, setWebsiteResultBuffer]);

  const resetGenerator = useCallback(() => {
    setWebsites([]);
    setAllGeneratedWebsites([]);
    setIsGenerated(false);
    setGroundedResult(null);
    setVideoResult(null);
    setImageResult(null);
    setResultType(null);
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