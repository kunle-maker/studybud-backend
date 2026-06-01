import https from 'https';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const BASE_URL = 'api.paystack.co';

const paystackRequest = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Failed to parse Paystack response'));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

export const initializeTransaction = async ({ email, amount, metadata = {}, callbackUrl }) => {
  if (!PAYSTACK_SECRET) throw new Error('Paystack secret key is not configured');

  const body = {
    email,
    amount: Math.round(amount * 100),
    metadata,
    callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL
  };

  const response = await paystackRequest('POST', '/transaction/initialize', body);
  if (!response.status) throw new Error(response.message || 'Paystack initialization failed');
  return response.data;
};

export const verifyTransaction = async (reference) => {
  if (!PAYSTACK_SECRET) throw new Error('Paystack secret key is not configured');

  const response = await paystackRequest('GET', `/transaction/verify/${reference}`);
  if (!response.status) throw new Error(response.message || 'Paystack verification failed');
  return response.data;
};
