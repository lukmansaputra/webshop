const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const app = express();
const path = require("path");
const db = require("./App/database");

const port = process.env.PORT || 8080;

// Gunakan EJS Layouts
app.use(expressLayouts);

// Set view engine EJS
app.set("view engine", "ejs");

// Set layout default
app.set("layout", "layouts/layout"); // relatif terhadap folder views

// Set folder views
app.set("views", path.join(__dirname, "App/views")); // hanya satu!

// Set folder static
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function formatSlug(slug) {
  return slug
    .replace(/-/g, " ") // Ganti - dengan spasi
    .split(" ") // Pisah kata-kata
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Kapital huruf pertama
    .join(" "); // Gabung kembali
}

const mainRouter = require("./App/routes/main");
app.use("/", mainRouter);

// app.get("/product/:categorySlug", async (req, res) => {
//   const { categorySlug } = req.params;

//   // Ambil semua produk dari database atau array
//   const allProducts = await db.getAll();

//   const filteredProducts = allProducts.data.filter(
//     (product) => product.category_slug === categorySlug
//   );
//   console.log(filteredProducts);

//   res.render("product-by-category", {
//     category_name: formatSlug(categorySlug),
//     products: filteredProducts,
//     category: categorySlug,
//   });
// });

// app.get("/product/overview/:slug", async (req, res) => {
//   const slug = req.params.slug;
//   const result = await db.getProductBySlug(slug);
//   console.log(result);

//   res.render("product-overview", {
//     product: result,
//     category_name: formatSlug(result.category_name),
//   });
// });

// Jalankan server
app.listen(port, () => {
  console.log("Server jalan di http://localhost:3000");
});
