/**
 * 3D tag sphere for the tags page.
 *
 * Tags are spread evenly over a sphere (Fibonacci distribution), projected to 2D and
 * sorted back-to-front; the side facing the viewer is solid and the far side fades out.
 * Set tag_sphere.depth to 'back' in the theme config to flip that around. Drag to spin
 * it, hover a tag to see how many posts use it, click to open the tag page.
 *
 * Data comes from the JSON block rendered by layout/includes/page/tags.pug, so the
 * markup stays crawlable — the same links are also emitted in a visually hidden list.
 */
(function () {
  'use strict';

  var FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
  var SPIN = 0.0015; // idle rotation, radians per frame
  var DRAG = 0.006; // radians per pixel dragged
  var DAMPING = 0.94; // inertia decay
  var TILT_LIMIT = 1.15; // keep it from flipping over the poles

  function init() {
    var root = document.getElementById('tag-sphere');
    if (!root || root.dataset.sphereReady === '1') return;

    var canvas = root.querySelector('.tag-sphere-canvas');
    var tip = root.querySelector('.tag-sphere-tip');
    var dataNode = root.querySelector('.tag-sphere-data');
    if (!canvas || !dataNode) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var tags;
    try {
      tags = JSON.parse(dataNode.textContent || '[]');
    } catch (err) {
      return;
    }
    if (!tags.length) return;

    root.dataset.sphereReady = '1';

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0;
    var height = 0;
    var radius = 1;

    var rotX = -0.22;
    var rotY = 0.35;
    var velX = 0;
    var velY = 0;

    var dragging = false;
    var dragDistance = 0;
    var lastPoint = { x: 0, y: 0 };
    var pointer = { x: 0, y: 0, inside: false };

    var hits = [];
    var hoveredName = '';
    var hoveredTag = null;

    var maxCount = 1;
    tags.forEach(function (tag) {
      if (tag.count > maxCount) maxCount = tag.count;
    });

    var items = tags.map(function (tag, i) {
      // Fibonacci sphere: even spacing without clustering at the poles
      var phi = Math.acos(1 - (2 * (i + 0.5)) / tags.length);
      var theta = Math.PI * (1 + Math.sqrt(5)) * i;

      return {
        tag: tag,
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi),
        size: 11 + 8 * Math.sqrt(tag.count / maxCount),
        hue: (i * 137.508) % 360,
        textWidth: 0
      };
    });

    // measure once per tag, then scale by perspective
    items.forEach(function (item) {
      ctx.font = '600 ' + item.size + 'px ' + FONT;
      item.textWidth = ctx.measureText(item.tag.name).width;
    });

    function resize() {
      var rect = root.getBoundingClientRect();
      width = rect.width || 1;
      height = rect.height || 1;
      radius = Math.min(width, height) * 0.42;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function isDark() {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function render() {
      var dark = isDark();
      ctx.clearRect(0, 0, width, height);

      var cosX = Math.cos(rotX);
      var sinX = Math.sin(rotX);
      var cosY = Math.cos(rotY);
      var sinY = Math.sin(rotY);
      var cx = width / 2;
      var cy = height / 2;
      var fov = radius * 2.6;
      var light = dark ? 72 : 38;

      // 正面实 / 背面虚，或反过来看。可在页面上改这个属性实时预览。
      var depth = root.dataset.depth === 'back' ? 'back' : 'front';

      // 淡出那一侧的不透明度下限（0 = 完全消失，1 = 前后一样实）
      var minAlpha = parseFloat(root.dataset.minOpacity);
      if (!(minAlpha >= 0 && minAlpha <= 1)) minAlpha = 0.3;

      hits = items.map(function (item) {
        // rotate around Y, then X
        var x1 = item.x * cosY - item.z * sinY;
        var z1 = item.x * sinY + item.z * cosY;
        var y1 = item.y * cosX - z1 * sinX;
        var z2 = item.y * sinX + z1 * cosX;

        var perspective = fov / (fov + z2 * radius);

        // 透视是 fov / (fov + z * radius)，所以 z 越小离观察者越近。
        // near = 1 表示正对观察者，= 0 表示转到球背面。
        var near = (1 - z2) / 2;

        return {
          item: item,
          x: cx + x1 * radius * perspective,
          y: cy + y1 * radius * perspective,
          z: z2,
          perspective: perspective,
          alpha: minAlpha + (1 - minAlpha) * (depth === 'back' ? 1 - near : near)
        };
      });

      hits.sort(function (a, b) {
        return b.z - a.z; // far first
      });

      hits.forEach(function (point) {
        var item = point.item;
        var size = item.size * point.perspective;

        ctx.globalAlpha = point.alpha;
        ctx.font = '600 ' + size.toFixed(1) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'hsl(' + item.hue.toFixed(0) + ', 58%, ' + light + '%)';
        ctx.fillText(item.tag.name, point.x, point.y);

        point.halfWidth = (item.textWidth * point.perspective) / 2;
        point.halfHeight = size * 0.6;
      });

      ctx.globalAlpha = 1;
    }

    /** Nearest tag under the pointer, or -1 */
    function pick() {
      if (!pointer.inside) return -1;

      for (var i = hits.length - 1; i >= 0; i--) {
        var point = hits[i];
        if (
          Math.abs(pointer.x - point.x) <= point.halfWidth + 4 &&
          Math.abs(pointer.y - point.y) <= point.halfHeight + 4
        ) {
          return i;
        }
      }
      return -1;
    }

    function placeTip() {
      var pad = 14;
      var box = tip.getBoundingClientRect();
      var x = pointer.x + pad;
      var y = pointer.y + pad;

      if (x + box.width > width) x = pointer.x - box.width - pad;
      if (y + box.height > height) y = pointer.y - box.height - pad;

      tip.style.transform = 'translate(' + Math.max(0, x) + 'px,' + Math.max(0, y) + 'px)';
    }

    function frame() {
      if (!canvas.isConnected) return; // page was swapped out (pjax)

      if (!dragging) {
        rotY += velY + SPIN;
        rotX += velX;
        velX *= DAMPING;
        velY *= DAMPING;
      }

      rotX = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, rotX));

      render();

      var index = pick();
      var tag = index >= 0 ? hits[index].item.tag : null;
      var name = tag ? tag.name : '';

      hoveredTag = tag;

      if (name !== hoveredName) {
        hoveredName = name;

        if (tag) {
          var label = document.createElement('b');
          label.textContent = tag.name;

          tip.textContent = '';
          tip.append(label, document.createTextNode(' — ' + tag.count + (tag.count === 1 ? ' article' : ' articles')));
          tip.setAttribute('data-show', '');
        } else {
          tip.removeAttribute('data-show');
        }
      }

      if (tag) placeTip();
      canvas.style.cursor = tag ? 'pointer' : dragging ? 'grabbing' : 'grab';

      window.requestAnimationFrame(frame);
    }

    function onPointerDown(event) {
      dragging = true;
      dragDistance = 0;
      velX = 0;
      velY = 0;
      lastPoint.x = event.clientX;
      lastPoint.y = event.clientY;
      root.classList.add('is-dragging');

      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (err) {
          /* synthetic or already-released pointer */
        }
      }
    }

    function onPointerMove(event) {
      var rect = root.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = true;

      if (!dragging) return;

      var dx = event.clientX - lastPoint.x;
      var dy = event.clientY - lastPoint.y;
      lastPoint.x = event.clientX;
      lastPoint.y = event.clientY;
      dragDistance += Math.abs(dx) + Math.abs(dy);

      rotY += dx * DRAG;
      rotX += dy * DRAG;
      velY = dx * DRAG * 0.6;
      velX = dy * DRAG * 0.6;
    }

    function onPointerUp(event) {
      var wasDragging = dragging;
      dragging = false;
      root.classList.remove('is-dragging');

      if (canvas.releasePointerCapture && event.pointerId !== undefined) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch (err) {
          /* already released */
        }
      }

      if (wasDragging && dragDistance < 6 && hoveredTag && hoveredTag.path) {
        window.location.href = hoveredTag.path;
      }
    }

    function onPointerLeave() {
      pointer.inside = false;
      if (!dragging) {
        hoveredTag = null;
        hoveredName = '';
        tip.removeAttribute('data-show');
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    window.addEventListener('resize', resize);
    resize();

    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Butterfly drives the site with pjax, so re-run after each swap
  document.addEventListener('pjax:complete', init);
})();
