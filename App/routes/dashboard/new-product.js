const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Setup storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/"); // Pastikan folder ini ada
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Contoh: 123456789.jpg
  },
});

const upload = multer({ storage: storage });

const db = require("../../database");

router.get("/", async (req, res) => {
  const categories = await db.getCategories();
  res.render("new-product", { categories });
});

router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    function replaceSpacesWithHyphens(text) {
      return text.replace(/\s+/g, "-").toLowerCase();
    }
    const {
      product_name,
      item_weight,
      item_height,
      item_width,
      product_price,
      description,
      category_id,
    } = req.body;
    const imagePaths = req.files.map((file) => "/uploads/" + file.filename); // Path untuk disimpan ke DB

    // Simpan ke database sesuai kebutuhan
    const result = await db.insertProduct({
      category_id,
      product_name,
      product_slug: replaceSpacesWithHyphens(product_name),
      product_price,
      description,
      images: imagePaths, // Pastikan DB bisa menyimpan array (atau simpan sebagai string/JSON)
      width: item_width,
      height: item_height,
      weight: item_weight,
    });

    res.status(200).json({ message: "Product created", data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// router.post("/new-product", async (req, res) => {
//   try {
//     console.log(req.body);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to create new product" });
//   }
// });

router.post("/add-category", async (req, res) => {
  try {
    const { name } = req.body;
    const newString = name.replace(/\s/g, "-").toLowerCase();

    const result = await db.insertCategories({ name: name, slug: newString });
    res.status(200).json({ message: "Categories created", data: result });
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: "Failed to create categories" });
  }
});

router.post("/delete", async (req, res) => {
  try {
    const productId = req.query.id;
    const result = await db.deleteProduct(productId);
    if (result.success) {
      res.status(200).json({ message: `Deleted product ${productId}` });
    }
  } catch (error) {}
});

module.exports = router;
