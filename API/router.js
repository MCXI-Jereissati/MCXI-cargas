import express from "express";
import { authenticateToken } from "./middleware/authenticateToken.js";
import { login, createUser, logout } from "./user/login.js";
import { buscarCargas, getAllCargas, getCargasById, deleteCargasById } from "./cargas/cargas.js";
import { buscarCotacao } from "./cargas/cotacao.js";

const router = express.Router();

router.post("/", login);

router.route("/")
    .get((req, res) => {
      res.render("login")
    });

router.post("/signin", createUser);

router.route("/signin")
    .get((req, res) => {
      res.render("signin")
    });

router.post("/createUser", createUser);

router.post("/busca", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
      const cargasData = await buscarCargas(req, userId);
      res.status(200).json(cargasData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.get("/cargas", async (req, res) => {
  res.render("cargas")
})

router.get("/pagina-cargas", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
      const cargas = await getAllCargas(userId);
      res.status(200).json(cargas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.get("/pagina-cargas/:numCodigoAereo", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const numCodigoAereo = req.params.numCodigoAereo;
    try {
      const carga = await getCargasById(userId, numCodigoAereo);
      res.status(200).json(carga);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.delete("/pagina-cargas/:numCodigoAereo", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const numCodigoAereo = req.params.numCodigoAereo;
    try {
      const carga = await deleteCargasById(userId, numCodigoAereo);
      res.status(200).json(carga);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.post("/busca-cotacao", authenticateToken, async (req, res) => {
  try {
      const cotacaoData = await buscarCotacao(req);
      res.status(200).json(cotacaoData);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

router.get("/logout", (req, res) => {
  logout();
  res.redirect("/");
});


export default router;