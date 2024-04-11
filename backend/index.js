import express from "express";
import router from "./router.js";
import cors from "cors";
import dotenv from 'dotenv';

const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(cors());
dotenv.config();

app.use(router);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
