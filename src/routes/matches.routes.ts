import { Router } from "express";

import { createMatch } from "../controllers/matches.controller";

const matchesRouter = Router();

matchesRouter.post("/matches", createMatch);

export default matchesRouter;
