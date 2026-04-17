import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
// FIX: Correctly import ImageGenerationResultItem and VideoGenerationResultItem types.
import type { Website, GroundedSearchResult, GroundingChunk, WebsiteAnalysis, AppSettings, ImageGenerationResultItem, VideoGenerationResultItem } from '../types';

// LAZY INITIALIZATION of the AI client
let ai: GoogleGenAI | null = null;
const getAi = (forceNew: boolean = false): GoogleGenAI => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API 密钥未设置或无效。请检查您的配置。");
    }
    if (!ai || forceNew) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    return ai;
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: '公司的名称或网站的标题。',
      },
      description: {
        type: Type.STRING,
        description: '关于该网站或公司业务的一句话简短描述。',
      },
      url: {
        type: Type.STRING,
        description: '官方网站的完整URL，以https://开头。',
      },
      type: {
        type: Type.STRING,
        description: '公司的业务类型，例如：制造商, 经销商, 服务提供商。'
      },
      region: {
        type: Type.STRING,
        description: '公司总部或主要运营区域，例如：北美, 欧洲, 亚洲。'
      },
      mainProducts: {
        type: Type.STRING,
        description: '公司的主要产品或服务类别，用逗号分隔，例如：智能设备, 软件服务。'
      }
    },
    required: ['name', 'description', 'url', 'type', 'region', 'mainProducts'],
  },
};

const analysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: '一段关于公司业务的详细总结，大约100-150字。',
        },
        detailedProducts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '一个包含5到10个该公司具体产品或服务类别的列表。',
        },
        keyTechnologies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '一个列出该公司拥有或使用的关键技术、专利或特色的列表。',
        },
        targetIndustries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '一个列出该公司产品或服务所面向的主要目标行业或客户群体的列表。',
        },
        contactEmail: {
            type: Type.STRING,
            description: '在网站上找到的主要联系电子邮件地址。如果找不到，则返回null。',
        },
    },
    required: ['summary', 'detailedProducts', 'keyTechnologies', 'targetIndustries', 'contactEmail'],
};

const randomSearchTopics = [
    "日本的独立游戏工作室", "欧洲的精酿啤酒厂", "高品质户外装备品牌", "可持续时尚品牌",
    "手工巧克力制造商", "专门生产奇异植物的苗圃", "顶级的第三方太空探索公司", "模块化合成器制造商",
    "独立的动画电影制片厂", "修复古董机械表的工匠", "生产专业级无人机的公司", "创新的厨房小工具设计公司",
    "专注于人工智能伦理的研究机构", "豪华电动自行车品牌", "定制机械键盘工作室", "提供太空旅游的公司"
];

export async function fetchWebsitesWithGemini(existingWebsites: Website[] = [], query: string, count: number = 8, settings: AppSettings): Promise<Website[]> {
    try {
        const aiInstance = getAi();
        const randomizationInstruction = settings.randomizeOrderEnabled
            ? `请给我一些意想不到但相关的结果。为了确保结果的随机性，请将 "${randomSearchTopics[Math.floor(Math.random() * randomSearchTopics.length)]}" 作为本次生成的创意灵感。`
            : "";
        
        const queryDescription = settings.randomizeOrderEnabled
            ? `独特、创新或不太知名的公司或组织`
            : `知名公司或组织`;

        const newnessQualifier = existingWebsites.length > 0 ? '全新的、' : '';

        let prompt = `请为我推荐${count}个${newnessQualifier}关于“${query}”的${queryDescription}的网站。${randomizationInstruction}`;

        if (existingWebsites.length > 0) {
            const existingUrls = existingWebsites.map(site => site.url).join(', ');
            prompt += `\n最重要的是，绝对不要包含以下列表中的网站：[${existingUrls}]。`;
        }
        
        prompt += `
返回结果为JSON格式，每个网站必须包含以下字段：
- name: 公司名称
- description: 一句话简短描述
- url: 官方网站的完整URL
- type: 公司的业务类型 (例如: 制造商, 经销商, 服务提供商)
- region: 公司总部或主要运营区域 (例如: 北美, 欧洲, 亚洲)
- mainProducts: 公司的主要产品或服务类别，用逗号分隔 (例如: 智能设备, 软件服务)`;
        
        const response = await aiInstance.models.generateContent({
            model: settings.apiEngine,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.9,
                ...(settings.breakSafetyLimits && { safetySettings })
            },
        });

        const jsonText = response.text.trim();
        const websites = JSON.parse(jsonText) as Website[];
        return websites;

    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        throw error;
    }
}

export async function fetchWithGoogleSearch(query: string, settings: AppSettings): Promise<GroundedSearchResult> {
    try {
        const aiInstance = getAi();
        const response = await aiInstance.models.generateContent({
           model: "gemini-2.5-flash",
           contents: query,
           config: {
             tools: [{googleSearch: {}}],
             temperature: 0.2, // Lower temperature for more factual, grounded answers
             ...(settings.breakSafetyLimits && { safetySettings })
           },
        });

        const text = response.text;
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const sources: GroundingChunk[] = chunks.filter(chunk => 'web' in chunk) as GroundingChunk[];

        return { text, sources };

    } catch (error) {
        console.error("Error fetching from Gemini API with Google Search:", error);
        throw error;
    }
}

export async function analyzeWebsite(url: string, settings: AppSettings): Promise<WebsiteAnalysis> {
    try {
        const aiInstance = getAi();
        const prompt = `你是一名专业的市场研究分析师。请根据你对网站 ${url} 内容的了解，提供一份结构化的商业智能分析。
请严格按照指定的JSON格式返回数据，不要添加任何额外的解释或文本。

提取以下信息：
- summary: 一段关于公司业务的详细总结，大约100-150字。
- detailedProducts: 一个包含5到10个该公司具体产品或服务类别的列表。
- keyTechnologies: 一个列出该公司拥有或使用的关键技术、专利或特色的列表。
- targetIndustries: 一个列出该公司产品或服务所面向的主要目标行业或客户群体的列表。
- contactEmail: 在网站上找到的主要联系电子邮件地址。如果找不到，请返回null。`;

        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-pro", // Using a more powerful model for better analysis
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisResponseSchema,
                temperature: 0.3,
                ...(settings.breakSafetyLimits && { safetySettings })
            },
        });

        const jsonText = response.text.trim();
        const analysis = JSON.parse(jsonText) as WebsiteAnalysis;
        return analysis;

    } catch (error) {
        console.error(`Error analyzing website ${url}:`, error);
        throw error;
    }
}