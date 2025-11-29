import { Study } from "../types";

// Helper to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // result is "data:image/jpeg;base64,...."
      // we need to remove the prefix "data:...,"
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

// PDF text extraction remains on the client-side for performance.
export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
  let fullText = "";

  const maxPages = Math.min(pdf.numPages, 15);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }

  return fullText;
};

// This function now calls our secure Netlify Function proxy
const callProxyApi = async (payload: { text?: string; fileData?: { data: string; mimeType:string; } }): Promise<any> => {
  const response = await fetch('/api/gemini-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: '无法解析来自代理的错误响应。' }));
    // This handles both network errors and the HTML 404 page from Netlify if routing fails
    if (response.headers.get("content-type")?.includes("text/html")) {
        throw new Error(`API 代理路由错误 (${response.status}): 未找到函数。请检查 netlify.toml 配置。`);
    }
    throw new Error(`API 代理错误 (${response.status}): ${errorBody.error || response.statusText}`);
  }

  return response.json();
}

const processApiResponse = (data: any): (Omit<Study, 'id' | 'createdAt'>)[] => {
    if (!data.studies || !Array.isArray(data.studies)) {
        throw new Error("API 响应中未包含有效的 'studies' 数组。");
    }
    
    // Capitalize drug names for consistency
    return data.studies.map((study: any) => {
        if (study.drugName && typeof study.drugName === 'string') {
            study.drugName = study.drugName.charAt(0).toUpperCase() + study.drugName.slice(1).toLowerCase();
        }
        return study;
    });
}

export const analyzeMedicalText = async (text: string): Promise<(Omit<Study, 'id' | 'createdAt'>)[]> => {
  try {
    const data = await callProxyApi({ text });
    return processApiResponse(data);
  } catch (error) {
    console.error("Gemini Text Extraction Error:", error);
    if (error instanceof Error) {
        throw new Error(`文献分析失败: ${error.message}`);
    }
    throw new Error("无法从文献中提取有效信息，请检查文件内容或联系管理员。");
  }
};

export const analyzeMedicalImage = async (file: File): Promise<(Omit<Study, 'id' | 'createdAt'>)[]> => {
  try {
    const base64Data = await fileToBase64(file);
    const data = await callProxyApi({ fileData: { data: base64Data, mimeType: file.type } });
    return processApiResponse(data);
  } catch (error) {
    console.error("Gemini Image Extraction Error:", error);
    if (error instanceof Error) {
        throw new Error(`图片分析失败: ${error.message}`);
    }
    throw new Error("无法从图片中提取有效信息，请检查图片内容或联系管理员。");
  }
};
