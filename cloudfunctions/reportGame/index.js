const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const OVERVIEW_DOC_ID = 'main';

async function ensureOverviewDoc() {
  try {
    await db.collection('admin_overview_stats').doc(OVERVIEW_DOC_ID).get();
  } catch (e) {
    try {
      await db.collection('admin_overview_stats').doc(OVERVIEW_DOC_ID).set({
        data: {
          totalUsers: 0,
          totalSessions: 0,
          totalMessages: 0,
          totalVictories: 0,
          updatedAt: db.serverDate()
        }
      });
    } catch (e2) {}
  }
}

async function incOverviewStats(data) {
  await ensureOverviewDoc();
  const updateData = { updatedAt: db.serverDate() };
  Object.keys(data || {}).forEach((k) => {
    if (typeof data[k] === 'number' && data[k] !== 0) {
      updateData[k] = _.inc(data[k]);
    }
  });
  try {
    await db.collection('admin_overview_stats').doc(OVERVIEW_DOC_ID).update({ data: updateData });
  } catch (e) {}
}

async function updateUserStatsOnStart(openid, nickname, avatar) {
  let isNewUser = false;
  try {
    await db.collection('admin_user_stats').doc(openid).get();
  } catch (e) {
    isNewUser = true;
    try {
      await db.collection('admin_user_stats').doc(openid).set({
        data: {
          openid,
          nickname: nickname || '匿名用户',
          avatar: avatar || '',
          totalGames: 0,
          totalMessages: 0,
          victories: 0,
          lastPlayTime: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    } catch (e2) {}
  }
  try {
    await db.collection('admin_user_stats').doc(openid).update({
      data: {
        nickname: nickname || '匿名用户',
        avatar: avatar || '',
        totalGames: _.inc(1),
        lastPlayTime: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  } catch (e) {}
  await incOverviewStats({
    totalUsers: isNewUser ? 1 : 0,
    totalSessions: 1
  });
}

async function incUserMessages(openid) {
  try {
    await db.collection('admin_user_stats').doc(openid).update({
      data: {
        totalMessages: _.inc(1),
        updatedAt: db.serverDate()
      }
    });
  } catch (e) {}
  await incOverviewStats({ totalMessages: 1 });
}

async function incUserVictories(openid) {
  try {
    await db.collection('admin_user_stats').doc(openid).update({
      data: {
        victories: _.inc(1),
        updatedAt: db.serverDate()
      }
    });
  } catch (e) {}
  await incOverviewStats({ totalVictories: 1 });
}

async function markEventIfNew(eventId, openid, sessionId, action) {
  if (!eventId) return { ok: true, skip: true };
  try {
    const existing = await db.collection('game_events').doc(eventId).get();
    if (existing && existing.data) {
      return { ok: false, duplicate: true };
    }
  } catch (e) {
    if (e.errCode === -502005) {
      console.warn('[reportGame] game_events collection missing, skip dedupe');
      return { ok: true, degraded: true };
    }
    // doc not found → event is new, fall through to set
  }
  try {
    await db.collection('game_events').doc(eventId).set({
      data: {
        _openid: openid,
        sessionId: sessionId || '',
        action,
        createdAt: db.serverDate()
      }
    });
    return { ok: true };
  } catch (e) {
    if (e.errCode === -502005) {
      console.warn('[reportGame] game_events collection missing on set, skip dedupe');
      return { ok: true, degraded: true };
    }
    try {
      const dup = await db.collection('game_events').doc(eventId).get();
      if (dup && dup.data) return { ok: false, duplicate: true };
    } catch (e2) {}
    return { ok: false, error: 'event mark failed' };
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data } = event;

  try {
    if (action === 'start') {
      const result = await db.collection('game_sessions').add({
        data: {
          _openid: openid,
          nickname: data.nickname || '匿名用户',
          avatar: data.avatar || '',
          level: data.level || 1,
          levelName: data.levelName || '',
          startTime: db.serverDate(),
          endTime: null,
          duration: 0,
          result: 'playing',
          messageCount: 0,
          chaos: 0,
          predictability: data.predictability || 30
        }
      });
      await updateUserStatsOnStart(openid, data.nickname || '匿名用户', data.avatar || '');
      return { success: true, sessionId: result._id };
    }

    if (action === 'message') {
      if (!data.sessionId) return { success: false, error: 'missing sessionId' };
      const eventCheck = await markEventIfNew(data.eventId, openid, data.sessionId, 'message');
      if (eventCheck.error) return { success: false, error: eventCheck.error };
      if (eventCheck.duplicate) return { success: true, duplicate: true };
      let doc;
      try { doc = await db.collection('game_sessions').doc(data.sessionId).get(); }
      catch (e) { return { success: false, error: 'session not found' }; }
      if (doc.data._openid !== openid) return { success: false, error: 'permission denied' };
      const msgData = {
        role: data.role,
        content: data.content,
        chaos: data.chaos || 0,
        predictability: data.predictability || 0,
        timestamp: db.serverDate()
      };
      try {
        await db.collection('game_messages').add({
          data: { sessionId: data.sessionId, _openid: openid, ...msgData }
        });
      } catch (e) {
        return { success: false, error: 'message write failed' };
      }
      const updateData = {
        messageCount: _.inc(1),
        chaos: data.chaos || 0,
        predictability: data.predictability || 0
      };
      await db.collection('game_sessions').doc(data.sessionId).update({ data: updateData });
      await incUserMessages(openid);
      return { success: true };
    }

    if (action === 'end') {
      if (!data.sessionId) return { success: false, error: 'missing sessionId' };
      const eventCheck = await markEventIfNew(data.eventId, openid, data.sessionId, 'end');
      if (eventCheck.error) return { success: false, error: eventCheck.error };
      if (eventCheck.duplicate) return { success: true, duplicate: true };
      let doc;
      try { doc = await db.collection('game_sessions').doc(data.sessionId).get(); }
      catch (e) { return { success: false, error: 'session not found' }; }
      if (doc.data._openid !== openid) return { success: false, error: 'permission denied' };
      await db.collection('game_sessions').doc(data.sessionId).update({
        data: {
          result: data.result,
          endTime: db.serverDate(),
          duration: data.duration || 0,
          chaos: data.chaos || 0,
          predictability: data.predictability || 0
        }
      });
      if (data.result === 'victory') {
        await incUserVictories(openid);
      }
      return { success: true };
    }

    if (action === 'levelUp') {
      if (!data.sessionId) return { success: false, error: 'missing sessionId' };
      let doc;
      try { doc = await db.collection('game_sessions').doc(data.sessionId).get(); }
      catch (e) { return { success: false, error: 'session not found' }; }
      if (doc.data._openid !== openid) return { success: false, error: 'permission denied' };
      await db.collection('game_sessions').doc(data.sessionId).update({
        data: {
          level: 2,
          levelName: data.levelName || '第二关 · 地狱'
        }
      });
      return { success: true };
    }

    return { success: false, error: 'unknown action' };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
