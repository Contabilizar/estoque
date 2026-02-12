require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')

const app = express()
app.use(express.json())
app.use(cors())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      login VARCHAR(50) UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      pin VARCHAR(10) NOT NULL,
      setor VARCHAR(100),
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS itens (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      categoria VARCHAR(50),
      estoque_atual INTEGER DEFAULT 0,
      estoque_minimo INTEGER DEFAULT 0,
      ativo BOOLEAN DEFAULT TRUE
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id SERIAL PRIMARY KEY,
      funcionario_id INTEGER REFERENCES funcionarios(id),
      item_id INTEGER REFERENCES itens(id),
      quantidade INTEGER NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip VARCHAR(50),
      user_agent TEXT
    );
  `)

  console.log("Tabelas verificadas/criadas com sucesso ✅")
}

criarTabelas()

app.get('/', (req, res) => {
  res.send('API Controle Estoque rodando 🚀')
})

app.listen(process.env.PORT || 3000, () =>
  console.log('Servidor rodando')
)
