import type { Handler, HandlerEvent } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";

// Schemas and prompt are copied here to make the function self-contained.
const singleStudySchema = {
    type: Type.OBJECT,
    properties: {
      drugName: { type: Type.STRING, description: "药物通用名称" },
      drugClass: { type: Type.STRING, description: "药物种类 (例如: GLP-1 RA, GIP/GLP-1)" },
      company: { type: Type.STRING, description: "研发药企" },
      trialName: { type: Type.STRING, description: "临床试验名称 (例如: SURMOUNT-1)" },
      phase: { type: Type.STRING, description: "试验分期 (例如: Phase 3)。必须返回 'Phase 1', 'Phase 2', 'Phase 3' 中的一个。如果文献中没有明确提及是这三期中的任何一期，则返回空字符串 ''。" },
      hasT2D: { type: Type.BOOLEAN, description: "该特定人群队列是否为2型糖尿病患者" },
      isChineseCohort: { type: Type.BOOLEAN, description: "该特定人群队列是否主要为中国人群 (e.g., STEP-China)" },
      durationWeeks: { type: Type.INTEGER, description: "试验持续周数" },
      summary: { type: Type.STRING, description: "一句话总结该队列的关键发现" },
      doses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dose: { type: Type.STRING, description: "剂量, e.g., '5mg'" },
            weightLossPercent: { type: Type.NUMBER, description: "体重下降百分比" },
            nauseaPercent: { type: Type.NUMBER, description: "恶心发生率百分比" },
            vomitingPercent: { type: Type.NUMBER, description: "呕吐发生率百分比" },
            diarrheaPercent: { type: Type.NUMBER, description: "腹泻发生率百分比" },
            constipationPercent: { type: Type.NUMBER, description: "便秘发生率百分比" },
          },
          required: ["dose", "weightLossPercent", "nauseaPercent", "vomitingPercent", "diarrheaPercent", "constipationPercent"],
        },
      },
    },
    required: ["drugName", "drugClass", "company", "trialName", "phase", "hasT2D", "isChineseCohort", "durationWeeks", "doses"],
};
  
const studySchema = {
    type: Type.OBJECT,
    properties: {
      studies: {
        type: Type.ARRAY,
        description: "从文献中提取的所有研究队列列表。一份文献可能包含多个独立分析的队列。",
        items: singleStudySchema,
      },
    },
    required: ['studies'],
};
  
const extractionPromptText = `你是一位专业的医学文献分析助手。
你的任务是从提供的临床试验文本、截图或图片中，提取关于减重药物的关键信息。
请根据提供的JSON schema进行分析并返回结果。

**重要规则**:
- **分析策略**: 如果文献中提到了多种分析策略（例如 '意向性治疗分析/Intention-To-Treat/ITT' 或 'Treatment Policy Strategy' vs. '符合方案分析/Per-Protocol'），你必须优先提取 **'意向性治疗分析 (Intention-To-Treat)'** 的结果，因为它更能反映真实世界的治疗效果。
- **排除安慰剂**: **绝对不要提取安慰剂 (placebo) 组的数据。** 只关注包含实际药物的治疗组 (treatment arms)。
- **分层分析**: 一份文献可能会对不同的人群进行分层分析 (stratified analysis)。例如，一篇关于中国人群的研究，可能同时包含了针对“2型糖尿病(T2D)患者”和“非糖尿病患者”的独立数据。在这种情况下，你必须将每一个独立分析的人群队列 (cohort) 作为一个单独的 "study" 对象进行提取。最终返回一个包含所有独立研究队列的数组。

关键提取点（针对每一个独立队列）:
1. **药物信息**: 通用名称、种类 (例如 GLP-1 RA, GIP/GLP-1)、研发公司。
2. **试验设计**: 试验名称/编号 (例如 SURMOUNT-1)、分期、该队列是否为2型糖尿病患者 (hasT2D)、该队列是否主要为中国人群 (isChineseCohort)、试验持续周数。
3. **疗效数据**: 每个剂量组的体重下降百分比。
4. **安全性数据**: 每个剂量组的恶心、呕吐、腹泻和便秘发生率百分比。

如果某个数值未在文献中报告，请将数值设为 0，字符串设为空字符串 ""。确保所有数字字段都是数字类型，而不是字符串。`;

const handler: Handler = async (event: HandlerEvent) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: "Gemini API Key is not configured on the server." }) 
        };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const { text, fileData } = body;

        const ai = new GoogleGenAI({ apiKey });
        let response;

        const config = {
            responseMimeType: "application/json",
            responseSchema: studySchema,
            temperature: 0.1,
        };

        if (text) {
            const userPrompt = `${extractionPromptText}\n\n文献内容:\n${text.substring(0, 30000)}`;
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: userPrompt,
                config,
            });
        } else if (fileData && fileData.data && fileData.mimeType) {
            const imagePart = { inlineData: { mimeType: fileData.mimeType, data: fileData.data } };
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [imagePart, { text: extractionPromptText }] },
                config,
            });
        } else {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: "Missing 'text' or 'fileData' in request body." }) 
            };
        }

        const jsonText = response.text;
        if (!jsonText) {
            throw new Error("API returned an empty response text.");
        }
        
        const parsedData = JSON.parse(jsonText);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsedData),
        };

    } catch (error) {
        console.error("Gemini Proxy Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error instanceof Error ? error.message : "An unknown error occurred on the server." }),
        };
    }
};

export { handler };
