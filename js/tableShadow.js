// 表格横向滑动时，在左右两侧显示阴影，提示该方向还有内容
// 依赖 source/css/_global/table.styl 里的 .table-shadow-wrap / .can-scroll-left / .can-scroll-right
(function () {
  const LEFT = 'can-scroll-left'
  const RIGHT = 'can-scroll-right'
  const wraps = []

  const update = wrap => {
    const table = wrap.querySelector('table')
    if (!table) return
    const max = table.scrollWidth - table.clientWidth
    wrap.classList.toggle(LEFT, table.scrollLeft > 1)
    wrap.classList.toggle(RIGHT, max > 1 && table.scrollLeft < max - 1)
  }

  // 主题只在首次加载时给表格补 .table-wrap，pjax 跳转后需要自己补
  const getWrap = table => {
    const parent = table.parentElement
    if (parent && parent.classList.contains('table-wrap')) return parent

    const wrap = document.createElement('div')
    wrap.className = 'table-wrap'
    parent.insertBefore(wrap, table)
    wrap.appendChild(table)
    return wrap
  }

  const init = () => {
    document.querySelectorAll('#article-container table').forEach(table => {
      if (table.closest('.highlight')) return

      const wrap = getWrap(table)
      wrap.classList.add('table-shadow-wrap')

      if (!wrap.dataset.tableShadow) {
        wrap.dataset.tableShadow = '1'
        table.addEventListener('scroll', () => update(wrap), { passive: true })
        wraps.push(wrap)
      }

      update(wrap)
    })
  }

  init()
  document.addEventListener('pjax:complete', init)
  window.addEventListener('resize', () => wraps.forEach(update))
})()
