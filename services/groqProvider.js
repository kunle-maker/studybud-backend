import Groq from 'groq-sdk';
import { GroqAPIError } from '../utils/errors.js';

class GroqProvider {
  constructor() {
    this._freeClient = null;
    this._premiumClients = null;
    this.currentIndex = 0;
  }

  get freeClient() {
    if (!this._freeClient) {
      const key = process.env.GROQ_API_KEY_FREE;
      if (!key) throw new GroqAPIError('GROQ_API_KEY_FREE is not configured');
      this._freeClient = new Groq({ apiKey: key });
    }
    return this._freeClient;
  }

  get premiumClients() {
    if (!this._premiumClients) {
      const keys = process.env.GROQ_API_KEYS_PREMIUM?.split(',').filter(Boolean) || [];
      this._premiumClients = keys.map((k) => new Groq({ apiKey: k }));
    }
    return this._premiumClients;
  }

  getClient(role) {
    if (role !== 'premium' || this.premiumClients.length === 0) {
      return this.freeClient;
    }
    const client = this.premiumClients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.premiumClients.length;
    return client;
  }

  async chatCompletion(role, messages, options = {}) {
    const maxRetries = role === 'premium' && this.premiumClients.length > 0
      ? this.premiumClients.length
      : 1;
    let attempts = 0;
    let lastError;

    while (attempts < maxRetries) {
      const client = this.getClient(role);
      try {
        const { model, temperature, max_tokens, ...rest } = options;
        const response = await client.chat.completions.create({
          model: model || 'llama-3.3-70b-versatile',
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens || 1024,
          ...rest
        });
        return response.choices[0].message.content;
      } catch (error) {
        lastError = error;
        attempts++;
        if (role !== 'premium') break;
        if (attempts < maxRetries) {
          console.warn(`Groq key failed, switching to next...`);
        }
      }
    }

    throw new GroqAPIError(
      `Groq API call failed after ${attempts} attempt(s): ${lastError?.message}`
    );
  }
}

const groqProvider = new GroqProvider();
export default groqProvider;
