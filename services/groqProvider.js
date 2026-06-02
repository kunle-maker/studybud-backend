import Groq from 'groq-sdk';
import { GroqAPIError } from '../utils/errors.js';

class GroqProvider {
  constructor() {
    this._freeClients    = null;
    this._premiumClients = null;
    this._freeIndex      = 0;
    this._premiumIndex   = 0;
  }

  _buildClients(envMulti, envSingle) {
    const multi = process.env[envMulti]?.split(',').map(k => k.trim()).filter(Boolean) || [];
    if (multi.length) return multi.map(k => new Groq({ apiKey: k }));

    const single = process.env[envSingle]?.trim();
    if (single) return [new Groq({ apiKey: single })];

    return [];
  }

  get freeClients() {
    if (!this._freeClients) {
      this._freeClients = this._buildClients('GROQ_API_KEYS_FREE', 'GROQ_API_KEY_FREE');
      if (!this._freeClients.length) throw new GroqAPIError('No free-tier Groq keys configured (GROQ_API_KEYS_FREE or GROQ_API_KEY_FREE)');
    }
    return this._freeClients;
  }

  get premiumClients() {
    if (!this._premiumClients) {
      this._premiumClients = this._buildClients('GROQ_API_KEYS_PREMIUM', null);
    }
    return this._premiumClients;
  }

  _nextClient(role) {
    if (role === 'premium' && this.premiumClients.length) {
      const client = this.premiumClients[this._premiumIndex];
      this._premiumIndex = (this._premiumIndex + 1) % this.premiumClients.length;
      return client;
    }
    const client = this.freeClients[this._freeIndex];
    this._freeIndex = (this._freeIndex + 1) % this.freeClients.length;
    return client;
  }

  async chatCompletion(role, messages, options = {}) {
    const pool = role === 'premium' && this.premiumClients.length
      ? this.premiumClients
      : this.freeClients;

    const maxAttempts = pool.length;
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const client = this._nextClient(role);
      try {
        const { model, temperature, max_tokens, ...rest } = options;
        const response = await client.chat.completions.create({
          model:       model        || 'llama-3.3-70b-versatile',
          messages,
          temperature: temperature  ?? 0.7,
          max_tokens:  max_tokens   || 1024,
          ...rest
        });
        return response.choices[0].message.content;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) {
          console.warn(`Groq key [${role}] attempt ${attempt + 1} failed, trying next key...`);
        }
      }
    }

    throw new GroqAPIError(
      `Groq API call failed after ${maxAttempts} attempt(s): ${lastError?.message}`
    );
  }
}

const groqProvider = new GroqProvider();
export default groqProvider;
