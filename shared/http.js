/**
 * Small HTTP helpers for the JSON routes every feature panel calls.
 */

/** Hard cap on one request body shared by all features. */
export const BODY_LIMIT_BYTES = 4 * 1024 * 1024;

/**
 * Read one request body while refusing oversized payloads.
 * @param req - Node request stream.
 * @returns the decoded body text.
 */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > BODY_LIMIT_BYTES) {
        reject(Object.assign(new Error('request body is too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Send one JSON response.
 * @param res - Node response.
 * @param status - HTTP status code.
 * @param payload - JSON-serializable body.
 */
export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}
