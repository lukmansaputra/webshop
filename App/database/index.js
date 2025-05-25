const sqlite3 = require("sqlite3").verbose();

class Database {
  constructor() {
    this.db = new sqlite3.Database("./berkah-jaya.db", (err) => {
      if (err) {
        return console.error("Database connection error:", err.message);
      }
      console.log("Connected to the webshop SQLite database.");
    });

    this.db.serialize(() => {
      // Buat tabel categories
      this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        image TEXT
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

      // Buat tabel products
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

      // Tambahkan kolom jika belum ada
      this.db.run(`ALTER TABLE products ADD COLUMN width REAL`, () => {});
      this.db.run(`ALTER TABLE products ADD COLUMN height REAL`, () => {});
      this.db.run(`ALTER TABLE products ADD COLUMN weight REAL`, () => {});

      // Buat tabel product_images
      this.db.run(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

      // Insert kategori awal
      const insertCategories = `
      INSERT OR IGNORE INTO categories (name, slug)
      VALUES 
        ('Foods', 'foods'),
        ('Milk', 'milk'),
        ('Others', 'others')
    `;
      this.db.run(insertCategories);
    });
  }

  insertCategories = ({ name, slug }) => {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO categories (name, slug) VALUES (?, ?)`,
        [name, slug],
        (err) => {
          if (err) return reject(err);
          resolve({ success: true });
        }
      );
    });
  };

  deleteProduct = (productId) => {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM products WHERE id = ?`,
        [productId],
        function (err) {
          if (err) {
            console.error("❌ Delete product error:", err.message);
            return reject(err);
          }
          console.log(`🗑️ Deleted product ID: ${productId}`);
          resolve({ success: true });
        }
      );
    });
  };

  insertProduct = ({
    category_id,
    product_name,
    product_slug,
    product_price,
    description,
    images,
    width,
    height,
    weight,
  }) => {
    const self = this;
    return new Promise((resolve, reject) => {
      self.db.run(
        `
        INSERT INTO products (category_id, name, slug, description, price, width, height, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          category_id,
          product_name,
          product_slug,
          description,
          product_price,
          isNaN(width) ? null : Number(width),
          isNaN(height) ? null : Number(height),
          isNaN(weight) ? null : Number(weight),
        ],
        function (err) {
          if (err) {
            console.error("❌ Insert product error:", err.message);
            return reject(err);
          }

          const productId = this.lastID;
          console.log("✅ Inserted product ID:", productId);

          if (!images || images.length === 0) {
            console.warn("⚠️ No images provided");
            return resolve(productId);
          }

          const stmt = `INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`;

          const insertPromises = images.map((path) => {
            return new Promise((res, rej) => {
              self.db.run(stmt, [productId, path], (err) => {
                if (err) {
                  console.error("❌ Insert image error:", err.message);
                  return rej(err);
                }
                console.log("✅ Inserted image:", path);
                res();
              });
            });
          });

          Promise.all(insertPromises)
            .then(() => resolve(productId))
            .catch((err) => reject(err));
        }
      );
    });
  };

  getCategories = () => {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM categories ORDER BY name ASC`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  };

  getProductById = (productId) => {
    return new Promise((resolve, reject) => {
      const query = `
      SELECT 
        products.*, 
        categories.name AS category_name, 
        categories.slug AS category_slug,
        (
          SELECT json_group_array(image_path)
          FROM product_images
          WHERE product_images.product_id = products.id
        ) AS images
      FROM products
      INNER JOIN categories ON products.category_id = categories.id
      WHERE products.id = ?
      `;
      this.db.get(query, [productId], (err, row) => {
        if (err) {
          console.error("Query error:", err.message);
          return reject(err);
        }

        const result = row
          ? {
              ...row,
              images: row.images ? JSON.parse(row.images) : [],
            }
          : null;
        resolve(result);
      });
    });
  };
  getProductBySlug = (slug) => {
    return new Promise((resolve, reject) => {
      const query = `
      SELECT 
        products.*, 
        categories.name AS category_name, 
        categories.slug AS category_slug,
        (
          SELECT json_group_array(image_path)
          FROM product_images
          WHERE product_images.product_id = products.id
        ) AS images
      FROM products
      INNER JOIN categories ON products.category_id = categories.id
      WHERE products.slug = ?
      `;
      this.db.get(query, [slug], (err, row) => {
        if (err) {
          console.error("Query error:", err.message);
          return reject(err);
        }

        const result = row
          ? {
              ...row,
              images: row.images ? JSON.parse(row.images) : [],
            }
          : null;
        resolve(result);
      });
    });
  };

  getAll = () => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          products.*, 
          categories.name AS category_name, 
          categories.slug AS category_slug,
          (
            SELECT json_group_array(image_path)
            FROM product_images
            WHERE product_images.product_id = products.id
          ) AS images
        FROM products
        INNER JOIN categories ON products.category_id = categories.id
        ORDER BY products.created_at DESC
      `;

      this.db.all(query, (err, rows) => {
        if (err) {
          console.error("Query error:", err.message);
          return reject(err);
        }

        const data = rows.map((row) => ({
          ...row,
          images: row.images ? JSON.parse(row.images) : [],
        }));
        resolve({ data });
      });
    });
  };

  updateProductWithImages = ({
    id,
    category_id,
    name,
    slug,
    price,
    description,
    width,
    height,
    weight,
    images,
  }) => {
    const self = this;
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(
          `
          UPDATE products
          SET category_id = ?, name = ?, slug = ?, price = ?, description = ?, width = ?, height = ?, weight = ?
          WHERE id = ?
          `,
          [
            category_id,
            name,
            slug,
            price,
            description,
            isNaN(width) ? null : Number(width),
            isNaN(height) ? null : Number(height),
            isNaN(weight) ? null : Number(weight),
            id,
          ],
          function (err) {
            if (err) {
              console.error("❌ Update product error:", err.message);
              return reject(err);
            }

            self.db.all(
              `SELECT image_path FROM product_images WHERE product_id = ?`,
              [id],
              (err, rows) => {
                if (err) {
                  console.error("❌ Error ambil gambar lama:", err.message);
                  return reject(err);
                }

                const oldImagePaths = rows.map((r) => r.image_path);
                const toDelete = oldImagePaths.filter(
                  (oldPath) => !images.includes(oldPath)
                );

                const deletePromises = toDelete.map((path) => {
                  return new Promise((res, rej) => {
                    self.db.run(
                      `DELETE FROM product_images WHERE product_id = ? AND image_path = ?`,
                      [id, path],
                      function (err) {
                        if (err) {
                          console.error("❌ Error hapus gambar:", err.message);
                          return rej(err);
                        }
                        console.log("🗑️ Dihapus dari DB:", path);
                        res();
                      }
                    );
                  });
                });

                const newImages = images.filter(
                  (imgPath) => !oldImagePaths.includes(imgPath)
                );

                const insertPromises = newImages.map((path) => {
                  return new Promise((res, rej) => {
                    self.db.run(
                      `INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`,
                      [id, path],
                      function (err) {
                        if (err) {
                          console.error("❌ Error tambah gambar:", err.message);
                          return rej(err);
                        }
                        console.log("✅ Gambar baru ditambah:", path);
                        res();
                      }
                    );
                  });
                });

                Promise.all([...deletePromises, ...insertPromises])
                  .then(() => resolve({ success: true }))
                  .catch((err) => reject(err));
              }
            );
          }
        );
      });
    });
  };

  close() {
    this.db.close((err) => {
      if (err) return console.error("Error closing the database:", err.message);
      console.log("Database connection closed.");
    });
  }
}

module.exports = new Database();
