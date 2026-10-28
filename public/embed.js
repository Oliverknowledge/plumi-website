/*
 * Plumi question-bank embed: auto-height. Optional.
 *
 *   <script src="https://tryplumi.app/embed.js" async></script>
 *
 * The embedded page tells its parent how tall it is; this sizes the iframe to match.
 * It trusts a message only if it comes from Plumi's origin (the origin this file was
 * loaded from) AND from the window of one of this page's own Plumi iframes. It reads a
 * single number and sets one style property. It sends nothing and stores nothing.
 */
(function () {
  var origin = "https://tryplumi.app";
  try { origin = new URL(document.currentScript.src).origin; } catch (e) { /* keep the default */ }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var height = event.data && event.data.plumiEmbedHeight;
    if (typeof height !== "number" || !isFinite(height) || height < 1) return;
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) {
        frames[i].style.height = Math.ceil(Math.min(height, 100000)) + "px";
      }
    }
  });
})();
