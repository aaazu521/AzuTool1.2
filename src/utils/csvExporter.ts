import type { Website } from '../types';

// Add this interface to avoid TypeScript errors for the environment-specific API
// FIX: Replaced the conflicting inline type for `window.aistudio` with a correctly defined/augmented `AIStudio` interface to resolve type errors.
declare global {
  interface AIStudio {
    download: (options: { filename: string; content: Blob }) => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

export const exportWebsitesToCSV = (websitesToExport: Website[]) => {
  if (websitesToExport.length === 0) return;
  const headers = ['Name', 'Type', 'Region', 'Main Products', 'Description', 'URL'];
  const rows = websitesToExport.map(site => [
      `"${(site.name || '').replace(/"/g, '""')}"`,
      `"${(site.type || '').replace(/"/g, '""')}"`,
      `"${(site.region || '').replace(/"/g, '""')}"`,
      `"${(site.mainProducts || '').replace(/"/g, '""')}"`,
      `"${(site.description || '').replace(/"/g, '""')}"`,
      `"${site.url}"`
  ]);
  const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "exported_websites.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadMedia = async (url: string, filename: string): Promise<void> => {
    // Check for the preferred download method in the environment
    if (window.aistudio && typeof window.aistudio.download === 'function') {
        try {
            // Fetch the content regardless of whether it's a data URL or a remote URL
            // to ensure we always have a blob to pass to the native download function.
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const blob = await response.blob();
            
            await window.aistudio.download({ filename, content: blob });
            return; // Download initiated, we're done.
        } catch (error) {
            console.error("aistudio.download failed, falling back to browser download.", error);
            // If aistudio.download fails for some reason, we can still fall through to the browser method.
        }
    }

    // Fallback to browser-based download method
    const triggerDownload = (href: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    // For data URLs, we can handle them directly without a fetch request.
    if (url.startsWith('data:')) {
        triggerDownload(url);
        return;
    }

    // For regular URLs, we first try to fetch.
    // This is the most reliable method but can be blocked by CORS.
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`网络响应不佳: ${response.statusText}`);
        }
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        triggerDownload(objectUrl);
        // Clean up the object URL after the download is initiated.
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);
    } catch (error) {
        console.warn("直接下载失败 (可能是CORS问题):", error);
        // As a fallback, try a direct link download.
        // This might open in a new tab if the server has 'Content-Disposition: inline'.
        try {
            console.log("尝试备用下载方法...");
            triggerDownload(url);
        } catch (fallbackError) {
             console.error("备用下载方法也失败了:", fallbackError);
             // As a final fallback, open in a new tab.
             window.open(url, '_blank');
             throw new Error("无法自动下载文件，已尝试在新标签页中打开。");
        }
    }
};
