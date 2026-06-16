import Groq from 'groq-sdk';

let currentKeyIndex = 0;
let keysList = [];

const getClient = () => {
  const keysEnv = process.env.GROQ_API_KEYS_FREE;
  if (!keysEnv) throw new Error('GROQ_API_KEYS_FREE is not configured');
  keysList = keysEnv.split(',').map(k => k.trim());
  const currentKey = keysList[currentKeyIndex % keysList.length];
  return new Groq({ apiKey: currentKey });
};

const rotateToNextKey = () => {
  currentKeyIndex++;
  console.log(`Rotating to next Groq API key (index: ${currentKeyIndex})`);
};

const tryWithAllKeys = async (imageBase64, mimeType, retryCount = 0) => {
  if (retryCount >= keysList.length) {
    throw new Error('All Groq API keys have failed');
  }
  const client = getClient();
  try {
    return await makeVerificationRequest(client, imageBase64, mimeType);
  } catch (error) {
    if (error.message?.includes('API Key') || error.status === 401) {
      rotateToNextKey();
      return tryWithAllKeys(imageBase64, mimeType, retryCount + 1);
    }
    throw error;
  }
};

const makeVerificationRequest = async (client, imageBase64, mimeType) => {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos'
  });
  const todayISO = now.toISOString().split('T')[0];

  const prompt = `You are a payment receipt verifier for StudyBud. Today's date is ${todayStr} (${todayISO}, Africa/Lagos timezone).

Carefully examine this payment/transfer receipt image and check ALL of the following:

1. Is the recipient name "Ayodele Ganiyu" (or very close variation like "Ayodele G" or "A. Ganiyu")?
2. Is the bank/wallet "SmartCash" (or "Smart Cash")?
3. Is the amount exactly ₦200 (or 200 NGN)?
4. Does it look like a genuine transfer receipt (not a screenshot of a blank form or edited image)?
5. Is the receipt date today (${todayStr}) or at most 1 day old? Receipts older than 1 day have date_valid=false.
6. Is there a transaction reference ID, receipt number, session ID, or any unique transaction code visible anywhere on the receipt? Extract it exactly as shown — include all digits and letters.

Respond ONLY with a valid JSON object — no explanation, no markdown, just raw JSON:
{
  "valid": true or false,
  "core_valid": true or false,
  "reason": "brief one-sentence explanation",
  "detected_name": "the recipient name you saw or null",
  "detected_amount": "the amount you saw or null",
  "detected_bank": "the bank/wallet name you saw or null",
  "detected_date": "the transaction date you saw on the receipt or null",
  "date_valid": true or false,
  "detected_transaction_id": "the unique transaction reference/ID/code you saw or null"
}

IMPORTANT:
- "valid" = true only if name, bank, amount, genuine, AND date are all correct.
- "core_valid" = true if name, bank, amount, and genuine look correct (regardless of date).
- "date_valid" = false if the date is missing, unclear, or older than 1 day.
- "detected_transaction_id" = the exact transaction reference string visible, or null if none found.`;

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
    max_tokens: 450
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
      core_valid: false,
      reason: 'Could not read the receipt. Please upload a clear screenshot.',
      detected_name: null,
      detected_amount: null,
      detected_bank: null,
      detected_date: null,
      date_valid: false,
      detected_transaction_id: null
    };
  }

  return {
    valid: result.valid === true,
    core_valid: result.core_valid === true,
    reason: result.reason || '',
    detected_name: result.detected_name || null,
    detected_amount: result.detected_amount || null,
    detected_bank: result.detected_bank || null,
    detected_date: result.detected_date || null,
    date_valid: result.date_valid === true,
    detected_transaction_id: result.detected_transaction_id || null
  };
};

export const verifyPaymentReceipt = async (imageBase64, mimeType = 'image/jpeg') => {
  const keysEnv = process.env.GROQ_API_KEYS_FREE;
  if (!keysEnv) throw new Error('GROQ_API_KEYS_FREE is not configured');
  keysList = keysEnv.split(',').map(k => k.trim());
  currentKeyIndex = 0;
  return tryWithAllKeys(imageBase64, mimeType);
};
