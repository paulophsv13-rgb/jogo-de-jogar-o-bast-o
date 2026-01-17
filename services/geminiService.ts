
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getCombatCommentary(score: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `O jogador atingiu uma pontuação de ${score} no jogo 'Jogue o Bastão'. Dê um comentário motivador curto e agressivo (estilo locutor de arena) em português brasileiro. Máximo 10 palavras. Foque na destruição e força.`,
    });
    return response.text?.trim() || "Destruição total!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Esmague todos!";
  }
}

export async function getRankName(score: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Crie um título de guerreiro curto em português brasileiro para alguém com score ${score}. Exemplo: 'O Flagelo de Madeira'. Apenas o título.`,
    });
    return response.text?.trim() || "Guerreiro do Bastão";
  } catch (error) {
    return "Recruta";
  }
}