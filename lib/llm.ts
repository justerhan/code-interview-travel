import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function model() {
  return {
    name: 'gpt-4o-mini',
  };
}