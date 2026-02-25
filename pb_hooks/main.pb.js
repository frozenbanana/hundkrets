// Hundkrets - Email hooks for connection requests and onboarding
// Requires SMTP configured in PocketBase Admin > Settings > Mail settings

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

  // 3. watch_capacity
  try {
    toDelete = $app.findRecordsByFilter("watch_capacity", "user = {:uid}", "", 0, 0, { uid: uid });
    for (var k = 0; k < toDelete.length; k++) {
      $app.delete(toDelete[k]);
    }
  } catch (err) {
    $app.logger().warn("User delete: watch_capacity cleanup", "error", err);
  }

  // 4. dogs (owner)
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

// Frontend URL for email links. Set Settings > Meta > App URL to your frontend (e.g. http://localhost:3000).
function appUrl() {
  var meta = $app.settings() && $app.settings().meta;
  var url = (meta && meta.appUrl) ? meta.appUrl : "";
  if (url) return String(url).replace(/\/$/, "");
  return "http://localhost:3000";
}

function matchesUrl() {
  return appUrl() + "/app/matches";
}

function matchesMatchedUrl() {
  return appUrl() + "/app/matches?match=true";
}

// Safe mail sender - returns { address, name } or null if not configured
// Requires Settings > Meta > Sender address (and optionally Sender name)
function mailFrom() {
  var meta = $app.settings() && $app.settings().meta;
  if (!meta || !meta.senderAddress || !String(meta.senderAddress).trim()) return null;
  return {
    address: String(meta.senderAddress).trim(),
    name: (meta.senderName && String(meta.senderName).trim()) ? String(meta.senderName).trim() : "Hundkrets"
  };
}

function sendMailSafe(msg) {
  try {
    $app.newMailClient().send(msg);
    var toAddrs = (msg.to || []).map(function (r) { return r.address || r; }).join(", ");
    $app.logger().info("Email sent", "to", toAddrs, "subject", msg.subject || "(no subject)");
  } catch (err) {
    $app.logger().warn("Email send failed", "error", err);
  }
}

// 1. Incoming connection request + Match confirmation
onRecordAfterCreateSuccess((e) => {
  if (!e || !e.collection || e.collection.name !== "connection_requests") {
    e.next();
    return;
  }

  var conn = e.record;
  var fromId = conn.get("from_user");
  var toId = conn.get("to_user");
  if (!fromId || !toId) {
    e.next();
    return;
  }

  var fromUser = null;
  var toUser = null;
  try {
    fromUser = $app.findRecordById("users", fromId);
    toUser = $app.findRecordById("users", toId);
  } catch (err) {
    e.next();
    return;
  }
  var fromName = (fromUser && fromUser.get("name")) ? fromUser.get("name") : "Någon";
  var toEmail = toUser ? toUser.get("email") : null;
  var fromEmail = fromUser ? fromUser.get("email") : null;

  // Check if reverse request exists (mutual match)
  var reverse = null;
  try {
    reverse = $app.findFirstRecordByFilter("connection_requests", "from_user = {:from} && to_user = {:to}", { from: toId, to: fromId });
  } catch (err) {}
  var isMatch = !!reverse;

  var from = mailFrom();
  if (!from) {
    e.next();
    return;
  }

  if (isMatch) {
    // Match confirmation - send to both users
    var htmlBoth = "<p>Ni har kopplat ihop! Du kan nu se varandras telefon och adress i matchningar.</p><p><a href=\"" + matchesMatchedUrl() + "\">Öppna matchningar</a></p>";
    var subject = "Ni har matchat på Hundkrets!";

    if (toEmail) {
      sendMailSafe(new MailerMessage({
        from: from,
        to: [{ address: toEmail }],
        subject: subject,
        html: htmlBoth
      }));
    }
    if (fromEmail) {
      sendMailSafe(new MailerMessage({
        from: from,
        to: [{ address: fromEmail }],
        subject: subject,
        html: htmlBoth
      }));
    }
  } else {
    // Incoming request - notify the recipient (to_user)
    if (toEmail) {
      var msgText = conn.get("message");
      var msgHtml = (msgText && String(msgText).trim()) ? "<p style=\"margin: 1rem 0; padding: 0.75rem; background: #f5f5f5; border-radius: 8px; font-style: italic;\">\"" + String(msgText).trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") + "\"</p>" : "";
      var html = "<p><strong>" + fromName + "</strong> är intresserad av dig!</p>" + msgHtml + "<p>Logga in för att se dem i matchningar och svara.</p><p><a href=\"" + matchesUrl() + "\">Öppna matchningar</a></p>";
      sendMailSafe(new MailerMessage({
        from: from,
        to: [{ address: toEmail }],
        subject: fromName + " är intresserad av dig på Hundkrets",
        html: html
      }));
    }
  }

  e.next();
}, "connection_requests");

// 2. Welcome email when onboarding is complete (only once per user)
onRecordAfterUpdateSuccess((e) => {
  if (!e || !e.collection || e.collection.name !== "users") {
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

  var from = mailFrom();
  if (!from) {
    e.next();
    return;
  }

  var name = record.get("name") || "där";
  var html = "<p>Välkommen till Hundkrets, " + name + "!</p><p>Du har slutfört din profil. Nu kan du hitta hundägare i ditt område som vill byta hundpassning.</p><p><a href=\"" + matchesUrl() + "\">Se matchningar</a></p>";
  sendMailSafe(new MailerMessage({
    from: from,
    to: [{ address: email }],
    subject: "Välkommen till Hundkrets!",
    html: html
  }));

  try {
    record.set("welcome_email_sent", true);
    $app.save(record);
  } catch (err) {
    $app.logger().warn("Could not set welcome_email_sent", "error", err);
  }

  e.next();
}, "users");
