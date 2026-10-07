import { Router } from "express";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    res.json({
      notifications: await db("notifications")
        .where({ wallet: req.auth.wallet })
        .orderBy("created_at", "desc")
        .limit(100),
    });
  })
);

router.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const updated = await db("notifications")
      .where({ id: req.params.id, wallet: req.auth.wallet })
      .update({ read_at: new Date() });
    if (!updated)
      throw new AppError(
        404,
        "NOTIFICATION_NOT_FOUND",
        "Notification not found"
      );
    res.status(204).end();
  })
);

export { router as meRouter };
