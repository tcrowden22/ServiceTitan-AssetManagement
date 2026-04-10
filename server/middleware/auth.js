const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).send({ message: 'No token provided!' });
  }

  // Expecting format "Bearer <token>"
  const bearerToken = token.split(' ')[1];

  if (!bearerToken) {
    return res.status(403).send({ message: 'Invalid token format!' });
  }

  jwt.verify(bearerToken, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized!' });
    }
    req.userId = decoded.id;
    next();
  });
};

module.exports = verifyToken;


