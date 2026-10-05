// Signed retention-unsubscribe tokens.
// The PocketBase hook passes $security.hs256 and $security.equal.
// Tests pass their own hash and compare functions.

function retentionMessage(userId) {
  return "retention:" + String(userId || "");
}

function retentionToken(userId, secret, hs256) {
  if (!userId || !secret || typeof hs256 !== "function") return "";
  return String(hs256(retentionMessage(userId), secret) || "");
}

function retentionUnsubscribeIsValid(userId, type, token, secret, hs256, equal) {
  if (type !== "retention") return false;
  var provided = String(token || "");
  if (!userId || !provided || !secret) return false;
  var expected = retentionToken(userId, secret, hs256);
  if (!expected) return false;
  if (typeof equal === "function") return equal(expected, provided) === true;
  return expected === provided;
}

function retentionUnsubscribeLink(baseUrl, userId, secret, hs256) {
  var token = retentionToken(userId, secret, hs256);
  var base = String(baseUrl || "").replace(/\/$/, "");
  return (
    base +
    "/api/unsubscribe/" +
    encodeURIComponent(String(userId)) +
    "/retention?token=" +
    encodeURIComponent(token)
  );
}

module.exports = {
  message: retentionMessage,
  token: retentionToken,
  isValid: retentionUnsubscribeIsValid,
  link: retentionUnsubscribeLink,
};
