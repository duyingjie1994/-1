import { GoogleGenAI, Type } from "@google/genai";
import { GraphData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCurriculumData = async (major: string): Promise<GraphData> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
    请为专业：“${major}” 生成一个大规模、高密度的OBE（成果导向教育）教育体系数据。
    
    我们需要4个层级的数据，体现从微观知识点到宏观培养目标的层层支撑关系。
    为了展示“稠密图”效果，请尽可能多生成一些节点（尤其是课程和知识点层级）。
    
    关键要求：
    1. **Layer 0 (培养目标)**: 4-5个 宏观目标。
    2. **Layer 1 (毕业要求)**: 8-10个 核心能力指标点。
    3. **Layer 2 (课程体系)**: 15-20门 核心及辅助课程。
    4. **Layer 3 (知识点)**: 30-40个 核心知识点。
    
    5. **支撑关系**: 建立非常密集的交叉连接（Mesh结构）。
       - 确保每个节点都至少有1-2条连线。
       - 课程和知识点之间应该是多对多的强关联。

    返回纯 JSON 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  layer: { type: Type.INTEGER, description: "0=培养目标, 1=毕业要求, 2=课程, 3=知识点" },
                  type: { type: Type.STRING, description: "One of: Objective, Requirement, Course, Knowledge" },
                  description: { type: Type.STRING }
                },
                required: ["id", "label", "layer", "type"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: "source node id" },
                  target: { type: Type.STRING, description: "target node id" }
                },
                required: ["source", "target"]
              }
            }
          },
          required: ["nodes", "links"]
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as GraphData;
    }
    throw new Error("No data returned");

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
