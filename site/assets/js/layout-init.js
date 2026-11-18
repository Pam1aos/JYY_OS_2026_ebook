/* Apply saved reader layout before the first paint. */
(function () {
  try {
    var key = "jyy-os-2026:layout";
    var saved = JSON.parse(localStorage.getItem(key) || "{}");
    if (saved.contents === false) {
      document.documentElement.classList.add("hide-contents");
    }
    if (saved.toc === false) {
      document.documentElement.classList.add("hide-toc");
    }
  } catch (error) {
    /* Private mode or disabled storage: use the default open layout. */
  }
})();
