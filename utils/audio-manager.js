/**
 * 音效管理器
 * 所有音效文件放在 /assets/audio/ 目录下
 * 由于小程序包大小限制，建议音效文件均 ≤200KB
 */

const audioInstances = {};

const AUDIO_MAP = {
  send: '/assets/audio/send.mp3',
  typing: '/assets/audio/typing.mp3',
  chaosRise: '/assets/audio/chaos-rise.mp3',
  warning: '/assets/audio/warning.mp3',
  skill: '/assets/audio/skill-fire.mp3',
  victory: '/assets/audio/victory.mp3',
  defeat: '/assets/audio/defeat.mp3',
  processing: '/assets/audio/processing.mp3'
};

function play(name) {
  const app = getApp();
  if (!app.globalData.settings.soundEnabled) return;

  const src = AUDIO_MAP[name];
  if (!src) return;

  try {
    const fs = wx.getFileSystemManager();
    fs.accessSync(src);
  } catch (e) {
    return;
  }

  try {
    if (audioInstances[name]) {
      audioInstances[name].stop();
      audioInstances[name].destroy();
    }

    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.volume = name === 'processing' ? 0.3 : 0.7;
    audio.play();
    audioInstances[name] = audio;

    audio.onEnded(() => {
      audio.destroy();
      delete audioInstances[name];
    });

    audio.onError(() => {
      audio.destroy();
      delete audioInstances[name];
    });
  } catch (e) {
    // 静默失败，音效不影响游戏主流程
  }
}

function stopAll() {
  Object.keys(audioInstances).forEach(key => {
    try {
      audioInstances[key].stop();
      audioInstances[key].destroy();
    } catch (e) {}
    delete audioInstances[key];
  });
}

module.exports = { play, stopAll };
