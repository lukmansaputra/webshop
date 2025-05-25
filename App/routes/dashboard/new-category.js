const express = require("express");
const router = express.Router();

const db = require("../../database");

router.get("/s", async (req, res) => {
  try {
    const category = await db.getCategories();
    console.log(category);

    res.render("dashboard/category", { category });
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;
