/* Same-origin parts of the cockpit script. Joined and run as one classic script. */
(function () {
  var parts = ["./app-p0.js", "./app-p1.js", "./app-p2.js", "./app-p3.js"];
  Promise.all(parts.map(function (url) {
    return fetch(url, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("status");
      return res.text();
    });
  })).then(function (chunks) {
    var script = document.createElement("script");
    script.text = chunks.join("");
    document.body.appendChild(script);
  }).catch(function () {});
})();
