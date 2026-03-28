// Shared utility functions for PocketBase hooks.
// Loaded via require() inside each handler since goja isolates handler scope.

module.exports = {
  toId: function toId(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.id) return String(v.id);
    if (Array.isArray(v) && v.length > 0) return toId(v[0]);
    return "";
  },

  authUserId: function authUserId(e) {
    try {
      if (e && e.auth && e.auth.id) return String(e.auth.id);
    } catch (_) {}
    try {
      if (e && e.auth && e.auth.record && e.auth.record.id) return String(e.auth.record.id);
    } catch (_) {}
    try {
      if (e && typeof e.requestInfo === "function") {
        var ri = e.requestInfo();
        if (ri && ri.auth && ri.auth.id) return String(ri.auth.id);
      }
    } catch (_) {}
    try {
      if (e && typeof e.requestInfo === "function") {
        var ri2 = e.requestInfo();
        if (ri2 && ri2.auth && ri2.auth.record && ri2.auth.record.id) return String(ri2.auth.record.id);
      }
    } catch (_) {}
    try {
      if (e && typeof e.requestInfo === "function") {
        var ri3 = e.requestInfo();
        if (ri3 && ri3.context && ri3.context.auth && ri3.context.auth.id) return String(ri3.context.auth.id);
      }
    } catch (_) {}
    try {
      if (e && e.record && e.record.collection && e.record.collection().name === "users" && e.record.id) return String(e.record.id);
    } catch (_) {}
    return "";
  },

  asId: function asId(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.id) return String(v.id);
    if (Array.isArray(v) && v.length > 0) return asId(v[0]);
    return "";
  },

  pairKey: function pairKey(userA, userB) {
    var a = String(userA || "");
    var b = String(userB || "");
    if (!a || !b) return "";
    return a < b ? (a + ":" + b) : (b + ":" + a);
  },

  hasConnection: function hasConnection(fromId, toId) {
    if (!fromId || !toId) return false;
    try {
      var rec = $app.findFirstRecordByFilter(
        "connection_requests",
        "from_user = {:from} && to_user = {:to}",
        { from: fromId, to: toId }
      );
      return !!rec;
    } catch (_) {
      return false;
    }
  },

  canViewExcursion: function canViewExcursion(viewerId, excursion) {
    var hk = module.exports;
    if (!excursion) return false;
    var hostId = hk.toId(excursion.get("host_user"));
    if (!hostId) return false;
    var visibility = String(excursion.get("visibility") || "public");
    if (visibility === "public") return true;
    if (!viewerId) return false;
    if (hostId === viewerId) return true;
    if (visibility === "interested_by_me") return hk.hasConnection(hostId, viewerId);
    if (visibility === "matched_only") return hk.hasConnection(hostId, viewerId) && hk.hasConnection(viewerId, hostId);
    return false;
  },

  excursionHostName: function excursionHostName(hostId) {
    if (!hostId) return "";
    try {
      var user = $app.findRecordById("users", hostId);
      return String(user.get("name") || "");
    } catch (_) {
      return "";
    }
  },

  safeGetFloat: function safeGetFloat(rec, fieldName, fallback) {
    try {
      var v = rec.getFloat(fieldName);
      return isNaN(v) ? fallback : v;
    } catch (_) {
      return fallback;
    }
  },

  excursionSummary: function excursionSummary(rec, viewerId) {
    var hk = module.exports;
    var excursionId = rec.id;
    var hostId = hk.toId(rec.get("host_user"));
    var interests = [];
    var comments = [];
    try {
      interests = $app.findRecordsByFilter(
        "excursion_interests",
        "excursion = {:eid}",
        "",
        500,
        0,
        { eid: excursionId }
      );
    } catch (_) {}
    try {
      comments = $app.findRecordsByFilter(
        "excursion_comments",
        "excursion = {:eid}",
        "",
        500,
        0,
        { eid: excursionId }
      );
    } catch (_) {}

    var viewerInterested = false;
    for (var i = 0; i < interests.length; i++) {
      if (hk.toId(interests[i].get("user")) === viewerId) {
        viewerInterested = true;
        break;
      }
    }

    return {
      id: rec.id,
      title: String(rec.get("title") || ""),
      description: String(rec.get("description") || ""),
      start_at: String(rec.get("start_at") || ""),
      duration_hours: hk.safeGetFloat(rec, "duration_hours", 2),
      meeting_area: String(rec.get("meeting_area") || ""),
      meeting_map_url: String(rec.get("meeting_map_url") || ""),
      meeting_latitude: hk.safeGetFloat(rec, "meeting_latitude", 0),
      meeting_longitude: hk.safeGetFloat(rec, "meeting_longitude", 0),
      visibility: String(rec.get("visibility") || "public"),
      status: String(rec.get("status") || "scheduled"),
      host_user: hostId,
      host_name: hk.excursionHostName(hostId),
      created: rec.get("created"),
      updated: rec.get("updated"),
      interest_count: interests.length,
      comment_count: comments.length,
      viewer_interested: viewerInterested,
    };
  },
};
