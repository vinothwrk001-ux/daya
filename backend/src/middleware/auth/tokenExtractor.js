function getTokenFromReq(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return { legacyBearer: true };
  
  if (req.cookies) {
    if (req.cookies.accessToken) return req.cookies.accessToken;
    if (req.cookies.staffAccessToken) return req.cookies.staffAccessToken;
  }
  
  return null;
}

module.exports = { getTokenFromReq };
