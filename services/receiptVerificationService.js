import Groq from 'groq-sdk';

const EXPECTED_AMOUNT = 1000;
const EXPECTED_RECIPIENT_NAME = 'Ayodele Ganiyu';
const EXPECTED_BANK = 'SmartCash';

const getClient = () => {
  const key = process.env.GROQ_API_KEY_FREE;
  if (!key) throw new Error('GROQ_API_KEY_FREE is not configured');
  return new Groq({ apiKey: key });
};

export const verifyPaymentReceipt = async (imageBase64, mimeType = 'image/jpeg') => {
  const client = getClient();

  const prompt = `You are a payment receipt verifier for StudyFlow. Carefully examine this payment/transfer receipt image.

Check ALL of the following:
1. Is the recipient name "Ayodele Ganiyu" (or very close variation like "Ayodele G" or "A. Ganiyu")?
2. Is the bank/wallet "SmartCash" (or "Smart Cash")?
3. Is the amount exactly ₦1,000 (or 1000 NGN)?
4. Does it look like a genuine transfer receipt (not a screenshot of a blank form or edited image)?

Respond ONLY with a valid JSON object — no explanation, no markdown, just raw JSON:
{
  "valid": true or false,
  "reason": "brief one-sentence explanation",
  "detected_name": "the recipient name you saw or null",
  "detected_amount": "the amount you saw or null",
  "detected_bank": "the bank/wallet name you saw or null"
}`;

  const response = await client.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 300
  });

  const raw = response.choices[0].message.content.trim();

  let result;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    result = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      valid: false,
      reason: 'Could not read the receipt. Please upload a clear screenshot.',
      detected_name: null,
      detected_amount: null,
      detected_bank: null
    };
  }

  return {
    valid: result.valid === true,
    reason: result.reason || '',
    detected_name: result.detected_name || null,
    detected_amount: result.detected_amount || null,
    detected_bank: result.detected_bank || null
  };
};
