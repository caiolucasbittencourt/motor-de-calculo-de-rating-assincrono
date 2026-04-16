import { NextFunction, Request, Response } from "express";
import express from "express";

import matchesRouter from "./routes/matches.routes";

const app = express();

app.use(express.json());
app.use(matchesRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error:", error);
  res.status(500).json({
    message: "Internal server error",
  });
});

export default app;
