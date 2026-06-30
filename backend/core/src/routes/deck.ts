import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import {
  addDeckSlide,
  aiEditDeckSlide,
  changeTheme,
  deleteDeckSlide,
  duplicateDeckSlide,
  exportDeckFile,
  generateDeck,
  generateDeckOutline,
  generateOutlineCard,
  getDeck,
  getDeckExports,
  getDeckShare,
  getLatestDeckOutline,
  emptyTrashController,
  getTrash,
  getViewers,
  listDecks,
  moveDeck,
  moveDeckToTrash,
  purgeDeckController,
  restoreDeckController,
  regenerateSlideImage,
  reorderDeckSlides,
  searchDecksController,
  searchStockPhotos,
  toggleFavorite,
  updateDeck,
  updateDeckOutline,
  updateDeckShare,
  updateSlideContent,
} from "../controllers/deck.controller";
import { moveDeckSchema } from "../validators/folder.validator";
import {
  addSlideSchema,
  aiEditSlideSchema,
  changeThemeSchema,
  deckIdSchema,
  exportDeckSchema,
  favoriteSchema,
  generateDeckSchema,
  generateOutlineSchema,
  listDecksSchema,
  outlineCardSchema,
  reorderSlidesSchema,
  searchDecksSchema,
  slideImageSchema,
  slideParamsSchema,
  stockSearchSchema,
  updateDeckSchema,
  updateOutlineSchema,
  updateShareSchema,
  updateSlideSchema,
} from "../validators/deck.validator";

const router = express.Router();

router.post("/outline", requireAuth, validate(generateOutlineSchema), generateDeckOutline);
router.get("/outline/latest", requireAuth, getLatestDeckOutline);
router.post("/outline/slide", requireAuth, validate(outlineCardSchema), generateOutlineCard);
router.patch("/outline/:id", requireAuth, validate(updateOutlineSchema), updateDeckOutline);
router.post("/generate", requireAuth, validate(generateDeckSchema), generateDeck);
router.post("/stock-search", requireAuth, validate(stockSearchSchema), searchStockPhotos);
router.get("/search", requireAuth, validate(searchDecksSchema), searchDecksController);
router.get("/trash", requireAuth, getTrash);
router.delete("/trash", requireAuth, emptyTrashController);
router.get("/", requireAuth, validate(listDecksSchema), listDecks);
router.get("/:id", requireAuth, validate(deckIdSchema), getDeck);
router.get("/:id/viewers", requireAuth, validate(deckIdSchema), getViewers);
router.post("/:id/favorite", requireAuth, validate(favoriteSchema), toggleFavorite);
router.post("/:id/move", requireAuth, validate(moveDeckSchema), moveDeck);
router.post("/:id/trash", requireAuth, validate(deckIdSchema), moveDeckToTrash);
router.post("/:id/restore", requireAuth, validate(deckIdSchema), restoreDeckController);
router.delete("/:id", requireAuth, validate(deckIdSchema), purgeDeckController);
router.patch("/:id", requireAuth, validate(updateDeckSchema), updateDeck);
router.patch("/:id/theme", requireAuth, validate(changeThemeSchema), changeTheme);
router.post("/:id/export", requireAuth, validate(exportDeckSchema), exportDeckFile);
router.get("/:id/exports", requireAuth, validate(deckIdSchema), getDeckExports);
router.get("/:id/share", requireAuth, validate(deckIdSchema), getDeckShare);
router.put("/:id/share", requireAuth, validate(updateShareSchema), updateDeckShare);
router.patch("/:id/reorder", requireAuth, validate(reorderSlidesSchema), reorderDeckSlides);
router.post("/:id/slides", requireAuth, validate(addSlideSchema), addDeckSlide);
router.post(
  "/:id/slides/:slideId/duplicate",
  requireAuth,
  validate(slideParamsSchema),
  duplicateDeckSlide,
);
router.patch(
  "/:id/slides/:slideId",
  requireAuth,
  validate(updateSlideSchema),
  updateSlideContent,
);
router.post(
  "/:id/slides/:slideId/ai-edit",
  requireAuth,
  validate(aiEditSlideSchema),
  aiEditDeckSlide,
);
router.post(
  "/:id/slides/:slideId/image",
  requireAuth,
  validate(slideImageSchema),
  regenerateSlideImage,
);
router.delete(
  "/:id/slides/:slideId",
  requireAuth,
  validate(slideParamsSchema),
  deleteDeckSlide,
);

export default router;
