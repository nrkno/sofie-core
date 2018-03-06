document.addEventListener('DOMContentLoaded', function () {
  var body = document.body;

  function findFocusableParent(el) {
    var parent = el;
    while ((parent = parent.parentNode)) {
      if (parent.classList && parent.classList.contains('focusable'))
        return parent;
    }
    return null;
  }

  function focusableHandler(fn) {
    return function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('focusable-main')) {
        var focusableParent = findFocusableParent(e.target);
        if (focusableParent) fn(focusableParent);
      }
    }
  }

  function isTextInput(e) {
    return e.target.tagName === 'TEXTAREA' ||
      (e.target.tagName === 'INPUT' &&
      String(e.target.type).toLocaleLowerCase() === 'text' ||
      String(e.target.type).toLocaleLowerCase() === 'search' ||
      String(e.target.type).toLocaleLowerCase() === 'number');
  }

  function isTab(e) {
    return e.keyCode == 9;
  }

  body.addEventListener('mousedown', function () {
    body.classList.remove('keyboard-focus');
  });

  body.addEventListener('keydown', function (e) {
    if (!e.defaultPrevented && !isTextInput(e) || isTab(e))
      body.classList.add('keyboard-focus');
  });

  body.addEventListener('focus', focusableHandler(function (focusable) {
    focusable.classList.add('focusable-focus');
  }), true);
  
  body.addEventListener('blur', focusableHandler(function (focusable) {
    focusable.classList.remove('focusable-focus')
  }), true);
});