// Hundkrets - Email hooks for connection requests and onboarding
// Requires SMTP configured in PocketBase Admin > Settings > Mail settings

$app.logger().info("Hundkrets pb_hooks loaded");

// Set last_login_at = created when a new user is created (registration)
onRecordCreateRequest((e) => {
  try {
    if (e.record) {
      e.record.set("last_login_at", new Date());
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

function asId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && v.id) return String(v.id);
  if (Array.isArray(v) && v.length > 0) return asId(v[0]);
  return "";
}

function pairKey(userA, userB) {
  var a = String(userA || "");
  var b = String(userB || "");
  if (!a || !b) return "";
  return a < b ? (a + ":" + b) : (b + ":" + a);
}

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
    try { $app.delete(conv); } catch (_) {}
    e.next();
    return;
  }

  var key = pk(userA, userB);
  try {
    conv.set("pair_key", key);
    $app.save(conv);
  } catch (_) {}

  // De-duplicate conversations (keep oldest)
  try {
    var duplicates = $app.findRecordsByFilter("conversations", "pair_key = {:k} && id != {:id}", "created", 1, 0, { k: key, id: conv.id });
    if (duplicates && duplicates.length > 0) {
      $app.delete(conv);
      e.next();
      return;
    }
  } catch (_) {}

  var forward = null;
  var reverse = null;
  try {
    forward = $app.findFirstRecordByFilter("connection_requests", "from_user = {:from} && to_user = {:to}", { from: userA, to: userB });
  } catch (_) {}
  try {
    reverse = $app.findFirstRecordByFilter("connection_requests", "from_user = {:from} && to_user = {:to}", { from: userB, to: userA });
  } catch (_) {}

  if (!forward || !reverse) {
    $app.logger().warn("Conversation removed: users are not mutually matched", "conversationId", conv.id);
    try { $app.delete(conv); } catch (_) {}
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
  var toId = function(v) { if (!v) return ""; if (typeof v === "string") return v; if (v && typeof v === "object" && v.id) return String(v.id); if (Array.isArray(v) && v.length > 0) return toId(v[0]); return ""; };
  var esc = function(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); };
  var convId = toId(msgRec.get("conversation"));
  var senderId = toId(msgRec.get("sender"));
  var msgType = String(msgRec.get("message_type") || "user");
  var isSystem = msgType === "system";

  if (!convId) {
    try { $app.delete(msgRec); } catch (_) {}
    e.next();
    return;
  }

  var conv = null;
  try {
    conv = $app.findRecordById("conversations", convId);
  } catch (_) {
    try { $app.delete(msgRec); } catch (_) {}
    e.next();
    return;
  }

  if (isSystem || !senderId) {
    // System message: only update last_message_at, no email
    try {
      conv.set("last_message_at", new Date().toISOString());
      $app.save(conv);
    } catch (_) {}
    e.next();
    return;
  }

  var userA = toId(conv.get("user_a"));
  var userB = toId(conv.get("user_b"));
  if (senderId !== userA && senderId !== userB) {
    $app.logger().warn("Message removed: sender is not conversation participant", "messageId", msgRec.id, "senderId", senderId);
    try { $app.delete(msgRec); } catch (_) {}
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
  } catch (_) {}

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
  var chatLink = baseUrl + "/app/chats/" + conv.id;

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
  } catch (err) {}
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
  var matchesLink = baseUrl + "/app/explore";
  var matchesMatchedLink = baseUrl + "/app/explore?match=true";

  if (isMatch) {
    // Deduplicate: only send match email for the first request in this direction.
    // If the user double-clicks or creates from multiple tabs, skip duplicate emails.
    var sameDir = [];
    try {
      sameDir = $app.findRecordsByFilter("connection_requests", "from_user = {:f} && to_user = {:t}", "created", 2, 0, { f: fromId, t: toIdVal });
    } catch (_) {}
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
    } catch (_) {}
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
    } catch (_) {}

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
  var html = "<p>Välkommen till Hundkrets, " + name + "!</p><p>Du har slutfört din profil. Nu kan du hitta hundägare i ditt område som vill byta hundpassning.</p><p><a href=\"" + baseUrl + "/app/explore\">Se matchningar</a></p>";
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

// 4. When user saves profile with area, update postal_codes so future users get it as suggestion
onRecordAfterUpdateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var user = e.record;
  var areaVal = String(user.get("area") || "").trim();
  if (!areaVal) {
    e.next();
    return;
  }
  var addr = String(user.get("address_private") || "");
  var match = addr.match(/Postnummer\s+(\d{3}\s?\d{2})/i) || addr.match(/(\d{3}\s?\d{2})/);
  if (!match) {
    e.next();
    return;
  }
  var postalCode = String(match[1]).replace(/\s/g, "");
  try {
    var pcRecords = $app.findRecordsByFilter("postal_codes", "postal_code = {:pc}", "", 1, 0, { pc: postalCode });
    if (pcRecords && pcRecords.length > 0) {
      var rec = pcRecords[0];
      var existingArea = String(rec.get("area") || "").trim();
      if (!existingArea) {
        rec.set("area", areaVal);
        $app.save(rec);
        $app.logger().info("postal_codes area updated", "postal_code", postalCode, "area", areaVal);
      }
    }
  } catch (err) {
    $app.logger().warn("postal_codes area update failed", "error", err);
  }
  e.next();
}, "users");

// 4. When user saves profile with area, update postal_codes so future users get it as suggestion
onRecordAfterUpdateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  var user = e.record;
  var areaVal = String(user.get("area") || "").trim();
  if (!areaVal) {
    e.next();
    return;
  }
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
  try {
    var pcRecords = $app.findRecordsByFilter("postal_codes", "postal_code = {:pc}", "", 1, 0, { pc: postalCode });
    if (pcRecords && pcRecords.length > 0) {
      var pcRec = pcRecords[0];
      var existingArea = String(pcRec.get("area") || "").trim();
      if (!existingArea) {
        pcRec.set("area", areaVal);
        $app.save(pcRec);
        $app.logger().info("postal_codes area updated", "postal_code", postalCode, "area", areaVal);
      }
    }
  } catch (err) {
    $app.logger().warn("postal_codes area update failed", "error", err);
  }
  e.next();
}, "users");
