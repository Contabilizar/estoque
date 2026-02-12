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

app.get('/', (req, res) => {
  res.send('API Controle Estoque rodando 🚀')
})

app.listen(process.env.PORT || 3000, () =>
  console.log('Servidor rodando')
)
