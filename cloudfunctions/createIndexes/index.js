const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const results = [];
  const indexConfigs = [
    { col: 'game_sessions', name: 'idx_openid_start', keys: [{ name: '_openid', direction: '1' }, { name: 'startTime', direction: '-1' }] },
    { col: 'game_sessions', name: 'idx_result', keys: [{ name: 'result', direction: '1' }] },
    { col: 'game_messages', name: 'idx_sid_ts', keys: [{ name: 'sessionId', direction: '1' }, { name: 'timestamp', direction: '1' }] },
    { col: 'game_events', name: 'idx_sid', keys: [{ name: 'sessionId', direction: '1' }] },
  ];

  for (const cfg of indexConfigs) {
    try {
      const res = await cloud.callWxOpenApi({
        apiName: '/tcb/createindex',
        requestData: Buffer.from(JSON.stringify({
          env: 'YOUR_CLOUD_ENV_ID',
          collection_name: cfg.col,
          create_indexes: [{
            name: cfg.name,
            unique: false,
            keys: cfg.keys
          }]
        }))
      });
      const parsed = JSON.parse(res.toString());
      results.push({ collection: cfg.col, index: cfg.name, status: 'ok', detail: parsed });
    } catch (e) {
      results.push({ collection: cfg.col, index: cfg.name, status: 'error', msg: e.message });
    }
  }
  return { results };
};
