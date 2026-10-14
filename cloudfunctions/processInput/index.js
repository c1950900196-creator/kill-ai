const cloud = require('wx-server-sdk');
const http = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const API_KEY = process.env.DOUBAO_API_KEY || '';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MODEL = 'doubao-seed-2-0-mini-260215';
const RATE_LIMIT_PER_MIN = Math.max(0, parseInt(process.env.PROCESS_INPUT_RATE_LIMIT_PER_MIN || '30', 10) || 30);
const FALLBACK_RATE_LIMIT_PER_MIN = Math.max(0, parseInt(process.env.PROCESS_INPUT_FALLBACK_RATE_LIMIT_PER_MIN || '20', 10) || 20);
const GLOBAL_MAX_PER_SEC = Math.max(0, parseInt(process.env.PROCESS_INPUT_GLOBAL_MAX_PER_SEC || '60', 10) || 60);

let globalBucketSec = 0;
let globalCount = 0;
let lastDegradeLogAt = 0;
const memUserRateMap = new Map();

function logDegradeOnce(message) {
  const now = Date.now();
  if (now - lastDegradeLogAt > 60000) {
    lastDegradeLogAt = now;
    console.warn(message);
  }
}

function checkGlobalThrottle() {
  if (GLOBAL_MAX_PER_SEC <= 0) return { ok: true };
  const sec = Math.floor(Date.now() / 1000);
  if (sec !== globalBucketSec) {
    globalBucketSec = sec;
    globalCount = 0;
  }
  globalCount += 1;
  if (globalCount > GLOBAL_MAX_PER_SEC) {
    return { ok: false, error: 'global_throttled', limit: GLOBAL_MAX_PER_SEC };
  }
  return { ok: true };
}

function checkMemoryRateLimit(openid) {
  if (FALLBACK_RATE_LIMIT_PER_MIN <= 0) return { ok: true, mode: 'memory' };
  const bucket = Math.floor(Date.now() / 60000);
  const key = `${openid}_${bucket}`;
  const next = (memUserRateMap.get(key) || 0) + 1;
  memUserRateMap.set(key, next);
  if (memUserRateMap.size > 5000) {
    const keys = Array.from(memUserRateMap.keys()).slice(0, 1000);
    keys.forEach(k => memUserRateMap.delete(k));
  }
  if (next > FALLBACK_RATE_LIMIT_PER_MIN) {
    return { ok: false, error: 'rate_limited', limit: FALLBACK_RATE_LIMIT_PER_MIN, mode: 'memory' };
  }
  return { ok: true, mode: 'memory' };
}

async function checkRateLimit(openid) {
  if (RATE_LIMIT_PER_MIN <= 0) return { ok: true, mode: 'db' };
  const minuteBucket = Math.floor(Date.now() / 60000);
  const docId = `${openid}_${minuteBucket}`;
  const col = db.collection('api_rate_limits');
  try {
    await col.doc(docId).update({
      data: {
        count: _.inc(1),
        updatedAt: db.serverDate()
      }
    });
  } catch (e) {
    if (e.errCode === -502005) {
      try {
        await col.doc(docId).set({
          data: {
            _openid: openid,
            minuteBucket,
            count: 1,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
      } catch (e2) {
        // 并发下可能被其他请求抢先创建，继续走读取判断
      }
    } else {
      logDegradeOnce(`[rate-limit] db unavailable, fallback to memory: ${e.errCode || ''} ${e.message || ''}`);
      return checkMemoryRateLimit(openid);
    }
  }

  try {
    const row = await col.doc(docId).get();
    const count = (row && row.data && row.data.count) || 0;
    if (count > RATE_LIMIT_PER_MIN) {
      return { ok: false, error: 'rate_limited', limit: RATE_LIMIT_PER_MIN, mode: 'db' };
    }
    return { ok: true, mode: 'db' };
  } catch (e) {
    logDegradeOnce(`[rate-limit] db read failed, fallback to memory: ${e.errCode || ''} ${e.message || ''}`);
    return checkMemoryRateLimit(openid);
  }
}

function callDoubao(systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 500,
      temperature: 0.9
    });

    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error('API response invalid: ' + data.substring(0, 200)));
          }
        } catch (e) {
          reject(new Error('JSON parse error: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('API request timeout'));
    });
    req.write(body);
    req.end();
  });
}

exports.main = async (event) => {
  const { systemPrompt, messages } = event;

  if (!systemPrompt || !messages) {
    return { success: false, error: 'missing systemPrompt or messages' };
  }

  if (!Array.isArray(messages) || messages.length > 20) {
    return { success: false, error: 'messages invalid or too many (max 20)' };
  }

  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return { success: false, error: 'invalid message format' };
    }
    if (String(msg.content).length > 500) {
      return { success: false, error: 'message content too long (max 500)' };
    }
  }

  if (String(systemPrompt).length > 3000) {
    return { success: false, error: 'systemPrompt too long (max 3000)' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, error: 'unauthorized' };
  }

  const globalCheck = checkGlobalThrottle();
  if (!globalCheck.ok) {
    return { success: false, error: `system busy, max ${globalCheck.limit}/sec` };
  }

  const rateCheck = await checkRateLimit(openid);
  if (!rateCheck.ok) {
    if (rateCheck.error === 'rate_limited') {
      return { success: false, error: `too many requests, max ${rateCheck.limit}/min` };
    }
    return { success: false, error: 'rate limit unavailable' };
  }

  if (!API_KEY) {
    return { success: false, error: 'DOUBAO_API_KEY not configured' };
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    try {
      const secRes = await cloud.openapi.security.msgSecCheck({
        content: String(lastUserMsg.content)
      });
      if (secRes.errCode === 87014) {
        return { success: false, error: 'content_risky', message: '输入内容包含违规信息，请换个说法再试' };
      }
    } catch (secErr) {
      console.warn('msgSecCheck failed, pass through:', secErr.errCode, secErr.message);
    }
  }

  try {
    const content = await callDoubao(systemPrompt, messages);
    return { success: true, content };
  } catch (e) {
    console.error('Doubao API error:', e.message);
    return { success: false, error: e.message };
  }
};
