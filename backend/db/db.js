import pkg from 'pg';
const { Client } = pkg;

export const db = new Client({
  user: "postgres",
  host: "localhost",
  database: "robo",
  password: "1234",
  port: 5432,
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

db.connect()
  .then(() => {
    console.log('Conectado ao PostgreSQL.');
    return Promise.all([
      db.query(createTableUser),
      db.query(createTableCargas)
    ]);
  })
  .then(() => console.log('Tabelas criadas com sucesso.'))
  .catch(err => console.error('Erro na conexão.', err));