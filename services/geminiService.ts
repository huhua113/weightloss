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


// PDF.js is loaded from a CDN, so we can use it directly.
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

const callGeminiProxy = async (payload: { text?: string; fileData?: { data: string; mimeType: string; } }): Promise<any> => {
    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
        const errorMessage = responseData.error || `Proxy request failed with status ${response.status}`;
        throw new Error(errorMessage);
    }

    return responseData;
};

const processApiResponse = (data: any): (Omit<Study, 'id' | 'createdAt'>)[] => {
    if (!data.studies || !Array.isArray(data.studies)) {
        throw new Error("API 响应中未包含有效的 'studies' 数组。");
    }
    
    // Capitalize drug names for consistency
    const capitalizedStudies = data.studies.map((study: any) => {
        if (study.drugName && typeof study.drugName === 'string') {
            study.drugName = study.drugName.charAt(0).toUpperCase() + study.drugName.slice(1).toLowerCase();
        }
        return study;
    });

    return capitalizedStudies as (Omit<Study, 'id' | 'createdAt'>)[];
}

export const analyzeMedicalText = async (text: string): Promise<(Omit<Study, 'id' | 'createdAt'>)[]> => {
  try {
    const data = await callGeminiProxy({ text });
    return processApiResponse(data);
  } catch (error) {
    console.error("Gemini Text Extraction Error via Proxy:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API 调用失败: ${error.message}`);
    }
    throw new Error("无法从文献中提取有效信息，请检查文件内容或联系管理员。");
  }
};

export const analyzeMedicalImage = async (file: File): Promise<(Omit<Study, 'id' | 'createdAt'>)[]> => {
  try {
    const base64Data = await fileToBase64(file);
    const data = await callGeminiProxy({ fileData: { data: base64Data, mimeType: file.type } });
    return processApiResponse(data);
  } catch (error) {
    console.error("Gemini Image Extraction Error via Proxy:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API 调用失败: ${error.message}`);
    }
    throw new Error("无法从图片中提取有效信息，请检查图片内容或联系管理员。");
  }
};
