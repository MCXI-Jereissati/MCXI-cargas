import express from "express";
import { authenticateToken } from "./middleware/authenticateToken.js";
import { login, createUser } from "./user/login.js";
import { buscarCargas, getAllCargas, getCargasById, deleteCargasById } from "./cargas/cargas.js";

const router = express.Router();

router.post("/", login);

router.post("/signin", createUser);

router.post("/busca", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
      const cargasData = await buscarCargas(req, userId);
      res.status(200).json(cargasData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.get("/cargas", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
      const cargas = await getAllCargas(userId);
      res.status(200).json(cargas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.get("/cargas/:numCodigoAereo", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const numCodigoAereo = req.params.numCodigoAereo;
    try {
      const carga = await getCargasById(userId, numCodigoAereo);
      res.status(200).json(carga);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

router.delete("/cargas/:numCodigoAereo", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const numCodigoAereo = req.params.numCodigoAereo;
    try {
      const carga = await deleteCargasById(userId, numCodigoAereo);
      res.status(200).json(carga);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

export default router;