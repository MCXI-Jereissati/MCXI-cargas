import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    jwt.verify(token, process.env.TOKEN_JWT, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token inválido' });
      }
      
      req.user = user;
      next();
    });
  };
  