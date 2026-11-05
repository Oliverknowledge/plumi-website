import http from 'node:http';
import { gzipSync } from 'node:zlib';

/** Shape every calculator response, including dedicated-worker requests which
 * Chrome's page-only network emulation does not slow. One shared byte budget
 * prevents parallel requests from multiplying the configured bandwidth.
 */
export async function calculatorThrottleProxy(upstream, { latency, downloadThroughput }) {
  const queue = [];
  let previous = performance.now();
  let credit = 0;
  const tick = setInterval(() => {
    const now = performance.now();
    const elapsed = now - previous;
    previous = now;
    if (!queue.length) { credit = 0; return; }
    credit += downloadThroughput * elapsed / 1000;
    let budget = Math.min(Math.floor(credit), Math.floor(downloadThroughput / 10));
    while (budget > 0 && queue.length) {
      const job = queue.shift();
      if (job.response.destroyed) continue;
      const count = Math.min(budget, job.body.length - job.offset);
      job.response.write(job.body.subarray(job.offset, job.offset + count));
      job.offset += count;
      budget -= count;
      credit -= count;
      if (job.offset === job.body.length) job.response.end(); else queue.push(job);
    }
  }, 20);
  const server = http.createServer(async (request, response) => {
    try {
      const calculator = request.url.startsWith('/calculator/');
      const headers = { ...request.headers, host: new URL(upstream).host };
      delete headers['accept-encoding'];
      // Use HTTP directly: fetch() adds no-cache to conditional requests and
      // would turn a legitimate 304 repeat visit into a full download.
      const destination = new URL(request.url, upstream);
      const result = await new Promise((resolve, reject) => {
        const connection = http.request(destination, { headers, method: request.method }, incoming => {
          const chunks = [];
          incoming.on('data', chunk => chunks.push(chunk));
          incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(chunks) }));
          incoming.on('error', reject);
        });
        connection.on('error', reject);
        connection.end();
      });
      let body = result.body;
      const mime = result.headers['content-type'] || '';
      if (body.length && /javascript|text\/|json|svg|wasm/.test(mime) && request.headers['accept-encoding']?.includes('gzip')) {
        body = gzipSync(body);
        response.setHeader('Content-Encoding', 'gzip');
      }
      if (calculator) await new Promise(resolve => setTimeout(resolve, latency));
      response.statusCode = result.status;
      Object.entries(result.headers).forEach(([name, value]) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name)) response.setHeader(name, value);
      });
      if (calculator && body.length) queue.push({ response, body, offset: 0 });
      else response.end(body);
    } catch (error) { response.statusCode = 502; response.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => { clearInterval(tick); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}
