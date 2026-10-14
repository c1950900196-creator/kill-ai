const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const MAX_LIMIT = 100;
const OVERVIEW_CACHE_TTL_MS = 10000;
let overviewCache = { at: 0, data: null };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function jsonResp(data, statusCode = 200) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

function pickAdminToken(event, data) {
  const headers = event.headers || {};
  const headerToken = headers['x-admin-token'] || headers['X-Admin-Token'] || '';
  if (event.httpMethod) {
    // HTTP 触发仅允许从 header 读取，避免 token 出现在 URL/query 中。
    return headerToken;
  }
  return headerToken || (data && data.adminToken) || event.adminToken || '';
}

async function getAll(collection, where = {}, orderField = 'startTime', orderDir = 'desc') {
  const countRes = await db.collection(collection).where(where).count();
  const total = countRes.total;
  if (total === 0) return [];
  const batchTimes = Math.ceil(total / MAX_LIMIT);
  const tasks = [];
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection(collection).where(where)
        .skip(i * MAX_LIMIT).limit(MAX_LIMIT)
        .orderBy(orderField, orderDir).get()
    );
  }
  const results = await Promise.all(tasks);
  return results.reduce((acc, cur) => acc.concat(cur.data), []);
}

async function getMessagesBySession(sessionId) {
  try {
    return await getAll('game_messages', { sessionId }, 'timestamp', 'asc');
  } catch (e) {
    console.error('[adminApi] getMessagesBySession fallback:', e.message);
    return [];
  }
}

async function getOverviewFromStats() {
  try {
    const statsDoc = await db.collection('admin_overview_stats').doc('main').get();
    const users = await getAll('admin_user_stats', {}, 'lastPlayTime', 'desc');
    return {
      success: true,
      totalUsers: (statsDoc.data && statsDoc.data.totalUsers) || users.length,
      totalSessions: (statsDoc.data && statsDoc.data.totalSessions) || 0,
      users: users.map(u => ({
        openid: u.openid || u._id,
        nickname: u.nickname || '匿名用户',
        avatar: u.avatar || '',
        totalGames: u.totalGames || 0,
        totalMessages: u.totalMessages || 0,
        lastPlayTime: u.lastPlayTime || null,
        victories: u.victories || 0
      }))
    };
  } catch (e) {
    return null;
  }
}

exports.main = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResp({});
  }

  let action, data;
  try {
    if (event.httpMethod === 'GET') {
      action = event.queryStringParameters && event.queryStringParameters.action;
      data = event.queryStringParameters || {};
    } else {
      const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
      action = body.action || (event.queryStringParameters && event.queryStringParameters.action);
      data = body.data || body;
    }
  } catch (e) {
    action = event.action;
    data = event.data || {};
  }

  if (!action) {
    action = event.action;
    data = event.data || {};
  }

  const expectedToken = process.env.ADMIN_API_TOKEN || '';
  if (!expectedToken) {
    return jsonResp({ success: false, error: 'ADMIN_API_TOKEN not configured' }, 500);
  }
  const providedToken = pickAdminToken(event, data);
  if (providedToken !== expectedToken) {
    return jsonResp({ success: false, error: 'unauthorized' }, 401);
  }

  try {
    if (action === 'overview') {
      const now = Date.now();
      if (overviewCache.data && (now - overviewCache.at) < OVERVIEW_CACHE_TTL_MS) {
        return jsonResp(overviewCache.data);
      }
      const statsPayload = await getOverviewFromStats();
      if (statsPayload) {
        overviewCache = { at: now, data: statsPayload };
        return jsonResp(statsPayload);
      }
      const sessions = await getAll('game_sessions');
      const userMap = {};
      sessions.forEach(s => {
        if (!userMap[s._openid]) {
          userMap[s._openid] = {
            openid: s._openid,
            nickname: s.nickname || '匿名用户',
            avatar: s.avatar || '',
            totalGames: 0,
            totalMessages: 0,
            lastPlayTime: null,
            victories: 0
          };
        }
        const u = userMap[s._openid];
        u.totalGames++;
        u.totalMessages += (typeof s.messageCount === 'number' ? s.messageCount : (s.messages || []).length);
        if (s.result === 'victory') u.victories++;
        if (!u.lastPlayTime || (s.startTime && s.startTime > u.lastPlayTime)) {
          u.lastPlayTime = s.startTime;
          u.nickname = s.nickname || u.nickname;
          u.avatar = s.avatar || u.avatar;
        }
      });

      const payload = {
        success: true,
        totalUsers: Object.keys(userMap).length,
        totalSessions: sessions.length,
        users: Object.values(userMap).sort((a, b) => (b.lastPlayTime || 0) - (a.lastPlayTime || 0))
      };
      overviewCache = { at: now, data: payload };
      return jsonResp(payload);
    }

    if (action === 'userSessions') {
      const openid = data.openid;
      if (!openid) return jsonResp({ success: false, error: 'missing openid' }, 400);
      const sessions = await getAll('game_sessions', { _openid: openid });
      return jsonResp({ success: true, sessions });
    }

    if (action === 'sessionDetail') {
      const sessionId = data.sessionId;
      if (!sessionId) return jsonResp({ success: false, error: 'missing sessionId' }, 400);
      const res = await db.collection('game_sessions').doc(sessionId).get();
      const messageRows = await getMessagesBySession(sessionId);
      const session = res.data;
      if (messageRows.length > 0) {
        session.messages = messageRows;
      } else {
        session.messages = session.messages || [];
      }
      return jsonResp({ success: true, session });
    }

    return jsonResp({ success: false, error: 'unknown action' }, 400);
  } catch (e) {
    return jsonResp({ success: false, error: e.message }, 500);
  }
};
