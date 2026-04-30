;(function () {
  var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches
  var bg = isDark ? '#1c1510' : '#f5ede0'

  var el = document.createElement('div')
  el.id = '__splash'
  el.style.cssText =
    'position:fixed;inset:0;background:' + bg +
    ';display:flex;align-items:center;justify-content:center;z-index:9999;transition:opacity .35s ease'

  var img = document.createElement('img')
  img.src = '/icon-192.png'
  img.alt = ''
  img.style.cssText = 'width:88px;height:88px;border-radius:20px'
  el.appendChild(img)

  function mount() { document.body.appendChild(el) }
  if (document.body) { mount() } else { document.addEventListener('DOMContentLoaded', mount) }

  function dismiss() {
    el.style.opacity = '0'
    setTimeout(function () { if (el.parentNode) el.remove() }, 400)
  }

  // Dismiss 200 ms after the page is fully loaded; hard cap at 4 s
  var cap = setTimeout(dismiss, 4000)
  window.addEventListener('load', function () {
    clearTimeout(cap)
    setTimeout(dismiss, 200)
  })
})()
