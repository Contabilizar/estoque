require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')

const app = express()
app.use(express.json())
app.use(cors())

// 🔗 Conexão com banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// 🗄 Criar tabelas automaticamente
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

// 🏠 Rota principal
app.get('/', (req, res) => {
  res.send('API Controle Estoque rodando 🚀')
})

// 👤 Criar admin (executar UMA vez)
app.get('/criar-admin', async (req, res) => {
  try {
    const senhaHash = await bcrypt.hash('123456', 10)

    await pool.query(
      `INSERT INTO funcionarios (nome, login, senha_hash, pin, setor)
       VALUES ('Administrador', 'admin', $1, '0000', 'Administrativo')
       ON CONFLICT (login) DO NOTHING`,
      [senhaHash]
    )

    res.send('Admin criado com sucesso ✅')
  } catch (err) {
    console.error(err)
    res.status(500).send('Erro ao criar admin')
  }
})

app.get('/listar-usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome, login FROM funcionarios')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).send('Erro ao listar usuários')
  }
})

// 🔐 Login
app.post('/login', async (req, res) => {
  const { login, senha } = req.body

  try {
    const result = await pool.query(
      'SELECT * FROM funcionarios WHERE login = $1',
      [login]
    )

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Usuário não encontrado' })

    const usuario = result.rows[0]

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)

    if (!senhaValida)
      return res.status(401).json({ error: 'Senha incorreta' })

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({ token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro no servidor' })
  }
})

// 🚀 Iniciar servidor
app.listen(process.env.PORT || 3000, () =>
  console.log('Servidor rodando 🚀')
)
