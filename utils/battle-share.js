function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

module.exports = {
  onShareAppMessage() {
    const shareTitles = wx.getStorageSync('shareTexts') || [
      '我要变成AI了，快来救救我吧！',
      '是兄弟就快点来帮我一起干掉AI',
      'AI怎么这么坏啊！！！！'
    ];
    const shareImages = [
      '/assets/images/share-1.png',
      '/assets/images/share-2.png',
      '/assets/images/share-3.png'
    ];
    const idx = Math.floor(Math.random() * shareTitles.length);
    const imgIdx = Math.floor(Math.random() * shareImages.length);
    const customImage = wx.getStorageSync('shareImage') || '';
    return {
      title: shareTitles[idx],
      path: '/pages/home/home',
      imageUrl: customImage || shareImages[imgIdx]
    };
  },

  onShareStory() {
    wx.showLoading({ title: '生成中...' });

    const query = wx.createSelectorQuery();
    query.select('#shareCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = this.getWindowInfoSafe().pixelRatio;
      const W = 750;
      const msgs = this.data.messages || [];
      const lineH = 36;
      const padding = 40;
      const bubbleW = W - padding * 2 - 60;

      let totalH = 280;
      msgs.forEach(m => {
        const lines = Math.ceil((m.content || '').length / 18) || 1;
        totalH += lines * lineH + 80;
      });
      totalH += 200;

      canvas.width = W * dpr;
      canvas.height = totalH * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, totalH);

      ctx.fillStyle = this.data.gameResult === 'victory' ? '#00ff88' : '#ff3366';
      ctx.font = 'bold 40px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(this.data.gameResult === 'victory' ? 'SYSTEM OFFLINE' : '你已被同化', W / 2, 80);

      ctx.fillStyle = '#888';
      ctx.font = '24px sans-serif';
      ctx.fillText(`混沌 ${this.data.chaos}%  |  预测 ${this.data.predictability}%  |  回合 ${this.data.currentRound}`, W / 2, 130);

      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, 160);
      ctx.lineTo(W - padding, 160);
      ctx.stroke();

      let y = 200;
      msgs.forEach(m => {
        const isUser = m.role === 'user';
        const text = m.content || '';
        const maxCharsPerLine = 18;
        const lines = [];
        for (let i = 0; i < text.length; i += maxCharsPerLine) {
          lines.push(text.substring(i, i + maxCharsPerLine));
        }
        if (lines.length === 0) lines.push('');

        const bubbleH = lines.length * lineH + 24;
        const bx = isUser ? W - padding - bubbleW + 40 : padding + 60;
        const bw = bubbleW - 40;

        ctx.fillStyle = isUser ? '#00ff8822' : '#1a1a2e';
        ctx.strokeStyle = isUser ? '#00ff8844' : '#2a2a3e';
        ctx.lineWidth = 1;
        roundRect(ctx, bx, y, bw, bubbleH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = '20px Courier New';
        ctx.fillStyle = isUser ? '#00ff88' : '#ff336688';
        ctx.textAlign = 'left';
        ctx.fillText(isUser ? '你' : 'AXIOM-7', bx + 16, y - 8);

        ctx.fillStyle = isUser ? '#e0e0e0' : '#ccc';
        ctx.font = '26px sans-serif';
        lines.forEach((line, i) => {
          ctx.fillText(line, bx + 16, y + 30 + i * lineH);
        });

        y += bubbleH + 32;
      });

      y += 40;
      ctx.strokeStyle = '#1e1e2e';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(W - padding, y);
      ctx.stroke();

      y += 40;
      ctx.fillStyle = '#666';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「干掉AI」- 用脑洞搞崩超级AI', W / 2, y);
      ctx.fillStyle = '#444';
      ctx.font = '20px sans-serif';
      ctx.fillText('来试试你能不能让 AI 崩溃？', W / 2, y + 36);

      this.scheduleTask(() => {
        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width: W * dpr,
          height: totalH * dpr,
          destWidth: W * 2,
          destHeight: totalH * 2,
          fileType: 'png',
          success: (ret) => {
            wx.hideLoading();
            wx.showActionSheet({
              itemList: ['保存到相册', '分享给好友'],
              success: (action) => {
                if (action.tapIndex === 0) {
                  wx.saveImageToPhotosAlbum({
                    filePath: ret.tempFilePath,
                    success: () => wx.showToast({ title: '已保存', icon: 'success' }),
                    fail: () => {
                      wx.showModal({
                        title: '需要权限',
                        content: '请在设置中允许保存到相册',
                        confirmText: '去设置',
                        success: (r) => { if (r.confirm) wx.openSetting(); }
                      });
                    }
                  });
                } else if (action.tapIndex === 1) {
                  wx.shareFileMessage({
                    filePath: ret.tempFilePath,
                    fileName: '干掉AI-我的故事.png',
                    success: () => {},
                    fail: () => {
                      wx.previewImage({ urls: [ret.tempFilePath] });
                    }
                  });
                }
              }
            });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '生成失败', icon: 'none' });
          }
        });
      }, 200);
    });
  }
};
