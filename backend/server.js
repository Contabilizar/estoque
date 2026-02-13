require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')

const app = express()
app.use(express.json())
app.use(cors())

// =============================
// CONEXÃO BANCO
// =============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// =============================
// CRIAR TABELAS AUTOMATICAMENTE
// =============================
async function iniciarBanco() {
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

  // Criar admin automaticamente se não existir
  const admin = await pool.query(
    "SELECT * FROM funcionarios WHERE login = 'admin'"
  )

  if (admin.rows.length === 0) {
    const senhaHash = await bcrypt.hash('123456', 10)

    await pool.query(
      `INSERT INTO funcionarios (nome, login, senha_hash, pin, setor)
       VALUES ('Administrador', 'admin', $1, '0000', 'Administrativo')`,
      [senhaHash]
    )

    console.log('Admin criado automaticamente ✅')
  }

  console.log('Banco pronto ✅')
}

iniciarBanco()

// =============================
// MIDDLEWARE JWT
// =============================
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) return res.status(401).json({ error: 'Token não enviado' })

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' })
    req.user = user
    next()
  })
}

// =============================
// ROTA PRINCIPAL
// =============================
app.get('/', (req, res) => {
  res.send('API Controle Estoque rodando 🚀')
})

// =============================
// LOGIN
// =============================
app.post('/login', async (req, res) => {
  const { login, senha } = req.body

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
})

// =============================
// CADASTRAR ITEM
// =============================
app.post('/itens', autenticarToken, async (req, res) => {
  const { nome, categoria, estoque_atual, estoque_minimo } = req.body

  await pool.query(
    `INSERT INTO itens (nome, categoria, estoque_atual, estoque_minimo)
     VALUES ($1, $2, $3, $4)`,
    [nome, categoria, estoque_atual, estoque_minimo]
  )

  res.json({ message: 'Item cadastrado com sucesso' })
})

// =============================
// LISTAR ITENS
// =============================
app.get('/itens', autenticarToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM itens ORDER BY id DESC')
  res.json(result.rows)
})

// =============================
// RETIRADA COM PIN
// =============================
app.post('/retirada', autenticarToken, async (req, res) => {
  const { item_id, quantidade, pin } = req.body

  const funcionario = await pool.query(
    'SELECT * FROM funcionarios WHERE id = $1',
    [req.user.id]
  )

  if (funcionario.rows[0].pin !== pin)
    return res.status(401).json({ error: 'PIN incorreto' })

  await pool.query(
    `INSERT INTO movimentacoes (funcionario_id, item_id, quantidade, tipo, ip, user_agent)
     VALUES ($1, $2, $3, 'retirada', $4, $5)`,
    [
      req.user.id,
      item_id,
      quantidade,
      req.ip,
      req.headers['user-agent'],
    ]
  )

  await pool.query(
    `UPDATE itens
     SET estoque_atual = estoque_atual - $1
     WHERE id = $2`,
    [quantidade, item_id]
  )

  res.json({ message: 'Retirada registrada com sucesso' })
})

// =============================
app.listen(process.env.PORT || 3000, () =>
  console.log('Servidor rodando 🚀')
)
