const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const MAX_LIMIT = 100;
const OVERVIEW_CACHE_TTL_MS = 10000;
let overviewCache = { at: 0, data: null };

function pickAdminToken(event, data) {
  return (data && data.adminToken) || event.adminToken || '';
}

async function getAll(collection, where = {}, orderField = 'startTime', orderDir = 'desc') {
  const countRes = await db.collection(collection).where(where).count();
  const total = countRes.total;
  if (total === 0) return [];
  const batchTimes = Math.ceil(total / MAX_LIMIT);
  const tasks = [];
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection(collection).where(where).skip(i * MAX_LIMIT).limit(MAX_LIMIT).orderBy(orderField, orderDir).get()
    );
  }
  const results = await Promise.all(tasks);
  return results.reduce((acc, cur) => acc.concat(cur.data), []);
}

async function getMessagesBySession(sessionId) {
  try {
    const countRes = await db.collection('game_messages').where({ sessionId }).count();
    const total = countRes.total;
    if (total === 0) return [];
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection('game_messages').where({ sessionId }).skip(i * MAX_LIMIT).limit(MAX_LIMIT).orderBy('timestamp', 'asc').get()
      );
    }
    const results = await Promise.all(tasks);
    return results.reduce((acc, cur) => acc.concat(cur.data), []);
  } catch (e) {
    console.error('[getAdminData] getMessagesBySession fallback:', e.message);
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
  const wxContext = cloud.getWXContext();
  const { action, data } = event;
  const expectedToken = process.env.ADMIN_API_TOKEN || '';
  if (!expectedToken) return { success: false, error: 'ADMIN_API_TOKEN not configured' };
  if (pickAdminToken(event, data) !== expectedToken) return { success: false, error: 'unauthorized' };

  try {
    if (action === 'overview') {
      const now = Date.now();
      if (overviewCache.data && (now - overviewCache.at) < OVERVIEW_CACHE_TTL_MS) {
        return overviewCache.data;
      }
      const statsPayload = await getOverviewFromStats();
      if (statsPayload) {
        overviewCache = { at: now, data: statsPayload };
        return statsPayload;
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
      return payload;
    }

    if (action === 'userSessions') {
      const sessions = await getAll('game_sessions', { _openid: data.openid });
      return { success: true, sessions };
    }

    if (action === 'sessionDetail') {
      const res = await db.collection('game_sessions').doc(data.sessionId).get();
      const session = res.data;
      const messages = await getMessagesBySession(data.sessionId);
      session.messages = messages.length > 0 ? messages : (session.messages || []);
      return { success: true, session };
    }

    return { success: false, error: 'unknown action' };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
