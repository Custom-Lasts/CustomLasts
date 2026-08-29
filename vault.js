/* Custom Lasts — local IndexedDB vault. Never uploads. */
(function (global) {
  "use strict";

  var DB_NAME = "custom-lasts-vault";
  var DB_VERSION = 1;
  var STORE = "scans";
  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result = fn(store);
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function addScan(record) {
    var row = {
      side: record.side,
      createdAt: record.createdAt || Date.now(),
      images: record.images
    };
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        var req = tx.objectStore(STORE).add(row);
        var id = null;
        req.onsuccess = function () { id = req.result; };
        tx.oncomplete = function () { resolve(id); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function listScans() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          rows.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          resolve(rows);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function deleteScan(id) {
    return withStore("readwrite", function (store) {
      store.delete(id);
    });
  }

  function deleteAll() {
    return withStore("readwrite", function (store) {
      store.clear();
    });
  }

  global.CustomLastsVault = {
    DB_NAME: DB_NAME,
    addScan: addScan,
    listScans: listScans,
    deleteScan: deleteScan,
    deleteAll: deleteAll
  };
})(window);

/* Custom Lasts — local vault UI. Never uploads. */
(function () {
  "use strict";

  var list = document.getElementById("vault-list");
  if (!list) return;

  var empty = document.getElementById("vault-empty");
  var deleteAllBtn = document.getElementById("btn-delete-all");
  var liveUrls = [];

  function revokeAll() {
    liveUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    liveUrls = [];
  }

  function thumb(blob, label) {
    if (!blob) return "";
    var url = URL.createObjectURL(blob);
    liveUrls.push(url);
    return '<figure><img src="' + url + '" alt="' + label + '" /><figcaption>' + label + "</figcaption></figure>";
  }

  function formatWhen(ms) {
    try {
      return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return new Date(ms).toLocaleString();
    }
  }

  function render(rows) {
    revokeAll();
    if (!rows.length) {
      empty.hidden = false;
      list.innerHTML = "";
      deleteAllBtn.hidden = true;
      return;
    }
    empty.hidden = true;
    deleteAllBtn.hidden = false;
    list.innerHTML = rows.map(function (row) {
      var images = row.images || {};
      var side = row.side === "left" ? "Left" : "Right";
      return (
        '<li class="vault-card">' +
          '<div class="vault-card-head">' +
            '<div>' +
              '<p class="kicker">' + side + " foot</p>" +
              "<p class=\"vault-when\">" + formatWhen(row.createdAt) + "</p>" +
            "</div>" +
            '<button class="btn ghost" type="button" data-delete="' + row.id + '">Delete</button>' +
          "</div>" +
          '<div class="vault-thumbs">' +
            thumb(images.top, "Top") +
            thumb(images.inner, "Inner") +
            thumb(images.outer, "Outer") +
            thumb(images.heel, "Heel") +
          "</div>" +
        "</li>"
      );
    }).join("");
  }

  function load() {
    CustomLastsVault.listScans().then(render).catch(function () {
      empty.hidden = false;
      empty.innerHTML = "Could not open the local vault in this browser.";
    });
  }

  list.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-delete]");
    if (!btn) return;
    var id = Number(btn.getAttribute("data-delete"));
    if (!window.confirm("Delete this scan from this browser? It was never uploaded.")) return;
    CustomLastsVault.deleteScan(id).then(load);
  });

  deleteAllBtn.addEventListener("click", function () {
    if (!window.confirm("Delete every scan stored in this browser? This cannot be undone.")) return;
    CustomLastsVault.deleteAll().then(load);
  });

  window.addEventListener("pagehide", revokeAll);
  load();
})();

