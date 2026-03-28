// Hundkrets - Email hooks for connection requests and onboarding
// Requires SMTP configured in PocketBase Admin > Settings > Mail settings

$app.logger().info("Hundkrets pb_hooks loaded v2");

// Shared utility functions are in hk_utils.js (loaded via require() inside handlers
// because PocketBase goja JSVM isolates each handler's scope).

// Allow authenticated users to connect to realtime
onRealtimeConnectRequest((e) => {
  e.next();
});

// Weekly retention email cron job - runs every Monday at 9am
cronAdd("weekly_retention_emails", "0 9 * * 1", function () {
  $app.logger().info("Cron: Starting weekly retention email job");
  var oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  var inactiveUsers = [];
  try {
    inactiveUsers = $app.findRecordsByFilter("users",
      "last_login_at < {:oneWeek} && retention_email_enabled = true",
      "-created", 100, 0,
      { oneWeek: oneWeekAgo.toISOString() }
    );
  } catch (err) {
    $app.logger().warn("Cron retention job: query failed", "error", err);
    return;
  }

  var sentCount = 0;
  for (var i = 0; i < inactiveUsers.length; i++) {
    var user = inactiveUsers[i];
    var userId = user.id;

    var hasConnectionRequests = false;
    try {
      var crs = $app.findRecordsByFilter("connection_requests", "from_user = {:uid}", "", 1, 0, { uid: userId });
      hasConnectionRequests = crs && crs.length > 0;
    } catch (err) { }

    if (hasConnectionRequests) continue;

    var lastLogin = user.get("last_login_at");
    if (!lastLogin) continue;

    var lastSent = user.get("last_retention_email_sent");
    if (lastSent) {
      var lastSentDate = new Date(String(lastSent));
      var daysSinceSent = (Date.now() - lastSentDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceSent < 7) continue;
    }

    var userEmail = user.get("email");
    if (!userEmail) continue;

    try {
      var previousRetention = $app.findRecordsByFilter(
        "email_log",
        "type = 'retention' && to ~ {:email}",
        "-sent_at",
        3,
        0,
        { email: String(userEmail) }
      );
      if (previousRetention && previousRetention.length >= 3) continue;
    } catch (err) {
      $app.logger().warn("Cron retention: could not check send limit", "error", err, "email", userEmail);
    }

    var radius = user.getFloat("retention_radius");
    if (isNaN(radius) || radius < 1) radius = 3;
    var userCoords = null;
    try {
      var myLat = user.getFloat("latitude");
      var myLon = user.getFloat("longitude");
      if (!isNaN(myLat) && !isNaN(myLon) && myLat !== 0 && myLon !== 0) {
        userCoords = { lat: myLat, lon: myLon };
      }
    } catch (err) { }
    if (!userCoords) continue;

    var allUsers = [];
    try {
      allUsers = $app.findRecordsByFilter(
        "users",
        "created >= {:since} && onboarding_complete = true && id != {:uid} && area != ''",
        "-created",
        200,
        0,
        { since: String(lastLogin), uid: userId }
      );
    } catch (err) {
      $app.logger().warn("Cron retention: nearby query failed", "error", err);
      continue;
    }

    var R = 6371;
    var toRad = function (deg) { return deg * Math.PI / 180; };
    var nearbyUsers = [];
    for (var j = 0; j < allUsers.length; j++) {
      var other = allUsers[j];
      var otherLat, otherLon;
      try {
        otherLat = other.getFloat("latitude");
        otherLon = other.getFloat("longitude");
      } catch (err) { continue; }
      if (isNaN(otherLat) || isNaN(otherLon) || otherLat === 0 || otherLon === 0) continue;

      var dLat = toRad(otherLat - userCoords.lat);
      var dLon = toRad(otherLon - userCoords.lon);
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(userCoords.lat)) * Math.cos(toRad(otherLat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      var dist = R * c;
      if (dist <= radius) nearbyUsers.push(other);
    }

    if (nearbyUsers.length === 0) continue;

    var meta = $app.settings() && $app.settings().meta;
    var from = null;
    if (meta && meta.senderAddress && String(meta.senderAddress).trim()) {
      from = {
        address: String(meta.senderAddress).trim(),
        name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets"
      };
    }
    if (!from) {
      $app.logger().warn("Cron retention: sender not configured");
      continue;
    }

    var userName = String(user.get("name") || "där");
    var urlMeta = $app.settings() && $app.settings().meta;
    var baseUrl = (urlMeta && urlMeta.appUrl) ? String(urlMeta.appUrl).replace(/\/$/, "") : "https://hundkrets.se";
    var utmEmail = "utm_source=email&utm_medium=retention&utm_campaign=weekly_update";
    var matchesLink = baseUrl + "/app/explore?" + utmEmail;
    var settingsLink = baseUrl + "/app/settings?" + utmEmail;
    var unsubLink = baseUrl + "/api/unsubscribe/" + userId + "/retention";

    var names = [];
    for (var k = 0; k < Math.min(3, nearbyUsers.length); k++) {
      var n = nearbyUsers[k].get("name");
      if (n) names.push(String(n));
    }
    var namesStr = names.join(", ");
    var hasMore = nearbyUsers.length > 3;
    var html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Nya hundägare i ditt område</title></head>" +
      "<body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">" +
      "<div style=\"background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;\">" +
      "<h2 style=\"color: #2c3e50; margin-top: 0;\">Hej " + userName + "!</h2>" +
      "<p style=\"font-size: 18px; margin-bottom: 0;\"><strong>" + nearbyUsers.length + " nya hundägare har registrerats i ditt område.</strong></p></div>" +
      "<div style=\"background: #ffffff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;\">" +
      "<p style=\"margin-bottom: 20px;\">Det har gått en vecka sedan du loggade in på Hundkrets. I din närhet har " + nearbyUsers.length + " nya användare registrerat sig.";
    if (namesStr) {
      html += "</p><p style=\"margin-bottom: 20px;\">Några av dem är: <strong>" + namesStr + "</strong>" + (hasMore ? " och fler..." : "") + "</p>";
    } else {
      html += "</p>";
    }
    html += "<div style=\"text-align: center; margin: 30px 0;\">" +
      "<a href=\"" + matchesLink + "\" style=\"background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;\">Logga in och se alla</a></div></div>" +
      "<div style=\"background: #f8f9fa; border-radius: 8px; padding: 15px; font-size: 14px; color: #7f8c8d;\">" +
      "<p style=\"margin: 0;\">Du får detta meddelande eftersom du inte har loggat in på över en vecka.</p>" +
      "<p style=\"margin: 10px 0 0 0;\"><a href=\"" + settingsLink + "\" style=\"color: #7f8c8d; text-decoration: underline;\">Hantera e-postinställningar</a> • " +
      "<a href=\"" + unsubLink + "\" style=\"color: #7f8c8d; text-decoration: underline;\">Avsluta prenumeration</a></p></div></body></html>";

    try {
      $app.newMailClient().send(new MailerMessage({ from: from, to: [{ address: userEmail }], subject: nearbyUsers.length + " nya hundägare i ditt område", html: html }));
      user.set("last_retention_email_sent", new Date().toISOString());
      $app.save(user);
      sentCount++;
    } catch (err) {
      $app.logger().warn("Cron retention: email failed", "error", err);
    }
  }

  var result = { emailsSent: sentCount, usersChecked: inactiveUsers.length };
  $app.logger().info("Cron: Weekly retention email job completed", "emailsSent", result.emailsSent, "usersChecked", result.usersChecked);
});


// Set last_login_at = created when a new user is created (registration)
onRecordCreateRequest((e) => {
  try {
    if (e.record) {
      e.record.set("last_login_at", new Date());
      e.record.set("retention_email_enabled", true);
      if (!e.record.get("retention_radius")) {
        e.record.set("retention_radius", 3);
      }
    }
  } catch (err) {
    $app.logger().warn("last_login_at init failed", "error", err && (err.message || String(err)));
  }
  e.next();
}, "users");

// Update last_login_at when user authenticates (login, OAuth, refresh)
onRecordAuthRequest((e) => {
  try {
    if (e.record && e.record.id) {
      e.record.set("last_login_at", new Date());
      $app.save(e.record);
    }
  } catch (err) {
    $app.logger().warn("last_login_at update failed", "error", err && (err.message || String(err)));
  }
  e.next();
});

// Log all sent emails to email_log collection
onMailerSend((e) => {
  try {
    var msg = e.message;
    var toArr = msg.to || [];
    var toStr = toArr.map(function (r) { return r.address || r; }).filter(Boolean).join(", ");
    if (!toStr) toStr = "(no recipient)";
    var collection = $app.findCollectionByNameOrId("email_log");
    var rec = new Record(collection);
    rec.set("to", toStr);
    rec.set("subject", msg.subject || "");
    rec.set("sent_at", new Date());
    var subj = String(msg.subject || "");
    var type = "";
    if (subj.indexOf("Välkommen till Hundkrets") >= 0) type = "welcome";
    else if (subj.indexOf("Ni har matchat") >= 0) type = "connection_match";
    else if (subj.indexOf("är intresserad av dig") >= 0) type = "connection_request";
    else if (subj.indexOf("Daglig chattsammanfattning") >= 0) type = "chat_daily";
    else if (subj.indexOf("skickade ett meddelande") >= 0) type = "chat_instant";
    else if (subj.indexOf("password") >= 0 || subj.indexOf("lösenord") >= 0) type = "auth_password_reset";
    else if (subj.indexOf("verifiera") >= 0 || subj.indexOf("verify") >= 0) type = "auth_verification";
    else if (subj.indexOf("inloggning") >= 0 || subj.indexOf("login") >= 0) type = "auth_alert";
    else if (subj.indexOf("nya hund") >= 0 || subj.indexOf("nya användare") >= 0) type = "retention";
    if (type) rec.set("type", type);
    $app.save(rec);
  } catch (err) {
    $app.logger().warn("Email log failed", "error", err && (err.message || String(err)));
  }
  e.next();
});

// Delete user: manually remove all related records before user delete
// Fixes "Failed to delete record. Make sure that the record is not part of a required relation reference"
// Order matters: watch_needs (refs user+dog) -> connection_requests -> watch_capacity -> dogs
onRecordDelete((e) => {
  if (!e || !e.record || !e.record.id) {
    e.next();
    return;
  }
  var uid = e.record.id;

  var toDelete = [];

  // 1. watch_needs (user + dog) - must delete before dogs
  try {
    toDelete = $app.findRecordsByFilter("watch_needs", "user = {:uid}", "", 0, 0, { uid: uid });
    for (var i = 0; i < toDelete.length; i++) {
      $app.delete(toDelete[i]);
    }
  } catch (err) {
    $app.logger().warn("User delete: watch_needs cleanup", "error", err);
  }

  // 2. connection_requests (from_user or to_user)
  try {
    toDelete = $app.findRecordsByFilter("connection_requests", "from_user = {:uid} || to_user = {:uid}", "", 0, 0, { uid: uid });
    for (var j = 0; j < toDelete.length; j++) {
      $app.delete(toDelete[j]);
    }
  } catch (err) {
    $app.logger().warn("User delete: connection_requests cleanup", "error", err);
  }

  // 3. conversations (user_a or user_b)
  try {
    toDelete = $app.findRecordsByFilter("conversations", "user_a = {:uid} || user_b = {:uid}", "", 0, 0, { uid: uid });
    for (var c = 0; c < toDelete.length; c++) {
      $app.delete(toDelete[c]);
    }
  } catch (err) {
    $app.logger().warn("User delete: conversations cleanup", "error", err);
  }

  // 4. messages (sender)
  try {
    toDelete = $app.findRecordsByFilter("messages", "sender = {:uid}", "", 0, 0, { uid: uid });
    for (var mm = 0; mm < toDelete.length; mm++) {
      $app.delete(toDelete[mm]);
    }
  } catch (err) {
    $app.logger().warn("User delete: messages cleanup", "error", err);
  }

  // 5. watch_capacity
  try {
    toDelete = $app.findRecordsByFilter("watch_capacity", "user = {:uid}", "", 0, 0, { uid: uid });
    for (var k = 0; k < toDelete.length; k++) {
      $app.delete(toDelete[k]);
    }
  } catch (err) {
    $app.logger().warn("User delete: watch_capacity cleanup", "error", err);
  }

  // 6. dogs (owner)
  try {
    toDelete = $app.findRecordsByFilter("dogs", "owner = {:uid}", "", 0, 0, { uid: uid });
    for (var m = 0; m < toDelete.length; m++) {
      $app.delete(toDelete[m]);
    }
  } catch (err) {
    $app.logger().warn("User delete: dogs cleanup", "error", err);
  }

  e.next();
}, "users");

function getMailFrom() {
  var meta = $app.settings() && $app.settings().meta;
  if (meta && meta.senderAddress && String(meta.senderAddress).trim()) {
    return {
      address: String(meta.senderAddress).trim(),
      name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets"
    };
  }
  return null;
}

function htmlEscape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Chat guard: only allow conversations for mutually matched users.
onRecordAfterCreateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  function toId(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.id) return String(v.id);
    if (Array.isArray(v) && v.length > 0) return toId(v[0]);
    return "";
  }
  function pk(a, b) {
    var x = String(a || "");
    var y = String(b || "");
    if (!x || !y) return "";
    return x < y ? (x + ":" + y) : (y + ":" + x);
  }
  var conv = e.record;
  var userA = toId(conv.get("user_a"));
  var userB = toId(conv.get("user_b"));
  if (!userA || !userB || userA === userB) {
    try { $app.delete(conv); } catch (_) { }
    e.next();
    return;
  }

  var key = pk(userA, userB);
  try {
    conv.set("pair_key", key);
    $app.save(conv);
  } catch (_) { }

  // De-duplicate conversations (keep oldest)
  try {
    var duplicates = $app.findRecordsByFilter("conversations", "pair_key = {:k} && id != {:id}", "created", 1, 0, { k: key, id: conv.id });
    if (duplicates && duplicates.length > 0) {
      $app.delete(conv);
      e.next();
      return;
    }
  } catch (_) { }

  var forward = null;
  var reverse = null;
  try {
    forward = $app.findFirstRecordByFilter("connection_requests", "from_user = {:from} && to_user = {:to}", { from: userA, to: userB });
  } catch (_) { }
  try {
    reverse = $app.findFirstRecordByFilter("connection_requests", "from_user = {:from} && to_user = {:to}", { from: userB, to: userA });
  } catch (_) { }

  if (!forward || !reverse) {
    $app.logger().warn("Conversation removed: users are not mutually matched", "conversationId", conv.id);
    try { $app.delete(conv); } catch (_) { }
  }
  e.next();
}, "conversations");

// Chat guard + notification: sender must be participant and recipient gets email by preference.
// System messages (message_type === "system") skip sender validation and email.
onRecordAfterCreateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var msgRec = e.record;
  var toId = function (v) { if (!v) return ""; if (typeof v === "string") return v; if (v && typeof v === "object" && v.id) return String(v.id); if (Array.isArray(v) && v.length > 0) return toId(v[0]); return ""; };
  var esc = function (s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); };
  var convId = toId(msgRec.get("conversation"));
  var senderId = toId(msgRec.get("sender"));
  var msgType = String(msgRec.get("message_type") || "user");
  var isSystem = msgType === "system";

  if (!convId) {
    try { $app.delete(msgRec); } catch (_) { }
    e.next();
    return;
  }

  var conv = null;
  try {
    conv = $app.findRecordById("conversations", convId);
  } catch (_) {
    try { $app.delete(msgRec); } catch (_) { }
    e.next();
    return;
  }

  if (isSystem || !senderId) {
    // System message: only update last_message_at, no email
    try {
      conv.set("last_message_at", new Date().toISOString());
      $app.save(conv);
    } catch (_) { }
    e.next();
    return;
  }

  var userA = toId(conv.get("user_a"));
  var userB = toId(conv.get("user_b"));
  if (senderId !== userA && senderId !== userB) {
    $app.logger().warn("Message removed: sender is not conversation participant", "messageId", msgRec.id, "senderId", senderId);
    try { $app.delete(msgRec); } catch (_) { }
    e.next();
    return;
  }

  var recipientId = senderId === userA ? userB : userA;
  if (!recipientId) {
    e.next();
    return;
  }

  try {
    conv.set("last_message_at", new Date().toISOString());
    $app.save(conv);
  } catch (_) { }

  var recipient = null;
  var sender = null;
  try {
    recipient = $app.findRecordById("users", recipientId);
    sender = $app.findRecordById("users", senderId);
  } catch (_) {
    e.next();
    return;
  }
  var recipientEmail = recipient ? recipient.get("email") : "";
  if (!recipientEmail) {
    e.next();
    return;
  }

  var pref = (recipient.get("chat_email_frequency") || "daily");
  if (pref === "off") {
    e.next();
    return;
  }

  var shouldSend = true;
  var isDaily = pref === "daily";
  if (isDaily) {
    var prev = recipient.get("chat_digest_last_sent_at");
    if (prev) {
      var prevMs = new Date(String(prev)).getTime();
      var nowMs = Date.now();
      if (!isNaN(prevMs) && (nowMs - prevMs) < (24 * 60 * 60 * 1000)) {
        shouldSend = false;
      }
    }
  }
  if (!shouldSend) {
    e.next();
    return;
  }

  var meta = $app.settings() && $app.settings().meta;
  var from = (meta && meta.senderAddress && String(meta.senderAddress).trim()) ? { address: String(meta.senderAddress).trim(), name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets" } : null;
  if (!from) {
    e.next();
    return;
  }

  var senderName = (sender && sender.get("name")) ? sender.get("name") : "Någon";
  var body = String(msgRec.get("body") || "").trim();
  var snippet = body.length > 200 ? (body.slice(0, 200) + "...") : body;
  var safeSnippet = esc(snippet);
  var urlMeta = $app.settings() && $app.settings().meta;
  var baseUrl = (urlMeta && urlMeta.appUrl) ? String(urlMeta.appUrl).replace(/\/$/, "") : "https://hundkrets.se";
  var chatLink = baseUrl + "/app/chats/" + conv.id + "?utm_source=email&utm_medium=message&utm_campaign=new_message";

  var subject = isDaily ? "Daglig chattsammanfattning på Hundkrets" : (senderName + " skickade ett meddelande på Hundkrets");
  var html = isDaily
    ? "<p>Du har nya meddelanden på Hundkrets.</p><p><a href=\"" + chatLink + "\">Öppna chatten</a></p>"
    : "<p><strong>" + esc(senderName) + "</strong> skickade ett nytt meddelande:</p><p style=\"margin: 1rem 0; padding: 0.75rem; background: #f5f5f5; border-radius: 8px;\">" + safeSnippet + "</p><p><a href=\"" + chatLink + "\">Öppna chatten</a></p>";

  try {
    $app.newMailClient().send(new MailerMessage({ from: from, to: [{ address: recipientEmail }], subject: subject, html: html }));
    if (isDaily) {
      recipient.set("chat_digest_last_sent_at", new Date().toISOString());
      $app.save(recipient);
    }
  } catch (err) {
    $app.logger().warn("Chat notification email failed", "error", err);
  }

  e.next();
}, "messages");

// Public route: user locations for landing map (id, latitude, longitude, area only – no auth needed)
routerAdd("GET", "/api/hundkrets/user-locations", (e) => {
  var records = [];
  try {
    records = $app.findRecordsByFilter("users", "latitude != null && longitude != null", "-created", 200, 0);
  } catch (err) {
    return e.json(500, []);
  }
  var items = [];
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var lat = r.getFloat("latitude");
    var lon = r.getFloat("longitude");
    if (!isNaN(lat) && !isNaN(lon)) {
      items.push({
        id: r.id,
        latitude: lat,
        longitude: lon,
        area: r.getString("area") || ""
      });
    }
  }
  return e.json(200, items);
});

// Public route: dog images for landing gallery (id, image – no auth needed)
routerAdd("GET", "/api/hundkrets/dog-gallery", (e) => {
  var records = [];
  try {
    records = $app.findRecordsByFilter("dogs", "image != ''", "-created", 50, 0);
  } catch (err) {
    return e.json(500, []);
  }
  var items = [];
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var img = r.getString("image");
    if (img) {
      items.push({ id: r.id, image: img });
    }
  }
  return e.json(200, items);
});

routerAdd("GET", "/api/hundkrets/excursions/visible", (e) => {
  var hk = require(__hooks + "/hk_utils.js");
  try {
    var viewerId = hk.authUserId(e);
    if (!viewerId) viewerId = "";

    var records = [];
    records = $app.findRecordsByFilter(
      "excursions",
      "",
      "start_at",
      300,
      0
    );

    var now = new Date();
    var items = [];
    for (var i = 0; i < records.length; i++) {
      try {
        var rec = records[i];
        var status = String(rec.get("status") || "scheduled");
        if (status !== "scheduled") continue;
        var startAt = String(rec.get("start_at") || "");
        if (startAt) {
          var startDate = new Date(startAt);
          if (!isNaN(startDate.getTime()) && startDate.getTime() < now.getTime()) continue;
        }
        if (!hk.canViewExcursion(viewerId, rec)) continue;
        items.push(hk.excursionSummary(rec, viewerId));
      } catch (innerErr) {
        $app.logger().warn(
          "Excursions visible: skipping invalid record",
          "recordId",
          records[i] ? records[i].id : "",
          "error",
          innerErr && (innerErr.message || String(innerErr))
        );
      }
    }

    return e.json(200, { items: items });
  } catch (err) {
    // Keep this route fail-safe and quiet; frontend has a collection-based fallback path.
    return e.json(200, { items: [] });
  }
});

routerAdd("GET", "/api/hundkrets/excursions/visible/:id", (e) => {
  var hk = require(__hooks + "/hk_utils.js");
  try {
    var viewerId = hk.authUserId(e);
    if (!viewerId) viewerId = "";
    var excursionId = e.pathParams.id;
    if (!excursionId) return e.json(400, { error: "Missing excursion id" });

    var rec = null;
    rec = $app.findRecordById("excursions", excursionId);
    if (!hk.canViewExcursion(viewerId, rec)) return e.json(403, { error: "Forbidden" });

    var comments = [];
    comments = $app.findRecordsByFilter(
      "excursion_comments",
      "excursion = {:eid}",
      "created",
      500,
      0,
      { eid: excursionId }
    );

    var interests = [];
    interests = $app.findRecordsByFilter(
      "excursion_interests",
      "excursion = {:eid}",
      "created",
      500,
      0,
      { eid: excursionId }
    );

    var commentItems = [];
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      var authorId = hk.toId(c.get("author"));
      commentItems.push({
        id: c.id,
        excursion: hk.toId(c.get("excursion")),
        author: authorId,
        author_name: hk.excursionHostName(authorId),
        body: String(c.get("body") || ""),
        parent_comment: hk.toId(c.get("parent_comment")),
        created: c.get("created"),
        updated: c.get("updated"),
      });
    }

    var interestItems = [];
    for (var j = 0; j < interests.length; j++) {
      var ir = interests[j];
      var userId = hk.toId(ir.get("user"));
      interestItems.push({
        id: ir.id,
        excursion: hk.toId(ir.get("excursion")),
        user: userId,
        user_name: hk.excursionHostName(userId),
        created: ir.get("created"),
        updated: ir.get("updated"),
      });
    }

    return e.json(200, {
      item: hk.excursionSummary(rec, viewerId),
      comments: commentItems,
      interests: interestItems,
    });
  } catch (err) {
    return e.json(404, { error: "Excursion not found" });
  }
});

onRecordCreateRequest((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var me = "";
  try {
    if (e && e.auth && e.auth.id) me = String(e.auth.id);
  } catch (_) {}
  try {
    if (!me && e && e.auth && e.auth.record && e.auth.record.id) me = String(e.auth.record.id);
  } catch (_) {}
  try {
    if (!me && e && e.record && e.record.collection && e.record.collection().name === "users" && e.record.id) {
      me = String(e.record.id);
    }
  } catch (_) {}
  if (!me) throw new BadRequestError("Du måste vara inloggad.");
  e.record.set("host_user", me);
  if (!e.record.get("visibility")) e.record.set("visibility", "public");
  if (!e.record.get("status")) e.record.set("status", "scheduled");
  if (e.record.get("share_phone_with_attendees") == null) {
    e.record.set("share_phone_with_attendees", false);
  }
  var startAt = String(e.record.get("start_at") || "");
  if (!startAt) throw new BadRequestError("Starttid krävs.");
  var durationHours = e.record.getFloat("duration_hours");
  if (isNaN(durationHours) || durationHours <= 0) {
    e.record.set("duration_hours", 2);
  } else if (durationHours > 24) {
    throw new BadRequestError("Längden kan vara max 24 timmar.");
  }
  var lat = e.record.getFloat("meeting_latitude");
  var lon = e.record.getFloat("meeting_longitude");
  if (!isNaN(lat) && (lat < -90 || lat > 90)) {
    throw new BadRequestError("Ogiltig latitud för mötesplats.");
  }
  if (!isNaN(lon) && (lon < -180 || lon > 180)) {
    throw new BadRequestError("Ogiltig longitud för mötesplats.");
  }
  e.next();
}, "excursions");

onRecordAfterCreateSuccess((e) => {
  var hk = require(__hooks + "/hk_utils.js");
  if (!e || !e.record) {
    e.next();
    return;
  }
  var excursionId = e.record.id;
  var hostId = hk.toId(e.record.get("host_user"));
  if (!excursionId || !hostId) {
    e.next();
    return;
  }
  try {
    var existing = null;
    try {
      existing = $app.findFirstRecordByFilter(
        "excursion_interests",
        "excursion = {:eid} && user = {:uid}",
        { eid: excursionId, uid: hostId }
      );
    } catch (_) {}
    if (!existing) {
      var col = $app.findCollectionByNameOrId("excursion_interests");
      var rec = new Record(col);
      rec.set("excursion", excursionId);
      rec.set("user", hostId);
      $app.save(rec);
    }
  } catch (err) {
    $app.logger().warn(
      "Could not auto-add host as excursion participant",
      "excursionId",
      excursionId,
      "hostId",
      hostId,
      "error",
      err && (err.message || String(err))
    );
  }
  e.next();
}, "excursions");

onRecordCreateRequest((e) => {
  var hk = require(__hooks + "/hk_utils.js");
  if (!e || !e.record) {
    e.next();
    return;
  }
  var me = hk.authUserId(e);
  if (!me) throw new BadRequestError("Du måste vara inloggad.");
  var excursionId = hk.toId(e.record.get("excursion"));
  if (!excursionId) throw new BadRequestError("Hundträff saknas.");
  var excursion = null;
  try {
    excursion = $app.findRecordById("excursions", excursionId);
  } catch (_) {
    throw new BadRequestError("Hundträffen finns inte.");
  }
  if (!hk.canViewExcursion(me, excursion)) {
    throw new BadRequestError("Du har inte behörighet att visa intresse för denna hundträff.");
  }
  var hostId = hk.toId(excursion.get("host_user"));
  if (hostId && hostId === me) {
    throw new BadRequestError("Du ar redan med som arrangor.");
  }
  e.record.set("user", me);
  try {
    var existing = $app.findFirstRecordByFilter(
      "excursion_interests",
      "excursion = {:eid} && user = {:uid}",
      { eid: excursionId, uid: me }
    );
    if (existing) throw new BadRequestError("Du har redan visat intresse.");
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
  }
  e.next();
}, "excursion_interests");

onRecordCreateRequest((e) => {
  var hk = require(__hooks + "/hk_utils.js");
  if (!e || !e.record) {
    e.next();
    return;
  }
  var me = hk.authUserId(e);
  if (!me) throw new BadRequestError("Du måste vara inloggad.");
  var excursionId = hk.toId(e.record.get("excursion"));
  if (!excursionId) throw new BadRequestError("Hundträff saknas.");
  var body = String(e.record.get("body") || "").trim();
  if (!body) throw new BadRequestError("Kommentaren kan inte vara tom.");
  var excursion = null;
  try {
    excursion = $app.findRecordById("excursions", excursionId);
  } catch (_) {
    throw new BadRequestError("Hundträffen finns inte.");
  }
  if (!hk.canViewExcursion(me, excursion)) {
    throw new BadRequestError("Du har inte behörighet att kommentera denna hundträff.");
  }
  var parentId = hk.toId(e.record.get("parent_comment"));
  if (parentId) {
    try {
      var parent = $app.findRecordById("excursion_comments", parentId);
      if (hk.toId(parent.get("excursion")) !== excursionId) {
        throw new BadRequestError("Svar måste tillhöra samma hundträff.");
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError("Ogiltig parent_comment.");
    }
  }
  e.record.set("author", me);
  e.record.set("body", body);
  e.next();
}, "excursion_comments");

// 0. Block unverified users from creating connection requests
// Use onRecordCreateRequest (API-level) so BadRequestError message reaches the client
onRecordCreateRequest((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var fromUserVal = e.record.get("from_user");
  var fromUserId = "";
  if (fromUserVal) {
    if (typeof fromUserVal === "string") fromUserId = fromUserVal;
    else if (fromUserVal && typeof fromUserVal === "object" && fromUserVal.id) fromUserId = String(fromUserVal.id);
    else if (Array.isArray(fromUserVal) && fromUserVal.length > 0) fromUserId = String(fromUserVal[0].id || fromUserVal[0] || "");
  }
  if (!fromUserId) {
    e.next();
    return;
  }
  var user = null;
  try {
    user = $app.findRecordById("users", fromUserId);
  } catch (_) {
    e.next();
    return;
  }
  if (user && user.get("verified") !== true) {
    throw new BadRequestError("Du måste verifiera din e-post för att skicka intresseanmälningar.");
  }
  var toUserVal = e.record.get("to_user");
  var toUserId = "";
  if (toUserVal) {
    if (typeof toUserVal === "string") toUserId = toUserVal;
    else if (toUserVal && typeof toUserVal === "object" && toUserVal.id) toUserId = String(toUserVal.id);
    else if (Array.isArray(toUserVal) && toUserVal.length > 0) toUserId = String(toUserVal[0].id || toUserVal[0] || "");
  }
  if (toUserId) {
    try {
      var existing = $app.findFirstRecordByFilter("connection_requests", "from_user = {:f} && to_user = {:t}", { f: fromUserId, t: toUserId });
      if (existing) {
        throw new BadRequestError("Du har redan skickat intresse till denna användare.");
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
    }
  }
  e.next();
}, "connection_requests");

// 1. Incoming connection request + Match confirmation
// Note: mailFrom/sendMailSafe inlined - PocketBase JSVM may not share function scope with hooks
// Note: RecordEvent has record, app, context, type - NOT e.collection. We filter by collection name in the 2nd param.
onRecordAfterCreateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }

  $app.logger().info("Connection request created, preparing email");

  function toId(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.id) return String(v.id);
    if (Array.isArray(v) && v.length > 0) return toId(v[0]);
    return "";
  }
  function pairKey(a, b) {
    var x = String(a || "");
    var y = String(b || "");
    if (!x || !y) return "";
    return x < y ? (x + ":" + y) : (y + ":" + x);
  }
  var conn = e.record;
  var fromId = toId(conn.get("from_user"));
  var toIdVal = toId(conn.get("to_user"));
  if (!fromId || !toIdVal) {
    $app.logger().warn("Connection request missing from_user or to_user", "fromId", fromId, "toId", toIdVal);
    e.next();
    return;
  }

  var fromUser = null;
  var toUser = null;
  try {
    fromUser = $app.findRecordById("users", fromId);
    toUser = $app.findRecordById("users", toIdVal);
  } catch (err) {
    $app.logger().warn("Connection request: could not load users", "error", err);
    e.next();
    return;
  }
  var fromName = (fromUser && fromUser.get("name")) ? fromUser.get("name") : "Någon";
  var toEmail = toUser ? toUser.get("email") : null;
  var fromEmail = fromUser ? fromUser.get("email") : null;

  if (!toEmail) {
    $app.logger().warn("Connection request: recipient has no email", "toUserId", toIdVal);
  }

  // Check if reverse request exists (mutual match)
  var reverse = null;
  try {
    reverse = $app.findFirstRecordByFilter("connection_requests", "from_user = {:from} && to_user = {:to}", { from: toIdVal, to: fromId });
  } catch (err) { }
  var isMatch = !!reverse;

  var meta = $app.settings() && $app.settings().meta;
  var from = null;
  if (meta && meta.senderAddress && String(meta.senderAddress).trim()) {
    from = {
      address: String(meta.senderAddress).trim(),
      name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets"
    };
  }
  if (!from) {
    $app.logger().warn("Connection request email skipped: Sender address not configured. Set Settings > Meta > Sender address.");
    e.next();
    return;
  }

  function doSend(msg) {
    try {
      $app.newMailClient().send(msg);
      var toAddrs = (msg.to || []).map(function (r) { return r.address || r; }).join(", ");
      $app.logger().info("Email sent", "to", toAddrs, "subject", msg.subject || "(no subject)");
    } catch (err) {
      $app.logger().warn("Email send failed", "error", err);
    }
  }

  var urlMeta = $app.settings() && $app.settings().meta;
  var baseUrl = (urlMeta && urlMeta.appUrl) ? String(urlMeta.appUrl).replace(/\/$/, "") : "https://hundkrets.se";
  var matchesLink = baseUrl + "/app/explore?utm_source=email&utm_medium=notification&utm_campaign=interest";
  var matchesMatchedLink = baseUrl + "/app/explore?match=true&utm_source=email&utm_medium=notification&utm_campaign=match";

  if (isMatch) {
    // Deduplicate: only send match email for the first request in this direction.
    // If the user double-clicks or creates from multiple tabs, skip duplicate emails.
    var sameDir = [];
    try {
      sameDir = $app.findRecordsByFilter("connection_requests", "from_user = {:f} && to_user = {:t}", "created", 2, 0, { f: fromId, t: toIdVal });
    } catch (_) { }
    if (sameDir && sameDir.length > 1 && sameDir[0].id !== conn.id) {
      $app.logger().info("Connection request: duplicate detected, skipping match email");
      e.next();
      return;
    }

    // Create conversation and seed chat with connection request messages + system message
    var key = pairKey(fromId, toIdVal);
    var conv = null;
    try {
      conv = $app.findFirstRecordByFilter("conversations", "pair_key = {:k}", { k: key });
    } catch (_) { }
    if (!conv) {
      var userA = fromId < toIdVal ? fromId : toIdVal;
      var userB = fromId < toIdVal ? toIdVal : fromId;
      var convCol = $app.findCollectionByNameOrId("conversations");
      var convRec = new Record(convCol);
      convRec.set("user_a", userA);
      convRec.set("user_b", userB);
      convRec.set("pair_key", key);
      $app.save(convRec);
      conv = convRec;
    }
    var convId = conv.id;

    // Connection request messages (chronological: reverse first, then conn)
    var msgCol = $app.findCollectionByNameOrId("messages");
    var reverseMsg = reverse ? String(reverse.get("message") || "").trim() : "";
    var connMsg = String(conn.get("message") || "").trim();
    if (reverseMsg) {
      var m1 = new Record(msgCol);
      m1.set("conversation", convId);
      m1.set("sender", toId(reverse.get("from_user")));
      m1.set("body", reverseMsg);
      m1.set("message_type", "user");
      $app.save(m1);
    }
    if (connMsg) {
      var m2 = new Record(msgCol);
      m2.set("conversation", convId);
      m2.set("sender", fromId);
      m2.set("body", connMsg);
      m2.set("message_type", "user");
      $app.save(m2);
    }
    var sysBody = "Ni har matchat! Skapa gärna en plan tillsammans för hur ni introducerar hundarna – det underlättar första mötet.";
    var mSys = new Record(msgCol);
    mSys.set("conversation", convId);
    mSys.set("body", sysBody);
    mSys.set("message_type", "system");
    $app.save(mSys);

    try {
      conv.set("last_message_at", new Date().toISOString());
      $app.save(conv);
    } catch (_) { }

    var htmlBoth = "<p>Ni har kopplat ihop! Du kan nu se varandras telefon och adress i matchningar.</p><p><a href=\"" + matchesMatchedLink + "\">Öppna matchningar</a></p>";
    var subject = "Ni har matchat på Hundkrets!";
    if (toEmail) {
      doSend(new MailerMessage({ from: from, to: [{ address: toEmail }], subject: subject, html: htmlBoth }));
    }
    if (fromEmail) {
      doSend(new MailerMessage({ from: from, to: [{ address: fromEmail }], subject: subject, html: htmlBoth }));
    }
  } else {
    if (toEmail) {
      var msgText = conn.get("message");
      var msgHtml = (msgText && String(msgText).trim()) ? "<p style=\"margin: 1rem 0; padding: 0.75rem; background: #f5f5f5; border-radius: 8px; font-style: italic;\">\"" + String(msgText).trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") + "\"</p>" : "";
      var html = "<p><strong>" + fromName + "</strong> är intresserad av hundpassning från dig!</p>" + msgHtml + "<p>Logga in för att se dem i matchningar och svara.</p><p><a href=\"" + matchesLink + "\">Öppna matchningar</a></p>";
      doSend(new MailerMessage({ from: from, to: [{ address: toEmail }], subject: fromName + " är intresserad av dig på Hundkrets", html: html }));
    }
  }

  e.next();
}, "connection_requests");

// 2. Welcome email when onboarding is complete (only once per user)
onRecordAfterUpdateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }

  var record = e.record;
  if (!record || !record.get("onboarding_complete") || record.get("welcome_email_sent")) {
    e.next();
    return;
  }

  var email = record.get("email");
  if (!email) {
    e.next();
    return;
  }

  var meta = $app.settings() && $app.settings().meta;
  var from = null;
  if (meta && meta.senderAddress && String(meta.senderAddress).trim()) {
    from = {
      address: String(meta.senderAddress).trim(),
      name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets"
    };
  }
  if (!from) {
    e.next();
    return;
  }

  var name = record.get("name") || "där";
  var urlMeta = $app.settings() && $app.settings().meta;
  var baseUrl = (urlMeta && urlMeta.appUrl) ? String(urlMeta.appUrl).replace(/\/$/, "") : "https://hundkrets.se";
  var html = "<p>Välkommen till Hundkrets, " + name + "!</p><p>Du har slutfört din profil. Nu kan du hitta hundägare i ditt område som vill byta hundpassning.</p><p><a href=\"" + baseUrl + "/app/explore?utm_source=email&utm_medium=transactional&utm_campaign=welcome\">Se matchningar</a></p>";
  try {
    var msg = new MailerMessage({ from: from, to: [{ address: email }], subject: "Välkommen till Hundkrets!", html: html });
    $app.newMailClient().send(msg);
    $app.logger().info("Email sent", "to", email, "subject", "Välkommen till Hundkrets!");
  } catch (err) {
    $app.logger().warn("Email send failed", "error", err);
  }

  try {
    record.set("welcome_email_sent", true);
    $app.save(record);
  } catch (err) {
    $app.logger().warn("Could not set welcome_email_sent", "error", err);
  }

  e.next();
}, "users");

// 3. Ensure users have daily chat notification default when unset
onRecordAfterCreateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var user = e.record;
  if (!user.get("chat_email_frequency")) {
    try {
      user.set("chat_email_frequency", "daily");
      $app.save(user);
    } catch (err) {
      $app.logger().warn("Could not set default chat_email_frequency", "error", err);
    }
  }
  e.next();
}, "users");

// 4. When user saves profile, upsert postal_codes so future users get better suggestions.
onRecordAfterUpdateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var user = e.record;
  var cityVal = String(user.get("city") || "").trim();
  var areaVal = String(user.get("area") || "").trim();
  var addr = String(user.get("address_private") || "");
  var match = addr.match(/Postnummer\s+(\d{3}\s?\d{2})/i) || addr.match(/(\d{3}\s?\d{2})/);
  if (!match) {
    e.next();
    return;
  }
  var postalCode = String(match[1]).replace(/\s/g, "");
  if (postalCode.length !== 5) {
    e.next();
    return;
  }
  if (!cityVal) {
    e.next();
    return;
  }
  try {
    var pcRecords = $app.findRecordsByFilter("postal_codes", "postal_code = {:pc}", "", 1, 0, { pc: postalCode });
    if (pcRecords && pcRecords.length > 0) {
      var pcRec = pcRecords[0];
      var existingCity = String(pcRec.get("city") || "").trim();
      var existingArea = String(pcRec.get("area") || "").trim();
      var didUpdate = false;
      if (!existingCity) {
        pcRec.set("city", cityVal);
        didUpdate = true;
      }
      if (!existingArea) {
        pcRec.set("area", areaVal);
        didUpdate = true;
      }
      if (didUpdate) {
        $app.save(pcRec);
        $app.logger().info("postal_codes record enriched", "postal_code", postalCode, "city", cityVal, "area", areaVal);
      }
    } else {
      var pcCol = $app.findCollectionByNameOrId("postal_codes");
      var newPc = new Record(pcCol);
      newPc.set("postal_code", postalCode);
      newPc.set("city", cityVal);
      if (areaVal) newPc.set("area", areaVal);
      $app.save(newPc);
      $app.logger().info("postal_codes record created from user input", "postal_code", postalCode, "city", cityVal, "area", areaVal);
    }
  } catch (err) {
    $app.logger().warn("postal_codes upsert failed", "error", err, "postal_code", postalCode, "city", cityVal);
  }
  e.next();
}, "users");

// =====================================================
// RETENTION EMAIL SYSTEM
// Weekly digest to inactive users who haven't sent connection requests
// =====================================================

function hDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  var R = 6371;
  var toRad = function (deg) { return deg * Math.PI / 180; };
  var dLat = toRad(parseFloat(lat2) - parseFloat(lat1));
  var dLon = toRad(parseFloat(lon2) - parseFloat(lon1));
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(parseFloat(lat1))) * Math.cos(toRad(parseFloat(lat2))) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getUserCoords(user) {
  var lat = user.getFloat("latitude");
  var lon = user.getFloat("longitude");
  if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
    return { lat: String(lat), lon: String(lon) };
  }
  return null;
}

function getNearbyNewUsers(user, radiusKm, sinceDate) {
  var userCoords = getUserCoords(user);
  if (!userCoords) return [];

  var userId = user.id;
  var sinceStr = sinceDate instanceof Date ? sinceDate.toISOString() : String(sinceDate);

  var allUsers = [];
  try {
    allUsers = $app.findRecordsByFilter("users",
      "created >= {:since} && onboarding_complete = true && id != {:uid} && area != ''",
      "-created", 200, 0,
      { since: sinceStr, uid: userId }
    );
  } catch (err) {
    $app.logger().warn("getNearbyNewUsers: query failed", "error", err);
    return [];
  }

  var nearby = [];
  for (var i = 0; i < allUsers.length; i++) {
    var other = allUsers[i];
    var otherCoords = getUserCoords(other);
    if (!otherCoords) continue;
    var dist = hDistance(userCoords.lat, userCoords.lon, otherCoords.lat, otherCoords.lon);
    if (dist <= radiusKm) {
      nearby.push(other);
    }
  }
  return nearby;
}

function sendRetentionEmail(user, newUserCount, nearbyUsers) {
  var esc = function (s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
  };

  var userName = esc(user.get("name")) || "där";
  var userEmail = user.get("email");
  if (!userEmail) return false;

  var meta = $app.settings() && $app.settings().meta;
  var from = null;
  if (meta && meta.senderAddress && String(meta.senderAddress).trim()) {
    from = {
      address: String(meta.senderAddress).trim(),
      name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets"
    };
  }
  if (!from) {
    $app.logger().warn("Retention email skipped: sender not configured");
    return false;
  }

  var urlMeta = $app.settings() && $app.settings().meta;
  var baseUrl = (urlMeta && urlMeta.appUrl) ? String(urlMeta.appUrl).replace(/\/$/, "") : "https://hundkrets.se";
  var utmEmail = "utm_source=email&utm_medium=retention&utm_campaign=weekly_update";
  var matchesLink = baseUrl + "/app/explore?" + utmEmail;
  var settingsLink = baseUrl + "/app/settings?" + utmEmail;
  var unsubLink = baseUrl + "/api/unsubscribe/" + user.id + "/retention";

  var names = [];
  for (var i = 0; i < Math.min(3, nearbyUsers.length); i++) {
    var n = nearbyUsers[i].get("name");
    if (n) names.push(esc(n));
  }
  var namesStr = names.join(", ");
  var hasMore = nearbyUsers.length > 3;

  var html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Nya hundägare i ditt område</title></head>" +
    "<body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">" +
    "<div style=\"background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;\">" +
    "<h2 style=\"color: #2c3e50; margin-top: 0;\">Hej " + esc(userName) + "!</h2>" +
    "<p style=\"font-size: 18px; margin-bottom: 0;\"><strong>" + newUserCount + " nya hundägare har registrerats i ditt område.</strong></p></div>" +
    "<div style=\"background: #ffffff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;\">" +
    "<p style=\"margin-bottom: 20px;\">Det har gått en vecka sedan du loggade in på Hundkrets. I din närhet har " + newUserCount + " nya användare registrerat sig.";

  if (namesStr) {
    html += "</p><p style=\"margin-bottom: 20px;\">Några av dem är: <strong>" + namesStr + "</strong>" + (hasMore ? " och fler..." : "") + "</p>";
  } else {
    html += "</p>";
  }

  html += "<div style=\"text-align: center; margin: 30px 0;\">" +
    "<a href=\"" + matchesLink + "\" style=\"background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;\">Logga in och se alla</a></div></div>" +
    "<div style=\"background: #f8f9fa; border-radius: 8px; padding: 15px; font-size: 14px; color: #7f8c8d;\">" +
    "<p style=\"margin: 0;\">Du får detta meddelande eftersom du inte har loggat in på över en vecka.</p>" +
    "<p style=\"margin: 10px 0 0 0;\"><a href=\"" + settingsLink + "\" style=\"color: #7f8c8d; text-decoration: underline;\">Hantera e-postinställningar</a> • " +
    "<a href=\"" + unsubLink + "\" style=\"color: #7f8c8d; text-decoration: underline;\">Avsluta prenumeration</a></p></div></body></html>";

  var subject = newUserCount + " nya hundägare i ditt område";

  try {
    $app.newMailClient().send(new MailerMessage({ from: from, to: [{ address: userEmail }], subject: subject, html: html }));
    $app.logger().info("Retention email sent", "to", userEmail, "newUserCount", newUserCount);
    return true;
  } catch (err) {
    $app.logger().warn("Retention email failed", "error", err);
    return false;
  }
}

function runWeeklyRetentionJob() {
  $app.logger().info("Starting weekly retention email job");

  var oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  var inactiveUsers = [];
  try {
    inactiveUsers = $app.findRecordsByFilter("users",
      "last_login_at < {:oneWeek} && retention_email_enabled = true",
      "-created", 100, 0,
      { oneWeek: oneWeekAgo.toISOString() }
    );
  } catch (err) {
    $app.logger().warn("Retention job: query failed", "error", err);
    return { emailsSent: 0, usersChecked: 0 };
  }

  var sentCount = 0;
  for (var i = 0; i < inactiveUsers.length; i++) {
    var user = inactiveUsers[i];
    var userId = user.id;

    var hasConnectionRequests = false;
    try {
      var crs = $app.findRecordsByFilter("connection_requests", "from_user = {:uid}", "", 1, 0, { uid: userId });
      hasConnectionRequests = crs && crs.length > 0;
    } catch (err) { }

    if (hasConnectionRequests) continue;

    var lastLogin = user.get("last_login_at");
    if (!lastLogin) continue;

    var lastSent = user.get("last_retention_email_sent");
    if (lastSent) {
      var lastSentDate = new Date(String(lastSent));
      var daysSinceSent = (Date.now() - lastSentDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceSent < 7) continue;
    }

    var userEmail = user.get("email");
    if (!userEmail) continue;

    // Hard cap: never send more than 3 retention emails per user.
    try {
      var previousRetention = $app.findRecordsByFilter(
        "email_log",
        "type = 'retention' && to ~ {:email}",
        "-sent_at",
        3,
        0,
        { email: String(userEmail) }
      );
      if (previousRetention && previousRetention.length >= 3) continue;
    } catch (err) {
      $app.logger().warn("Retention job: could not check send limit", "error", err, "email", userEmail);
    }

    var radius = user.getFloat("retention_radius");
    if (isNaN(radius) || radius < 1) radius = 3;
    var nearbyUsers = getNearbyNewUsers(user, radius, lastLogin);
    if (nearbyUsers.length > 0) {
      var emailSent = sendRetentionEmail(user, nearbyUsers.length, nearbyUsers);
      if (emailSent) {
        try {
          user.set("last_retention_email_sent", new Date().toISOString());
          $app.save(user);
        } catch (err) {
          $app.logger().warn("Retention job: could not update last_sent", "error", err);
        }
        sentCount++;
      }
    }
  }

  $app.logger().info("Weekly retention email job completed", "emailsSent", sentCount);
  return { emailsSent: sentCount, usersChecked: inactiveUsers.length };
}

routerAdd("GET", "/api/unsubscribe/:userId/:type", (e) => {
  var userId = e.pathParams.userId;
  var type = e.pathParams.type;

  if (!userId || type !== "retention") {
    return e.json(400, { error: "Invalid unsubscribe request" });
  }

  try {
    var user = $app.findRecordById("users", userId);
    user.set("retention_email_enabled", false);
    $app.save(user);
    return e.json(200, { message: "Prenumeration avslutad", success: true });
  } catch (err) {
    $app.logger().warn("Unsubscribe failed", "error", err);
    return e.json(500, { error: "Could not unsubscribe" });
  }
});

routerAdd("POST", "/api/test/retention-emails", function (e) {
  $app.logger().info("Manual retention email test triggered");
  try {
    var result = runWeeklyRetentionJob();
    return e.json(200, { success: true, emailsSent: result.emailsSent, usersChecked: result.usersChecked });
  } catch (err) {
    $app.logger().warn("Manual retention test failed", "error", err);
    return e.json(500, { error: String(err) });
  }
});
