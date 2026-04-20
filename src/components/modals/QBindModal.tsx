import React, { useState, useContext, useEffect } from 'react';
import { UIContext } from '../../contexts/UIContext';
import { SettingsContext } from '../../contexts/SettingsContext';
import { Loader } from '../Loader';
import { SearchIcon, UndoIcon } from '../Icons';
import axios from 'axios';

import { isColorLight } from '../../utils/colorUtils';

export const QBindModal: React.FC = () => {
    const { isQBindModalOpen, setIsQBindModalOpen, showToast } = useContext(UIContext);
    const { settings } = useContext(SettingsContext);
    const [qq, setQq] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    const buttonTextColor = isColorLight(settings.themeColor) ? 'text-slate-900' : 'text-white';

    useEffect(() => {
        if (!isQBindModalOpen) {
            setQq('');
            setResult(null);
            setShowDisclaimer(false);
        }
    }, [isQBindModalOpen]);

    const handleSearchClick = () => {
        if (!qq.trim()) {
            showToast('请输入QQ号');
            return;
        }
        setShowDisclaimer(true);
    };

    const handleConfirmSearch = async () => {
        setShowDisclaimer(false);
        setIsLoading(true);
        setResult(null);
        try {
            const response = await axios.post('/api/q-bind', { qq });
            setResult(response.data);
        } catch (error: any) {
            console.error('Q-bind search error:', error.message || error);
            showToast('查询失败，请稍后再试');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isQBindModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-[2px] sm:backdrop-blur-md animate-fade-in">
            {/* Disclaimer Modal */}
            {showDisclaimer && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4 animate-scale-up">
                        <div className="text-center space-y-2">
                            <h4 className="text-lg font-bold text-white font-sans">查询提示</h4>
                            <p className="text-slate-300 text-sm font-sans leading-relaxed">
                                注意：目前查询库为8E数据，旧Q号成功概率大，看情况更新优化。
                            </p>
                            <p className="text-slate-500 text-xs font-sans">
                                仅供学习娱乐，不做违法行为。
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowDisclaimer(false)}
                                className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-all font-sans"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleConfirmSearch}
                                className={`flex-1 px-4 py-2.5 bg-[var(--theme-color)] ${buttonTextColor} font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all font-sans`}
                            >
                                继续查询
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-down">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                    <h3 className="text-xl font-bold text-white font-sans flex items-center gap-2">
                        <SearchIcon /> Q绑查询
                    </h3>
                    <button 
                        onClick={() => setIsQBindModalOpen(false)}
                        className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    >
                        <UndoIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 font-sans">请输入QQ号</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={qq}
                                onChange={(e) => setQq(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                                placeholder="例如: 649189126"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all font-sans"
                            />
                            <button 
                                onClick={handleSearchClick}
                                disabled={isLoading}
                                className={`flex-shrink-0 px-4 sm:px-6 py-3 bg-[var(--theme-color)] ${buttonTextColor} font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[90px] whitespace-nowrap`}
                            >
                                {isLoading ? <Loader /> : <SearchIcon />}
                                <span className="hidden sm:inline">查询</span>
                            </button>
                        </div>
                    </div>

                    {result && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3 animate-fade-in">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">查询结果</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(result).map(([key, value], index) => {
                                    const displayKey = key === 'p' ? '手机号' : key;
                                    return (
                                        <div key={`${key}-${index}`} className="flex justify-between items-center p-2 rounded-lg bg-slate-900/50">
                                            <span className="text-slate-500 text-sm font-sans">{displayKey}</span>
                                            <span className="text-white font-medium font-sans">{String(value)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {!result && !isLoading && (
                        <div className="text-center py-8 text-slate-500 font-sans italic">
                            输入QQ号并点击查询以获取信息
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-800/30 text-center">
                    <p className="text-[10px] text-slate-500 font-sans">
                        本功能仅供学习交流使用，请勿用于非法用途
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QBindModal;
