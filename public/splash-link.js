;(function () {
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return

  // Actual screen pixels = CSS pixels × devicePixelRatio
  var w = Math.round(window.screen.width * window.devicePixelRatio)
  var h = Math.round(window.screen.height * window.devicePixelRatio)

  // Always use portrait dimensions (width < height)
  if (w > h) { var t = w; w = h; h = t }

  var link = document.createElement('link')
  link.rel = 'apple-touch-startup-image'
  link.href = '/splash/splash-' + w + 'x' + h + '.png'
  document.head.appendChild(link)
})()
