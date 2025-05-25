const sqlite3 = require("sqlite3").verbose();

class Database {
  constructor() {
    this.db = new sqlite3.Database("./berkah-jaya.db", (err) => {
      if (err) return console.error("Database connection error:", err.message);
      console.log("✅ Connected to SQLite database.");
    });

    this.initializeTables();
  }

  initializeTables() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          image TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          price REAL NOT NULL,
          width REAL,
          height REAL,
          weight REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS product_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          image_path TEXT NOT NULL,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
      `);

      const insertInitialCategories = `
        INSERT OR IGNORE INTO categories (name, slug)
        VALUES 
          ('Foods', 'foods'),
          ('Milk', 'milk'),
          ('Others', 'others')
      `;
      this.db.run(insertInitialCategories);
    });
  }

  /** ========== CATEGORY CRUD ========== */

  createCategory({ name, slug, image = null }) {
    return new Promise((resolve) => {
      this.db.run(
        `INSERT INTO categories (name, slug, image) VALUES (?, ?, ?)`,
        [name, slug, image],
        function (err) {
          if (err) return resolve({ success: false, message: err.message });
          resolve({ success: true, message: "Category created successfully." });
        }
      );
    });
  }

  getAllCategories() {
    return new Promise((resolve) => {
      this.db.all(`SELECT * FROM categories ORDER BY name ASC`, (err, rows) => {
        if (err) return resolve({ success: false, message: err.message });
        resolve({
          success: true,
          message: "Categories retrieved successfully.",
          data: rows,
        });
      });
    });
  }

  getCategoryById(id) {
    return new Promise((resolve) => {
      this.db.get(`SELECT * FROM categories WHERE id = ?`, [id], (err, row) => {
        if (err) return resolve({ success: false, message: err.message });
        resolve({
          success: true,
          message: "Category retrieved successfully.",
          data: row,
        });
      });
    });
  }

  updateCategory(id, { name, slug, image = null }) {
    console.log(id);

    return new Promise((resolve) => {
      this.db.run(
        `UPDATE categories SET name = ?, slug = ?, image = ? WHERE id = ?`,
        [name, slug, image, id],
        function (err) {
          if (err) return resolve({ success: false, message: err.message });

          if (this.changes === 0) {
            return resolve({
              success: false,
              message:
                "No category was updated. Maybe the ID does not exist or data is unchanged.",
            });
          }

          resolve({
            success: true,
            message: "Category updated successfully.",
          });
        }
      );
    });
  }

  deleteCategory(id) {
    return new Promise((resolve) => {
      this.db.run(`DELETE FROM categories WHERE id = ?`, [id], function (err) {
        if (err) return resolve({ success: false, message: err.message });
        resolve({ success: true, message: "Category deleted successfully." });
      });
    });
  }

  /** ========== PRODUCT CRUD ========== */

  createProduct({
    category_id,
    name,
    slug,
    description = "",
    price,
    width = null,
    height = null,
    weight = null,
    images = [],
  }) {
    return new Promise((resolve) => {
      this.db.run(
        `INSERT INTO products (category_id, name, slug, description, price, width, height, weight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category_id,
          name,
          slug,
          description,
          price,
          isNaN(width) ? null : width,
          isNaN(height) ? null : height,
          isNaN(weight) ? null : weight,
        ],
        function (err) {
          if (err) return resolve({ success: false, message: err.message });

          const productId = this.lastID;
          if (!images.length)
            return resolve({
              success: true,
              message: "Product created successfully.",
              productId,
            });

          const stmt = `INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`;
          const promises = images.map(
            (img) =>
              new Promise((res, rej) => {
                this.db.run(stmt, [productId, img], (err) =>
                  err ? rej(err) : res()
                );
              })
          );

          Promise.all(promises)
            .then(() =>
              resolve({
                success: true,
                message: "Product and images created successfully.",
                productId,
              })
            )
            .catch((err) => resolve({ success: false, message: err.message }));
        }.bind(this)
      );
    });
  }

  getProductById(id) {
    return new Promise((resolve) => {
      const query = `
        SELECT products.*, categories.name AS category_name, categories.slug AS category_slug,
        (
          SELECT json_group_array(image_path)
          FROM product_images
          WHERE product_images.product_id = products.id
        ) AS images
        FROM products
        JOIN categories ON products.category_id = categories.id
        WHERE products.id = ?
      `;
      this.db.get(query, [id], (err, row) => {
        if (err) return resolve({ success: false, message: err.message });
        resolve({
          success: true,
          message: "Product retrieved successfully.",
          data: row ? { ...row, images: JSON.parse(row.images || "[]") } : null,
        });
      });
    });
  }

  getAllProducts() {
    return new Promise((resolve) => {
      const query = `
        SELECT products.*, categories.name AS category_name, categories.slug AS category_slug,
        (
          SELECT json_group_array(image_path)
          FROM product_images
          WHERE product_images.product_id = products.id
        ) AS images
        FROM products
        JOIN categories ON products.category_id = categories.id
        ORDER BY products.created_at DESC
      `;
      this.db.all(query, [], (err, rows) => {
        if (err) return resolve({ success: false, message: err.message });
        resolve({
          success: true,
          message: "Products retrieved successfully.",
          data: rows.map((row) => ({
            ...row,
            images: JSON.parse(row.images || "[]"),
          })),
        });
      });
    });
  }

  updateProduct(
    id,
    {
      category_id,
      name,
      slug,
      description = "",
      price,
      width = null,
      height = null,
      weight = null,
      images = [],
    }
  ) {
    return new Promise((resolve) => {
      this.db.serialize(() => {
        this.db.run(
          `UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?, price = ?, width = ?, height = ?, weight = ? WHERE id = ?`,
          [
            category_id,
            name,
            slug,
            description,
            price,
            isNaN(width) ? null : width,
            isNaN(height) ? null : height,
            isNaN(weight) ? null : weight,
            id,
          ],
          (err) => {
            if (err) return resolve({ success: false, message: err.message });

            this.db.all(
              `SELECT image_path FROM product_images WHERE product_id = ?`,
              [id],
              (err, oldRows) => {
                if (err)
                  return resolve({ success: false, message: err.message });

                const oldImages = oldRows.map((r) => r.image_path);
                const toDelete = oldImages.filter(
                  (img) => !images.includes(img)
                );
                const toInsert = images.filter(
                  (img) => !oldImages.includes(img)
                );

                const deletePromises = toDelete.map(
                  (img) =>
                    new Promise((res, rej) => {
                      this.db.run(
                        `DELETE FROM product_images WHERE product_id = ? AND image_path = ?`,
                        [id, img],
                        (err) => (err ? rej(err) : res())
                      );
                    })
                );

                const insertPromises = toInsert.map(
                  (img) =>
                    new Promise((res, rej) => {
                      this.db.run(
                        `INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`,
                        [id, img],
                        (err) => (err ? rej(err) : res())
                      );
                    })
                );

                Promise.all([...deletePromises, ...insertPromises])
                  .then(() =>
                    resolve({
                      success: true,
                      message: "Product updated successfully.",
                    })
                  )
                  .catch((err) =>
                    resolve({ success: false, message: err.message })
                  );
              }
            );
          }
        );
      });
    });
  }

  deleteProduct(id) {
    return new Promise((resolve) => {
      this.db.run(`DELETE FROM products WHERE id = ?`, [id], function (err) {
        if (err) return resolve({ success: false, message: err.message });
        resolve({ success: true, message: "Product deleted successfully." });
      });
    });
  }

  /** ========== Utility ========== */

  close() {
    this.db.close((err) => {
      if (err) console.error("❌ Error closing DB:", err.message);
      else console.log("✅ DB connection closed.");
    });
  }
}

module.exports = new Database();
