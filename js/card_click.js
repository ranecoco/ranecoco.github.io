updateAnchor: (anchor) => {
  if (anchor !== window.location.hash) {
    if (!anchor) anchor = location.pathname
    const title = GLOBAL_CONFIG_SITE.title
    window.history.replaceState({
      url: location.href,
      title: title
    }, title, anchor)
  }
}
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.post-item').forEach(function (card) {
    card.addEventListener('click', function (e) {
      // 如果点击的是卡片内部的 a、按钮、图片链接等，不处理，交给它自己跳转
      if (e.target.closest('a') || e.target.closest('button')) return;

      var titleLink = card.querySelector('.article-title');
      if (titleLink) {
        if (titleLink.target === '_blank') {
          window.open(titleLink.href, '_blank');
        } else {
          window.location.href = titleLink.href;
        }
      }
    });
    card.style.cursor = 'pointer';
  });
});
