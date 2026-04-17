import React, { useState, useContext, useRef, useEffect } from 'react';
import { UIContext } from '../../contexts/UIContext';
import { SettingsContext } from '../../contexts/SettingsContext';
import { MusicIcon, SearchIcon, PlayIcon, PauseIcon, DownloadIcon, Loader as LoaderIcon, XIcon, CogIcon, FileCodeIcon } from '../Icons';
import { isColorLight } from '../../utils/colorUtils';
import type { MusicInfo } from '../../types';
import MusicSourceModal from './MusicSourceModal';
import { customMusicEngine } from '../../services/customMusicEngine';

interface MusicModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MusicModal: React.FC<MusicModalProps> = ({ isOpen, onClose }) => {
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<MusicInfo[]>([]);
    const [playingSong, setPlayingSong] = useState<MusicInfo | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
    
    // Playback state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [lyrics, setLyrics] = useState<{time: number, text: string}[]>([]);
    
    // Derived state for current lyric
    const currentLyricIndex = lyrics.findIndex(l => l.time > currentTime) - 1;
    const currentLyricText = lyrics.length > 0 ? (currentLyricIndex >= 0 ? lyrics[currentLyricIndex].text : lyrics[0].text) : '';
    
    const { showToast } = useContext(UIContext);
    const { settings } = useContext(SettingsContext);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const isThemeLight = isColorLight(settings.themeColor);
    const dynamicButtonTextColor = isThemeLight ? 'text-slate-900' : 'text-white';

    // Initialize custom music engines whenever settings change
    useEffect(() => {
        if (!settings.customMusicSources) return;
        
        const initEngines = async () => {
            customMusicEngine.clear();
            for (const source of settings.customMusicSources) {
                if (source.isActive && source.content) {
                    await customMusicEngine.loadSource(source.id, source.name, source.content);
                }
            }
        };
        initEngines();
    }, [settings.customMusicSources]);

    useEffect(() => {
        if (!isOpen) {
            if (audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
        }
    }, [isOpen]);

    // LX Music Open API Sync
    useEffect(() => {
        if (!isOpen) return;

        const updateStatus = async () => {
            if (!audioRef.current) return;
            const status = {
                status: isPlaying ? "playing" : (audioRef.current.paused ? "paused" : "stoped"),
                name: playingSong?.title || "",
                singer: playingSong?.artist || "",
                albumName: playingSong?.album || "",
                duration: audioRef.current.duration || 0,
                progress: audioRef.current.currentTime || 0,
                picUrl: playingSong?.cover || "",
                lyricLineText: `${playingSong?.title || ""} - ${playingSong?.artist || ""}`
            };
            try {
                await fetch('/api/music/state-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(status)
                });
            } catch (e) {}
        };

        const interval = setInterval(updateStatus, 2000);
        return () => clearInterval(interval);
    }, [isOpen, isPlaying, playingSong]);

    // LX Music Control Listener
    useEffect(() => {
        const sse = new EventSource('/api/music/control-sse');
        sse.onmessage = (event) => {
            try {
                const { action, data } = JSON.parse(event.data);
                if (!audioRef.current) return;
                
                switch (action) {
                    case 'play': audioRef.current.play(); setIsPlaying(true); break;
                    case 'pause': audioRef.current.pause(); setIsPlaying(false); break;
                    case 'volume': audioRef.current.volume = Number(data) / 100; break;
                    case 'mute': audioRef.current.muted = Boolean(data); break;
                    case 'seek': audioRef.current.currentTime = Number(data); break;
                    // For skip next/prev, in this simple search-based UI, we'll just show a toast
                    case 'skip-next': showToast("API请求播放下一首"); break;
                    case 'skip-prev': showToast("API请求播放上一首"); break;
                }
            } catch (e) {}
        };
        return () => sse.close();
    }, []);

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!keyword) {
            showToast("请输入搜索关键词");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/music/search?keyword=${encodeURIComponent(keyword)}`);
            const builtinData: MusicInfo[] = await response.json();
            
            setResults(builtinData);
            if (builtinData.length === 0) {
                showToast("未搜索到相关音乐");
            }
        } catch (error) {
            console.error("Music search error:", error);
            showToast("搜索请求失败");
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async (song: MusicInfo) => {
        if (playingSong?.id === song.id && playingSong?.source === song.source) {
            if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
            } else {
                audioRef.current?.play();
                setIsPlaying(true);
            }
            return;
        }

        let finalUrl = song.url;
        let finalCover = song.cover;
        
        // Built-in parser attempt
        try {
            if (finalUrl.startsWith('/api/music/parse')) {
                const resp = await fetch(finalUrl);
                const data = await resp.json();
                if (data.url) {
                    finalUrl = data.url;
                    finalCover = data.cover || song.cover;
                } else throw new Error('VIP或版权限制');
            }
        } catch (err: any) {
            // Fallback: Try all activated custom scripts for official songs
            const customSources = customMusicEngine.getLoadedSources();
            if (customSources.length > 0) {
                showToast("正在尝试通过音源脚本解析...");
                let resolved = false;
                for (const sourceId of customSources) {
                    try {
                        const result = await customMusicEngine.getMusicUrl(sourceId, song);
                        if (result) {
                            if (typeof result === 'string') {
                                finalUrl = result;
                            } else {
                                finalUrl = result.url || result;
                                if (result.headers) (song as any)._headers = result.headers;
                            }
                            resolved = true;
                            break;
                        }
                    } catch (e) {
                        console.error(`Fallback solve failed for ${sourceId}:`, e);
                    }
                }
                if (!resolved) {
                    showToast("官方及音源脚本均解析失败");
                    return;
                }
            } else {
                showToast(err.message || "解析失败");
                return;
            }
        }

        if (!finalUrl) {
            showToast("无法获取播放链接");
            return;
        }

        const songWithMetadata = { ...song, url: finalUrl, cover: finalCover };
        
        setPlayingSong(songWithMetadata);
        setIsPlaying(true);
        if (audioRef.current) {
            // Use proxy with specific content type for audio
            const headers = (songWithMetadata as any)._headers;
            const headersQuery = headers ? `&headers=${encodeURIComponent(JSON.stringify(headers))}` : '';
            const proxyPlayUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}${headersQuery}`;
            
            audioRef.current.src = proxyPlayUrl;
            audioRef.current.load(); // Force reset state
            audioRef.current.play().catch(err => {
                console.error("Playback error:", err);
                showToast("播放失败：服务器拦截或链接失效");
                setIsPlaying(false);
            });
        }
        
        // Update results list with the metadata we just found
        setResults(prev => prev.map(s => (s.id === song.id && s.source === song.source) ? songWithMetadata : s));
        
        // Fetch lyrics if possible
        setLyrics([]); // Reset first
        let fetchedLyrics = '';
        
        // Try custom sources first for lyrics
        const customSources = customMusicEngine.getLoadedSources();
        for (const sourceId of customSources) {
            try {
                const lrcResult = await customMusicEngine.getLyric(sourceId, songWithMetadata);
                if (lrcResult && (typeof lrcResult === 'string' || lrcResult.lyric)) {
                    fetchedLyrics = typeof lrcResult === 'string' ? lrcResult : lrcResult.lyric;
                    break;
                }
            } catch (e) {}
        }
        
        // If we have LRC text, parse it
        if (fetchedLyrics) {
            const parsed = fetchedLyrics.split('\n')
                .map(line => {
                    const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/);
                    if (match) {
                        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
                        return { time, text: match[3].trim() };
                    }
                    return null;
                })
                .filter((l): l is {time: number, text: string} => l !== null && l.text.trim() !== '');
            setLyrics(parsed);
        }
    };

    const handleDownload = async (song: MusicInfo) => {
        if (downloadingIds[song.id]) return;
        
        setDownloadingIds(prev => ({ ...prev, [song.id]: true }));
        try {
            let finalUrl = song.url;
            let finalHeaders: any = {};
            
            // Try built-in resolver for official results
            if (finalUrl.startsWith('/api/music/parse')) {
                try {
                    const resp = await fetch(finalUrl);
                    const data = await resp.json();
                    if (data.url) {
                        finalUrl = data.url;
                    } else {
                        throw new Error('受限');
                    }
                } catch (err: any) {
                    // Fallback to custom scripts
                    const customSources = customMusicEngine.getLoadedSources();
                    if (customSources.length > 0) {
                        let resolved = false;
                        for (const sourceId of customSources) {
                            try {
                                const result = await customMusicEngine.getMusicUrl(sourceId, song);
                                if (result) {
                                    if (typeof result === 'string') {
                                        finalUrl = result;
                                    } else {
                                        finalUrl = result.url || result;
                                        finalHeaders = result.headers || {};
                                    }
                                    resolved = true;
                                    break;
                                }
                            } catch (e) {}
                        }
                        if (!resolved) throw new Error('解析链接失败');
                    } else throw err;
                }
            }

            if (!finalUrl || finalUrl.startsWith('/api/music/parse') || finalUrl.includes('/api/music/custom/parse')) {
                throw new Error('No URL');
            }

            showToast("正在后台下载，请留意浏览器下载管理器...");
            const filename = `${song.title} - ${song.artist}.mp3`;
            const headersQuery = Object.keys(finalHeaders).length > 0 ? `&headers=${encodeURIComponent(JSON.stringify(finalHeaders))}` : '';
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}&download=${encodeURIComponent(filename)}${headersQuery}`;
            
            // Direct download via window.location for better reliability with large files
            window.location.href = proxyUrl;
            
            // Wait a bit then reset loading
            setTimeout(() => {
                setDownloadingIds(prev => ({ ...prev, [song.id]: false }));
            }, 5000); // Increase wait for download start
        } catch (error: any) {
            console.error("Music download error:", error);
            showToast(error.message === 'No URL' ? "无法获取下载链接" : (error.message || "下载失败"));
            setDownloadingIds(prev => ({ ...prev, [song.id]: false }));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div 
                className="relative w-full max-w-2xl bg-slate-900/90 border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300"
                style={{ borderColor: `${settings.themeColor}30` }}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div 
                            className="p-2 rounded-xl bg-[var(--theme-color)]/10 text-[var(--theme-color)]"
                            style={{ backgroundColor: `${settings.themeColor}20` }}
                        >
                            <MusicIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-sans">Azu Music 播放器</h2>
                            <p className="text-xs text-slate-400 font-sans mt-0.5">支持自定义魔改源</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsSourceModalOpen(true)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 flex items-center gap-2 text-xs font-medium"
                            title="音源管理"
                        >
                            <FileCodeIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">音源管理</span>
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400"
                        >
                            <XIcon />
                        </button>
                    </div>
                </div>

                {/* Sub-modals */}
                <MusicSourceModal 
                    isOpen={isSourceModalOpen} 
                    onClose={() => setIsSourceModalOpen(false)} 
                />

                {/* Search Box */}
                <div className="p-6 pb-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="输入歌曲名或歌手..."
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all font-sans text-sm"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                <SearchIcon />
                            </div>
                        </div>
                        <button 
                            onClick={handleSearch}
                            disabled={loading}
                            className={`px-6 py-3 rounded-xl font-bold font-sans flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 bg-[var(--theme-color)] ${dynamicButtonTextColor}`}
                        >
                            {loading ? <LoaderIcon className="animate-spin" /> : '搜索'}
                        </button>
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {results.length > 0 ? (
                        results.map((song) => (
                            <div 
                                key={song.id + song.source}
                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all group ${playingSong?.id === song.id && playingSong?.source === song.source ? 'bg-slate-800/50 border-[var(--theme-color)]/30' : 'bg-slate-800/20 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/40'}`}
                            >
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                                    {song.cover ? (
                                        <img src={song.cover} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                                            <MusicIcon />
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => handlePlay(song)}
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        {(playingSong?.id === song.id && playingSong?.source === song.source && isPlaying) ? <PauseIcon className="w-6 h-6 text-white" /> : <PlayIcon className="w-6 h-6 text-white" />}
                                    </button>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold truncate text-sm">{song.title}</h3>
                                    <p className="text-xs text-slate-400 truncate mt-1">
                                        {song.artist} • {song.album || '未知专辑'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border border-current font-bold ${
                                        song.source === 'netease' ? 'text-red-400' : 
                                        song.source === 'kuwo' ? 'text-blue-400' : 
                                        song.source === 'kugou' ? 'text-orange-400' : 
                                        song.source === 'migu' ? 'text-pink-400' : 'text-purple-400'
                                    }`}>
                                        {(() => {
                                            const customSource = settings.customMusicSources?.find(s => `custom_${s.id}` === song.source);
                                            if (customSource) {
                                                const subSourceId = (song as any)._original?._subSourceId;
                                                const subName = subSourceId ? (subSourceId.toUpperCase()) : '';
                                                return `${subName ? subName + '-' : ''}${customSource.name}`;
                                            }
                                            return song.source === 'netease' ? '网易' : 
                                                   song.source === 'kuwo' ? '酷我' : 
                                                   song.source === 'kugou' ? '酷狗' : 
                                                   song.source === 'migu' ? '咪咕' : '内置';
                                        })()}
                                    </span>
                                    <button 
                                        onClick={() => handleDownload(song)}
                                        disabled={downloadingIds[song.id]}
                                        className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white disabled:opacity-50"
                                    >
                                        {downloadingIds[song.id] ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        !loading && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-sans text-sm">搜索音乐开启听觉之旅</p>
                                <p className="font-sans text-[10px] mt-2 text-slate-600">后端集成 Netease, Kuwo, Kugou & Migu 引擎</p>
                            </div>
                        )
                    )}
                </div>

                {/* Footer / Audio Player */}
                {playingSong && (
                    <div className="p-4 bg-slate-900/95 border-t border-slate-700/50 backdrop-blur-md flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800 shadow-md">
                                {playingSong.cover ? (
                                    <img src={playingSong.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                        <MusicIcon className="w-6 h-6" />
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => {
                                    if (isPlaying) audioRef.current?.pause();
                                    else audioRef.current?.play();
                                    setIsPlaying(!isPlaying);
                                }}
                                className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-tr from-[var(--theme-color)] to-purple-500 text-white shadow-lg shadow-[var(--theme-color)]/20 active:scale-95 transition-transform`}
                            >
                                {isPlaying ? <PauseIcon className="w-6 h-6 fill-current" /> : <PlayIcon className="w-6 h-6 ml-1 fill-current" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-white truncate drop-shadow-sm">{playingSong.title}</h4>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{playingSong.artist}</p>
                                
                                {lyrics.length > 0 && (
                                    <p className="text-xs font-medium text-[var(--theme-color)] mt-1.5 truncate transition-all drop-shadow-md">
                                        {currentLyricText || '...'}
                                    </p>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tracking-tighter">
                                {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="px-1 flex items-center group cursor-pointer relative h-3">
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (audioRef.current) audioRef.current.currentTime = val;
                                    setCurrentTime(val);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-[var(--theme-color)] transition-all duration-100 ease-linear"
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        
                        <audio 
                            ref={audioRef} 
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                            onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
                            onWaiting={() => console.log('Audio waiting (buffering)...')}
                            onCanPlay={() => console.log('Audio can play.')}
                            onError={(e) => console.error('Audio element error:', e)}
                            className="hidden"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MusicModal;
