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
  ssl: { rejectUnauthorized: false },
})

/* ==========================
   CRIAR TABELAS
========================== */
async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      login VARCHAR(50) UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      setor VARCHAR(100),
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  console.log("Tabelas verificadas ✅")
}

/* ==========================
   CRIAR ADMIN AUTOMÁTICO
========================== */
async function criarAdmin() {
  const senhaHash = await bcrypt.hash("123456", 10)

  await pool.query(`
    INSERT INTO funcionarios (nome, login, senha_hash)
    VALUES ('Administrador', 'admin', $1)
    ON CONFLICT (login) DO NOTHING
  `, [senhaHash])

  console.log("Admin criado automaticamente ✅")
}

criarTabelas().then(criarAdmin)

/* ==========================
   ROTA LOGIN
========================== */
app.post('/login', async (req, res) => {
  try {
    const { login, senha } = req.body

    const result = await pool.query(
      'SELECT * FROM funcionarios WHERE login = $1',
      [login]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário não encontrado' })
    }

    const usuario = result.rows[0]

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha incorreta' })
    }

    const token = jwt.sign(
      { id: usuario.id },
      process.env.JWT_SECRET || "segredo_super_forte",
      { expiresIn: '8h' }
    )

    res.json({ token })

  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno' })
  }
})

app.get('/', (req, res) => {
  res.send('API Controle Estoque rodando 🚀')
})

app.listen(process.env.PORT || 3000, () =>
  console.log('Servidor rodando 🚀')
)
