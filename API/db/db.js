import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export function createDbClient() {
  const { DB_USER, DB_HOST, DB_DATABASE, DB_PASSWORD, DB_PORT } = process.env;

  if (!DB_USER || !DB_HOST || !DB_DATABASE || !DB_PASSWORD || !DB_PORT) {
    throw new Error('Uma ou mais variáveis de ambiente para conexão com o banco de dados não foram definidas.');
  }

  return new pkg.Client({
    user: DB_USER,
    host: DB_HOST,
    database: DB_DATABASE,
    password: DB_PASSWORD,
    port: DB_PORT,
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

async function createTables(db) {
  await Promise.all([
    db.query(createTableUser),
    db.query(createTableCargas),
    db.query(createTableCotacao),
  ]);
  console.log('Tabelas criadas com sucesso.');
}

async function connectAndCreateTables(db) {
  try {
    await db.connect();
    console.log('Conectado ao PostgreSQL.');
    await createTables(db);
    console.log('Conexão estável.');
  } catch (err) {
    console.error('Erro na conexão ou criação de tabelas:', err.message);
    throw err;
  }
}

async function maintainConnection() {
  let db;

  while (true) {
    try {
      if (db) {
        await db.end();
        console.log('Conexão anterior encerrada.');
      }
      
      db = createDbClient();

      db.on('error', async (err) => {
        console.error('Erro na conexão com o PostgreSQL:', err.message);
        await db.end();
        await new Promise(resolve => setTimeout(resolve, 5000));
      });

      db.on('end', async () => {
        console.error('Conexão com o PostgreSQL encerrada. Tentando reconectar...');
      });

      await connectAndCreateTables(db);
      break; 

    } catch (err) {
      console.error('Tentando reconectar após perda de conexão...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err.message);
  console.error('A aplicação tentará continuar a execução...');
});

maintainConnection().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
