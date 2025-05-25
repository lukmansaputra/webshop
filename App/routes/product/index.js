const express = require("express");
const router = express.Router();
const db = require("../../database");

router.get("/", async (req, res) => {
  const product = await db.getAll();
  console.log(product);
  res.render("product/index.ejs", { products: product.data });
});

module.exports = router;
