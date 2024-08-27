import pkg from 'pg';
import dotenv from 'dotenv';

export function createDbClient() {
  dotenv.config();

  return new pkg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    connectionTimeoutMillis: 10000, 
    query_timeout: 30000,  
    keepAlive: true,
  });
}

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
    dataHoraCotacao VARCHAR(100),
    cotacaoCompra VARCHAR(100),
    cotacaoVenda VARCHAR(100),
    enviarEmail BOOLEAN NOT NULL
  );
`;

async function connectAndCreateTables(retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    const db = createDbClient();
    try {
      await db.connect();
      console.log('Conectado ao PostgreSQL.');

      await Promise.all([
        db.query(createTableUser),
        db.query(createTableCargas),
        db.query(createTableCotacao)
      ]);

      console.log('Tabelas criadas com sucesso.');
      db.end();
      return;
    } catch (err) {
      console.error('Erro na conexão ou criação de tabelas:', err);

      if (
        err.code === 'ECONNREFUSED' || 
        err.code === 'ETIMEDOUT' || 
        err.code === 'ECONNRESET' || 
        err.code === 'ECONNABORTED'
      ) {
        console.error(`Tentativa ${i + 1} falhou, tentando novamente em ${delay / 1000} segundos...`);
        await db.end();
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        await db.end();
        throw err;
      }
    }
  }
  console.error('Falha após múltiplas tentativas.');
}

async function maintainConnection() {
  let db;

  while (true) {
    try {
      dotenv.config();

      if (db) {
        await db.end();
      }

      db = createDbClient();
      await connectAndCreateTables();
      console.log('Conexão estável.');
      break;
    } catch (err) {
      console.error('Tentando reconectar após perda de conexão...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  db.on('end', async () => {
    console.error('Conexão com o PostgreSQL encerrada. Tentando reconectar...');
    await maintainConnection();
  });

  db.on('error', async (err) => {
    console.error('Erro na conexão com o PostgreSQL:', err);
    await maintainConnection();
  });

  await db.connect();
}

maintainConnection().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});