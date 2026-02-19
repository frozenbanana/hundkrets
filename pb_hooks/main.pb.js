// Hundkrets - Email hooks for connection requests and onboarding
// Requires SMTP configured in PocketBase Admin > Settings > Mail settings

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
function mailFrom() {
  var meta = $app.settings() && $app.settings().meta;
  if (!meta || !meta.senderAddress) return null;
  return {
    address: meta.senderAddress,
    name: (meta.senderName && meta.senderName.trim()) ? meta.senderName.trim() : "Hundkrets"
  };
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
      var msgTo = new MailerMessage({
        from: from,
        to: [{ address: toEmail }],
        subject: subject,
        html: htmlBoth
      });
      $app.newMailClient().send(msgTo);
    }
    if (fromEmail) {
      var msgFrom = new MailerMessage({
        from: from,
        to: [{ address: fromEmail }],
        subject: subject,
        html: htmlBoth
      });
      $app.newMailClient().send(msgFrom);
    }
  } else {
    // Incoming request - notify the recipient (to_user)
    if (toEmail) {
      var html = "<p><strong>" + fromName + "</strong> är intresserad av dig!</p><p>Logga in för att se dem i matchningar och svara.</p><p><a href=\"" + matchesUrl() + "\">Öppna matchningar</a></p>";
      var msg = new MailerMessage({
        from: from,
        to: [{ address: toEmail }],
        subject: fromName + " är intresserad av dig på Hundkrets",
        html: html
      });
      $app.newMailClient().send(msg);
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
  var msg = new MailerMessage({
    from: from,
    to: [{ address: email }],
    subject: "Välkommen till Hundkrets!",
    html: html
  });
  $app.newMailClient().send(msg);

  try {
    record.set("welcome_email_sent", true);
    $app.save(record);
  } catch (err) {
    $app.logger().warn("Could not set welcome_email_sent", "error", err);
  }

  e.next();
}, "users");
