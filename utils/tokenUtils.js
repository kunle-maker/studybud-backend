import jwt from 'jsonwebtoken';

export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET);
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET);
  return { accessToken, refreshToken };
};
