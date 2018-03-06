/*global Prism */

function l(coll) {
  return [].slice.call(coll);
}

function qsa(selector, parent) {
  return l((parent || document).querySelectorAll(selector));
}

function hasClass(el, className) {
  return new RegExp("(^|\\s)" + className + "(\\s|$)").test(el.className);
}

function removeClass(el, className) {
  el.className = el.className.replace(new RegExp("(^|\\s)" + className + "(\\s|$)"), " ");
}

function toggleClass(el, className) {
  if (hasClass(el, className)) {
    removeClass(el, className);
  } else {
    el.className += " " + className;
  }
  el.className = el.className.replace(/ +/g, ' ');
}

function duplicateExampleOutput(example) {
  var output = example.querySelector('.light');
  if (!output) {
    console.log(example, 'has no light col, cannot create dark version');
    return;
  }
  var dark = document.createElement('div');
  dark.className = output.className + ' dark';
  dark.innerHTML = output.innerHTML;
  output.parentNode.insertBefore(dark, output.nextSibling);
}

function tallest(elements) {
  return elements.reduce(function (num, element) {
    return Math.max(num, element.clientHeight);
  }, 0);
}

function stretchColumns(example) {
  var columns = l(example.children);
  columns.forEach(function (column) {
    column.style.minHeight = '0px';
  });
  var height = tallest(columns);
  columns.forEach(function (column) {
    column.style.minHeight = (height + 5) + 'px';
  });
}

function identity(x) {
  return x;
}

function extractToc(el) {
  return qsa('.example', el).map(function (example) {
    if (!example.id) { return; }
    return {id: example.id, text: example.querySelector('h2').innerHTML};
  }).filter(identity);
}

function buildToc(root, toc) {
  if (!root) { return; }
  root.innerHTML = toc.map(function (item) {
    return '<li><a href="#' + item.id + '">' + item.text + '</a></li>';
  }).join('\n');
}

function debounce(fn, delay) {
  var timer;
  return function () {
    clearTimeout(timer);
    var args = [].slice.call(arguments);
    var self = this;
    timer = setTimeout(function () {
      fn.apply(self, args);
    }, delay || 10);
  };
}

function getIcons(icons, prefix) {
  return qsa('symbol', icons).map(function (icon) {
    if (!icon.id || (prefix && icon.id.indexOf(prefix) !== 0)) { return; }
    return icon;
  }).filter(identity);
}

function createIcon(id) {
  return '<svg class="icon" aria-hidden="true" role="presentation"><use xlink:href="#' + id + '"/></svg>';
}

function previewIcons(icons, placeholder) {
  placeholder.innerHTML += getIcons(icons, 'icon-').map(function (icon) {
    return '<div class="grid-unit gu-l">' +
      '<p>' + createIcon(icon.id) + ' ' + icon.id + '</p></div>';
  }).join('');
}

function previewLogos(icons, placeholder) {
  placeholder.innerHTML += getIcons(icons, 'logo-').map(function (icon) {
    return '<div class="grid-unit gu-l">' +
      '<p><svg class="logo" aria-hidden="true" role="presentation" viewBox="' + icon.getAttribute("viewBox") + '"><use xlink:href="#' +
      icon.id + '"/></svg></div>';
  }).join('');
}

function previewLogoIncludes(icons, placeholder) {
  placeholder.innerHTML = getIcons(icons, 'logo-').map(function (icon) {
    return '<pre class="lang-markup"><code>&lt;svg class="logo" aria-hidden="true" role="presentation" viewBox="' +
      icon.getAttribute("viewBox") + '">\n  &lt;use xlink:href="#' +
      icon.id + '"/>\n&lt;/svg></code></pre>';
  }).join('');

  qsa('pre').forEach(function (e) { Prism.highlightElement(e); });
}

function getLines(str) {
  var lines = str.split('\n');
  while (lines[0] === '') {
    lines = lines.slice(1);
  }
  while (/^\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }
  return lines;
}

function unindent(str) {
  var lines = getLines(str);
  var indent = lines[0].match(/^\s*/)[0].length;
  var re = new RegExp('^\\s{' + indent + '}');
  return lines.map(function (line) {
    return line.replace(re, '');
  }).join('\n');
}

function cleanSvg(code) {
  // The browser expands self-closing use tags, and adds explicit
  // namespace declarations that are not strictly necessary
  return code.
    replace(/><\/use>/g, '/>').
    replace(/ xmlns:xlink="http:\/\/www.w3.org\/1999\/xlink"/g, '');
}

function escape(code) {
  return code.replace(/</g, '&lt;');
}

function loadSnippet(el) {
  var target = document.getElementById(el.getAttribute('data-example-id'));
  if (!target) {
    console.log('No matching snippet for', (el.getAttribute('data-example-id') || el));
    return;
  }
  var pre = document.createElement('pre');
  pre.className = 'lang-markup';
  var code = escape(unindent(cleanSvg(target.innerHTML)));
  pre.innerHTML = '<code>' + code + '</code>';
  el.parentNode.insertBefore(pre, el);
  el.parentNode.removeChild(el);
}

function sortAlphabetically(coll) {
  return coll.sort(function (a, b) {
    if (a[0] < b[0]) { return -1; }
    if (a[0] > b[0]) { return 1; }
    return 0;
  });
}

function renderGlossary(parent, toc, glossary) {
  var tocLookup = toc.reduce(function (tlu, entry) {
    tlu[entry.id] = entry.text;
    return tlu;
  }, {});

  sortAlphabetically(glossary).forEach(function (entry) {
    var el = document.createElement('p');
    el.className = 'row';
    var className = document.createElement('code');
    className.className = 'col c2 rm-c1';
    className.innerHTML = entry[0];
    el.appendChild(className);
    var desc = document.createElement('span');
    desc.className = 'col c10 rm-c11';
    desc.innerHTML = entry[1];
    el.appendChild(desc);

    if (entry[2]) {
      var targetLink = document.createElement('a');
      targetLink.href = '#' + entry[2];
      targetLink.innerHTML = ' ' + tocLookup[entry[2]];
      desc.innerHTML += ' ';
      desc.appendChild(targetLink);
    }

    parent.appendChild(el);
  });
}

function togglePane(e) {
  e.preventDefault();
  var pane = document.getElementById('pane');

  if (pane) {
    pane.parentNode.removeChild(pane);
  } else {
    pane = document.createElement('div');
    pane.className = 'glass-pane';
    pane.id = 'pane';
    pane.innerHTML = "<div class=\"glass-pane-content\"><div class=\"border-box overlay-m\">" +
      "<button class=\"action-btn border-box-action\"><svg class=\"icon\"><use xlink:href=\"#icon-x\"/></svg>" +
      "</button><p class=\"mas\">Some text in here</p></div></div>";
    pane.querySelector('button').addEventListener('click', togglePane);
    document.body.appendChild(pane);
  }
}

function trackPrediction(el) {
  el.querySelector('.pi-input').addEventListener('input', function () {
    var content = el.querySelector('.pi-current-input');
    content.innerHTML = this.value;
    content.style.width = null; // Allow the browser to reassign automatic width
    content.style.width = content.clientWidth - 2 + 'px';
  });
}

function run() {
  var toc = extractToc();
  buildToc(document.getElementById('toc'), toc);
  qsa('.insert-snippet').forEach(loadSnippet);

  qsa('#glossary-content').forEach(function (glossaryEl) {
    renderGlossary(glossaryEl, toc, window.glossary || []);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var icons = document.getElementById("icon-container");
    previewIcons(icons, document.getElementById("icon-placeholder"));
    previewLogos(icons, document.getElementById("logo-placeholder"));
    previewLogoIncludes(icons, document.getElementById("logo-includes-placeholder"));
    var examples = qsa('.example');
    examples.forEach(duplicateExampleOutput);
    examples.forEach(stretchColumns);

    (onReady.callbacks || []).forEach(function (cb) {
      cb();
    });

    qsa('.pane-ex').forEach(function (el) {
      el.addEventListener('click', togglePane);
    });

    qsa('.predictive-input').forEach(function (el) {
      trackPrediction(el);
    });
  });

  window.onresize = debounce(function () {
    qsa('.example').forEach(stretchColumns);
  }, 100);
}

function onReady(cb) {
  onReady.callbacks = onReady.callbacks || [];
  onReady.callbacks.push(cb);
}

// http://stackoverflow.com/questions/9428773/converting-photoshop-drop-shadow-into-css3-box-shadow
function photoshopDropShadow2CSSBoxShadow(color, opacity, angle, distance, spread, size) {
  // convert the angle to radians
  angle = (180 - angle) * Math.PI / 180;

  // the color is just an rgba() color with the opacity.
  // for simplicity this function expects color to be an rgb string
  // in CSS, opacity is a decimal between 0 and 1 instead of a percentage
  color = "rgba(" + color + "," + opacity/100 + ")";

  // other calculations
  var offsetX = Math.round(Math.cos(angle) * distance) + "px",
      offsetY = Math.round(Math.sin(angle) * distance) + "px",
      spreadRadius = (size * spread / 100) + "px",
      blurRadius = (size - parseInt(spreadRadius, 10)) + "px";
  return offsetX + " " + offsetY + " " + blurRadius + " " + spreadRadius + " " + color;
}
