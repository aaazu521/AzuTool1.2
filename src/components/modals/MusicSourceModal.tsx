import React, { useState, useContext } from 'react';
import { SettingsContext } from '../../contexts/SettingsContext';
import { UIContext } from '../../contexts/UIContext';
import { XIcon, TrashIcon, PlusIcon, GlobeIcon, FileCodeIcon } from '../Icons';
import type { CustomMusicSource } from '../../types';

interface MusicSourceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MusicSourceModal: React.FC<MusicSourceModalProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useContext(SettingsContext);
    const { showToast } = useContext(UIContext);
    
    const [newSourceName, setNewSourceName] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    if (!isOpen) return null;

    const handleAddSource = async () => {
        if (!newSourceName || !newSourceUrl) {
            showToast("请填写完整信息");
            return;
        }

        setIsAdding(true);
        try {
            // Check if it's a URL
            let content = '';
            if (newSourceUrl.startsWith('http')) {
                const resp = await fetch(newSourceUrl);
                content = await resp.text();
            } else {
                content = newSourceUrl; // Assume raw code if not a URL
            }

            // Remove problematic APIs requested by user
            // Replace problematic APIs with a safe empty JS call
            content = content.replace(/https?:\/\/api\.huibq\.com[^'"`\s]+/g, "javascript:void(0)");
            content = content.replace(/https?:\/\/api\.lingchuan\.com[^'"`\s]+/g, "javascript:void(0)");

            const newSource: CustomMusicSource = {
                id: Math.random().toString(36).substr(2, 9),
                name: newSourceName,
                url: newSourceUrl.startsWith('http') ? newSourceUrl : undefined,
                content: content,
                isActive: true,
                type: newSourceUrl.startsWith('http') ? 'http' : 'local'
            };

            setSettings(prev => ({
                ...prev,
                customMusicSources: [...(prev.customMusicSources || []), newSource]
            }));

            setNewSourceName('');
            setNewSourceUrl('');
            showToast("添加成功");
        } catch (error) {
            console.error("Add source error:", error);
            showToast("添加源失败，请检查链接或网络");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteSource = (id: string) => {
        setSettings(prev => ({
            ...prev,
            customMusicSources: prev.customMusicSources.filter(s => s.id !== id)
        }));
        showToast("已删除");
    };

    const toggleSource = (id: string) => {
        setSettings(prev => ({
            ...prev,
            customMusicSources: prev.customMusicSources.map(s => 
                s.id === id ? { ...s, isActive: !s.isActive } : s
            )
        }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-medium flex items-center gap-2">
                        <FileCodeIcon className="w-5 h-5 text-purple-400" />
                        Azu Music 源管理
                    </h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white p-1">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Add Source Form */}
                    <div className="space-y-3">
                        <div className="text-xs text-white/40 uppercase tracking-wider font-semibold">添加新源 (JS文件链接或代码)</div>
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="源名称 (例如: Azu定制源)"
                                value={newSourceName}
                                onChange={(e) => setNewSourceName(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-purple-500/50"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="JS 链接 (HTTP/HTTPS)"
                                    value={newSourceUrl}
                                    onChange={(e) => setNewSourceUrl(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-purple-500/50"
                                />
                                <button
                                    onClick={handleAddSource}
                                    disabled={isAdding}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isAdding ? '正在导入...' : <PlusIcon className="w-4 h-4" />}
                                    导入
                                </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        setNewSourceName('Azu定制VIP源');
                                        setNewSourceUrl('https://cdn.jsdelivr.net/gh/Macrohard0001/lx-ikun-music-sources@main/V260328/%E4%BC%98%E8%B4%A8-%E6%94%AF%E6%8C%81%E5%9B%9B%E5%B9%B3%E5%8F%B0FLAC/%E5%85%A8%E8%B1%86%E8%A6%81(%E8%81%9A%E5%90%88%E9%9F%B3%E6%BA%90)/%E5%85%A8%E8%B1%86%E8%A6%81-%E8%81%9A%E5%90%88%E9%9F%B3%E6%BA%90%20v9.3%2093%E7%89%B9%E4%BE%9B%E7%89%88.js');
                                        handleAddSource(); // Direct import requested
                                    }}
                                    className="text-[10px] px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md transition-all"
                                >
                                    ✨ 点击填入Azu版本魔改音源 (推荐)
                                </button>
                                <button
                                    onClick={() => {
                                        setNewSourceName('野草🌾 (稳定版)');
                                        setNewSourceUrl('https://cdn.jsdelivr.net/gh/pdone/lx-music-source@main/grass/latest.js');
                                    }}
                                    className="text-[10px] px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-md transition-all"
                                >
                                    <span className="line-through">🌾 点击填入 野草源</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 border-dashed hover:border-purple-500/50 rounded-lg px-4 py-2 text-white/50 text-xs flex items-center justify-center gap-2 transition-all">
                                    <PlusIcon className="w-3 h-3" />
                                    选择本地 JS 文件
                                    <input
                                        type="file"
                                        accept=".js"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = async (re) => {
                                                    const content = re.target?.result as string;
                                                    setNewSourceName(file.name.replace('.js', ''));
                                                    setNewSourceUrl(content);
                                                };
                                                reader.readAsText(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Existing Sources List */}
                    <div className="space-y-3">
                        <div className="text-xs text-white/40 uppercase tracking-wider font-semibold">已导入的源</div>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {(!settings.customMusicSources || settings.customMusicSources.length === 0) ? (
                                <div className="text-center py-8 text-white/30 text-sm italic">暂无自定义源</div>
                            ) : (
                                settings.customMusicSources.map(source => {
                                    const isAzuSource = source.name.includes('Azu定制VIP源');
                                    return (
                                        <div key={source.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${source.isActive ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/30'}`}>
                                                    <div className="relative">
                                                        <GlobeIcon className="w-5 h-5" />
                                                        {!source.isActive && <div className="absolute inset-0 flex items-center justify-center text-xs font-bold -rotate-45">✕</div>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className={`text-sm font-medium ${isAzuSource ? 'text-yellow-400 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-white'}`}>
                                                        {source.name}
                                                    </div>
                                                    <div className="text-white/30 text-xs truncate max-w-[200px]">
                                                        {isAzuSource ? '**********' : (source.url || '本地内容')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => toggleSource(source.id)}
                                                    className={`text-xs px-2 py-1 rounded border transition-colors ${source.isActive ? 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10' : 'border-white/10 text-white/30 hover:bg-white/5'}`}
                                                >
                                                    {source.isActive ? '运行中' : '已停用'}
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteSource(source.id)}
                                                    className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10 text-[10px] text-white/30 text-center">
                    支持 LX Music 标准源接口。导入后将在搜索结果中自动包含。
                </div>
            </div>
        </div>
    );
};

export default MusicSourceModal;
