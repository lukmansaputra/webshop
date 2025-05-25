const express = require("express");
const router = express.Router();
const db = require("../database");

const dashboard = require("./dashboard");
const product = require("./product");

router.use("/dashboard", dashboard);
router.use("/product", product);

router.get("/", async (req, res) => {
  try {
    const products = await db.getAll();
    const categories = await db.getCategories();

    res.render("home", { products: products.data, categories });
  } catch (e) {}
});

module.exports = router;
