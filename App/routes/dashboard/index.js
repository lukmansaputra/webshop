const express = require("express");
const router = express.Router();
const productsHandle = require("./products");
const categoriesHandle = require("./category");
const db = require("../../database");

// Tambahkan sebelum semua route di app.js
router.use((req, res, next) => {
  res.locals.hideNavbar = true; // default
  next();
});

router.use("/product", productsHandle);
router.use("/category", categoriesHandle);

router.get("/", async (req, res) => {
  const products = await db.getAll();
  const categories = await db.getCategories();
  console.log(categories);

  const totalProducts = Object.keys(products.data).length;
  const totalCategories = Object.keys(categories).length;

  res.render("dashboard", { totalProducts, totalCategories });
});

module.exports = router;
