
/* Safety net for Android WebView / Capacitor: block selection starts outside editable fields */
document.addEventListener('selectstart',function(e){try{var t=e.target,el=t&&(t.nodeType===1?t:t.parentElement);if(el&&el.closest&&el.closest('input,textarea,[contenteditable]:not([contenteditable="false"])'))return;e.preventDefault()}catch(_){}},true);
