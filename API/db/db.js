import pkg from 'pg';
import dotenv from 'dotenv';


dotenv.config();
const { Client } = pkg;

export const db = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const createTableUser = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(100) NOT NULL,
    salt VARCHAR(250) NOT NULL,
    admin BOOLEAN NOT NULL
  );
`;

const createTableCargas = `
  CREATE TABLE IF NOT EXISTS cargas (
    user_id INTEGER NOT NULL REFERENCES users(id),
    id SERIAL PRIMARY KEY,
    numCodigoAereo VARCHAR(100) NOT NULL,
    StatusAtual VARCHAR(100) NOT NULL,
    Partida VARCHAR(100) NOT NULL,
    Chegada VARCHAR(100) NOT NULL,
    Flight VARCHAR(10),
    Weight VARCHAR(10),
    Reservation VARCHAR(50)
  );
`;

const createTableCotacao = `
  CREATE TABLE IF NOT EXISTS cotacao (
    user_id INTEGER NOT NULL REFERENCES users(id),
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    dataHoraCotacao VARCHAR(100) NOT NULL,
    cotacaoCompra VARCHAR(100) NOT NULL,
    cotacaoVenda VARCHAR(100) NOT NULL,
    enviarEmail BOOLEAN NOT NULL
  );
`;

db.connect()
  .then(() => {
    console.log('Conectado ao PostgreSQL.');
    return Promise.all([
      db.query(createTableUser),
      db.query(createTableCargas),
      db.query(createTableCotacao)
    ]);
  })
  .then(() => console.log('Tabelas criadas com sucesso.'))
  .catch(err => console.error('Erro na conexão.', err));