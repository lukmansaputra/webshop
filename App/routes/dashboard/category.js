const express = require("express");
const router = express.Router();

const db = require("../../database/Database");

router.get("/", async (req, res) => {
  try {
    const category = await db.getAllCategories();

    res.render("dashboard/category", { category: category.data });
  } catch (error) {
    console.error(error);
  }
});

router.get("/new-category", async (req, res) => {
  try {
    res.render("dashboard/new-category");
  } catch (error) {
    console.error(error);
  }
});

router.get("/edit-category/:categoryId", async (req, res) => {
  try {
    const category = await db.getCategoryById(req.params.categoryId);

    res.render("dashboard/edit-category", { category: category.data });
  } catch (error) {
    console.error(error);
  }
});

router.post("/new-category", async (req, res) => {
  try {
    function replaceSpacesWithHyphens(text) {
      return text.replace(/\s+/g, "-").toLowerCase();
    }
    const name = req.body.category_name;
    const slug = replaceSpacesWithHyphens(req.body.category_name);

    const result = await db.createCategory({ name, slug });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }
    res.status(200).json({ message: "Category created" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error });
  }
});

router.post("/edit-category", async (req, res) => {
  try {
    function replaceSpacesWithHyphens(text) {
      return text.replace(/\s+/g, "-").toLowerCase();
    }
    const name = req.body.category_name;
    const slug = replaceSpacesWithHyphens(req.body.category_name);
    const categoryId = req.body.category_id;

    const result = await db.updateCategory(categoryId, { name, slug });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }
    res.status(200).json({ message: "Category updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error });
  }
});

router.post("/delete", async (req, res) => {
  try {
    const categoryId = req.query.category_id;
    const result = await db.deleteCategory(categoryId);

    if (result.success) {
      res.status(200).json({ message: `Deleted product ${categoryId}` });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error });
  }
});

module.exports = router;
