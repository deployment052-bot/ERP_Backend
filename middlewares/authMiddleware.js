export const fakeAuth = (req, res, next) => {
  // 🔥 Change role here to test different levels
  req.user = {
    role: "STATE\\",   // CAPITAL / STATE / DISTRICT / STORE
    reference_id: 1,
  };
  next();
};