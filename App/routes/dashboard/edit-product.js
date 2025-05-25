const fs = require("fs");
const express = require("express");
const router = express.Router();
const db = require("../../database");
const multer = require("multer");
const path = require("path");

// Setup multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// GET form
router.get("/:productId", async (req, res) => {
  const categories = await db.getCategories();
  const result = await db.getProductById(req.params.productId);
  console.log(result);

  res.render("edit-product", {
    product: result,
    images: result.images,
    categories,
  });
});

// POST form
router.post("/", upload.array("images"), async (req, res) => {
  function replaceSpacesWithHyphens(text) {
    return text.replace(/\s+/g, "-").toLowerCase();
  }
  const {
    product_id,
    product_name,
    product_price,
    item_width,
    item_height,
    item_weight,
    description,
    category_id,
  } = req.body;

  // Konversi existing_images menjadi array (bisa undefined, string, atau array)
  const existingImages = Array.isArray(req.body["existing_images"])
    ? req.body["existing_images"]
    : req.body["existing_images"]
    ? [req.body["existing_images"]]
    : [];

  const newFiles = req.files;

  try {
    // Ambil gambar lama dari database
    const existingProduct = await db.getProductById(product_id);
    console.log(existingProduct);

    const oldImages = existingProduct.images || [];

    // Bandingkan gambar lama dengan existingImages dari form
    const imagesToDelete = oldImages.filter(
      (img) => !existingImages.includes(img)
    );

    // Hapus file dari folder public/uploads/
    for (const filename of imagesToDelete) {
      const filepath = path.join(
        __dirname,
        "../../public/uploads",
        path.basename(filename)
      );
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    // Simpan gambar baru (dari req.files)
    const newImagePaths = newFiles.map((file) => "/uploads/" + file.filename);

    // Gabungkan gambar yang masih ada + baru
    const finalImages = [...existingImages, ...newImagePaths];

    // Update data produk di DB
    await db.updateProductWithImages({
      id: product_id,
      category_id,
      name: product_name,
      slug: replaceSpacesWithHyphens(product_name),
      price: product_price,
      width: item_width,
      height: item_height,
      weight: item_weight,
      description,
      images: finalImages, // gabungan existing + baru
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
