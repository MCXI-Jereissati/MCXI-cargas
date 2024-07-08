import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from "../db/db.js";
import dotenv from 'dotenv';

dotenv.config();

export const createUser = async (req, res) => {
  const { nome, email, senha, admin } = req.body;

  try {
    const emailQuery = `SELECT * FROM users WHERE email = $1;`;
    const emailResult = await db.query(emailQuery, [email]);

    if (emailResult.rows.length > 0) {
      return res.status(400).json({ error: 'E-mail já está em uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedSenha = await bcrypt.hash(senha, salt);

    const query = `
      INSERT INTO users (nome, email, senha, salt, admin)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;`;

    const values = [nome, email, hashedSenha, salt, admin];
    const result = await db.query(query, values);

    const newUser = result.rows[0];
    res.status(201).json(newUser);
  } catch (err) {
    console.error('Erro ao cadastrar usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const login = async (req, res) => {
  const { email, senha } = req.body;

  try {
    const query = `SELECT * FROM users WHERE email = $1;`;
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    const senhaMatch = await bcrypt.compare(senha, user.senha);

    if (!senhaMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: user.admin },
      process.env.TOKEN_JWT,
      { expiresIn: '30d' }
    );

    res.status(200).json({ token, userId: user.id });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  window.location.href = '/';
};
