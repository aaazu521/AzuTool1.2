import React, { memo } from 'react';
import type { GroundedSearchResult } from '../types';
import { LinkIcon } from './Icons';

export const GroundedSearchResultDisplay: React.FC<{ result: GroundedSearchResult }> = memo(({ result }) => {
  return (
    <div className="my-8 p-6 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-lg max-w-4xl mx-auto animate-fade-in-down font-sans">
      <div 
        className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap mb-8"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        {result.text}
      </div>
      
      {result.sources.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[var(--theme-color)] mb-4 flex items-center">
            <LinkIcon />
            <span className="ml-2">来源</span>
          </h3>
          <ul className="space-y-2">
            {result.sources.map((source, index) => (
              <li key={index} className="text-sm">
                <a 
                  href={source.web.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-slate-400 hover:text-[var(--theme-color)] hover:underline transition-colors group"
                >
                  <span className="font-semibold mr-2 bg-slate-700/50 w-6 h-6 flex items-center justify-center rounded-full text-xs group-hover:bg-[var(--theme-color)] group-hover:text-white transition-colors">{index + 1}</span>
                  <span className="truncate">{source.web.title || source.web.uri}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});