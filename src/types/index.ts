export interface WebsiteAnalysis {
  summary: string;
  detailedProducts: string[];
  keyTechnologies: string[];
  targetIndustries: string[];
  contactEmail?: string;
}

export interface Website {
  name: string;
  description: string;
  url: string;
  type?: string;
  region?: string;
  mainProducts?: string;
  // New fields for analysis
  analysis?: WebsiteAnalysis;
  isAnalyzing?: boolean;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface GroundedSearchResult {
  text: string;
  sources: GroundingChunk[];
}

export interface ImageGenerationResultItem {
  url: string;
  alt: string;
}

export interface VideoGenerationResultItem {
  url: string;
  thumbnail: string;
  title: string;
}

export type MediaFavorite = (VideoGenerationResultItem | ImageGenerationResultItem) & {
  type: 'video' | 'image';
  apiId?: string;
  apiName?: string;
};

export interface ApiEndpoint {
  id: string;
  name: string;
  url: string;
}

export interface MusicInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  url: string;
  source: string;
  duration?: number;
  // Extra metadata for custom scripts
  mid?: string;
  rid?: string;
  hash?: string;
  albumId?: string;
  albumName?: string;
  songmid?: string;
  copyrightId?: string;
  name?: string;
  singer?: string;
}

export interface CustomMusicSource {
    id: string;
    name: string;
    url?: string;
    content?: string;
    isActive: boolean;
    type: 'http' | 'local';
}

export interface AppSettings {
  themeColor: string;
  blur: number;
  opacity: number;
  cardBlur: number;
  cardOpacity: number;
  moreSearchesEnabled: boolean;
  videoGenerationEnabled: boolean;
  imageGenerationEnabled: boolean;
  randomSearchEnabled: boolean;
  randomizeOrderEnabled: boolean;
  easterEggUnlocked: boolean;
  unlimitedSearchEnabled: boolean;
  unlimitedSearchCount: number;
  omniSearchUnlocked: boolean;
  omniSearchEnabled: boolean;
  searchEngine: 'gemini' | 'google';
  apiEngine: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  customRefreshIconUrl: string;
  breakSafetyLimits: boolean;
  sakuraEffectEnabled: boolean;
  // New API endpoint management
  videoApiEndpoints: ApiEndpoint[];
  imageApiEndpoints: ApiEndpoint[];
  selectedVideoApiId: string | null;
  selectedImageApiId: string | null;
  customMusicSources: CustomMusicSource[];
  hideOfficialMusicSources: boolean;
}
